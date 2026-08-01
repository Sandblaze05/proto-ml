export const PLUGIN_API_VERSION = 1;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validatePluginManifest(manifest) {
  const errors = [];

  if (!isObject(manifest)) {
    return { ok: false, errors: ['Plugin manifest must be an object.'] };
  }

  if (typeof manifest.id !== 'string' || !manifest.id.trim()) {
    errors.push('Plugin manifest `id` must be a non-empty string.');
  } else if (!/^[a-z0-9._-]+$/i.test(manifest.id.trim())) {
    errors.push('Plugin manifest `id` contains invalid characters.');
  }

  if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
    errors.push('Plugin manifest `name` must be a non-empty string.');
  }

  if (typeof manifest.version !== 'string' || !manifest.version.trim()) {
    errors.push('Plugin manifest `version` must be a non-empty string.');
  }

  const apiVersion = manifest.apiVersion ?? PLUGIN_API_VERSION;
  if (typeof apiVersion !== 'number' || apiVersion < 1) {
    errors.push('Plugin manifest `apiVersion` must be a positive number.');
  } else if (apiVersion > PLUGIN_API_VERSION) {
    errors.push(
      `Plugin apiVersion ${apiVersion} is not supported by host version ${PLUGIN_API_VERSION}.`,
    );
  }

  return { ok: errors.length === 0, errors };
}

function toRuntimeFactoryEntries(runtimeFactories = {}) {
  if (!isObject(runtimeFactories)) return [];
  return Object.entries(runtimeFactories).filter(([type, factory]) => {
    return typeof type === 'string' && type.trim() && typeof factory === 'function';
  });
}

function inferKindFromType(type) {
  if (typeof type !== 'string') return 'generic';
  if (type.startsWith('dataset.')) return 'dataset';
  if (type.startsWith('transform.')) return 'transform';
  if (type.startsWith('lifecycle.')) return 'lifecycle';
  return 'generic';
}

function normalizePluginNodeDef(def) {
  if (!isObject(def)) return def;

  const ports = isObject(def.ports)
    ? def.ports
    : {
        inputs: Array.isArray(def.inputs) ? def.inputs : [],
        outputs: Array.isArray(def.outputs) ? def.outputs : [],
      };

  const config = isObject(def.config)
    ? {
        defaults: isObject(def.config.defaults) ? def.config.defaults : {},
        schema: def.config.schema ?? def.uiSchema ?? null,
      }
    : {
        defaults: isObject(def.defaultConfig) ? def.defaultConfig : {},
        schema: def.uiSchema ?? def.schema ?? null,
      };

  return {
    ...def,
    kind: def.kind || inferKindFromType(def.type),
    ports: {
      inputs: Array.isArray(ports.inputs) ? ports.inputs : [],
      outputs: Array.isArray(ports.outputs) ? ports.outputs : [],
    },
    config,
    preview: def.preview ?? def.type,
    backend: def.backend ?? def.type,
    cache: isObject(def.cache)
      ? def.cache
      : { version: '1.0.0', seed: 42, deterministic: true },
  };
}

function assertDependency(name, value) {
  if (typeof value !== 'function') {
    throw new Error(`Plugin registry requires function dependency: ${name}`);
  }
}

export function createPluginRegistry(deps) {
  const {
    registerNodeDef,
    unregisterNodeDef,
    registerRuntimeFactory,
    unregisterRuntimeFactory,
  } = deps || {};

  assertDependency('registerNodeDef', registerNodeDef);
  assertDependency('unregisterNodeDef', unregisterNodeDef);
  assertDependency('registerRuntimeFactory', registerRuntimeFactory);
  assertDependency('unregisterRuntimeFactory', unregisterRuntimeFactory);

  const installedPlugins = new Map();

  function installPlugin(plugin, options = {}) {
    if (!isObject(plugin)) {
      throw new Error('Invalid plugin: expected object.');
    }

    const manifest = plugin.manifest || {};
    const validation = validatePluginManifest(manifest);
    if (!validation.ok) {
      throw new Error(`Invalid plugin manifest: ${validation.errors.join(' ')}`);
    }

    const pluginId = manifest.id.trim();
    const {
      overwrite = false,
      overwriteNodes = false,
      overwriteRuntimeFactories = false,
    } = options;

    if (installedPlugins.has(pluginId)) {
      if (!overwrite) {
        throw new Error(`Plugin already installed: ${pluginId}`);
      }
      uninstallPlugin(pluginId);
    }

    const nodeDefs = Array.isArray(plugin.nodes) ? plugin.nodes : [];
    const runtimeFactories = toRuntimeFactoryEntries(plugin.runtimeFactories);

    const installedNodeTypes = [];
    const installedRuntimeTypes = [];

    try {
      for (const def of nodeDefs) {
        const normalizedDef = normalizePluginNodeDef(def);
        const registration = registerNodeDef(normalizedDef, { overwrite: overwriteNodes });
        installedNodeTypes.push(registration.type || normalizedDef.type);
      }

      for (const [nodeType, factory] of runtimeFactories) {
        const registration = registerRuntimeFactory(nodeType, factory, {
          overwrite: overwriteRuntimeFactories,
        });
        installedRuntimeTypes.push(registration.nodeType || nodeType);
      }

      let setupResult;
      if (typeof plugin.setup === 'function') {
        setupResult = plugin.setup({ manifest, pluginId });
      }

      installedPlugins.set(pluginId, {
        pluginId,
        manifest,
        plugin,
        nodeTypes: installedNodeTypes,
        runtimeTypes: installedRuntimeTypes,
        setupResult,
        installedAt: new Date().toISOString(),
      });

      return {
        pluginId,
        nodeTypes: installedNodeTypes,
        runtimeTypes: installedRuntimeTypes,
      };
    } catch (error) {
      // Roll back partial installs if any registration fails.
      for (const type of installedNodeTypes) {
        unregisterNodeDef(type);
      }
      for (const type of installedRuntimeTypes) {
        unregisterRuntimeFactory(type);
      }
      throw error;
    }
  }

  function uninstallPlugin(pluginId) {
    const record = installedPlugins.get(pluginId);
    if (!record) return false;

    const teardownErrorMessages = [];
    if (typeof record.plugin?.teardown === 'function') {
      try {
        record.plugin.teardown({ pluginId, manifest: record.manifest });
      } catch (error) {
        teardownErrorMessages.push(error?.message || String(error));
      }
    }

    for (const type of record.nodeTypes) {
      unregisterNodeDef(type);
    }
    for (const type of record.runtimeTypes) {
      unregisterRuntimeFactory(type);
    }

    installedPlugins.delete(pluginId);

    return {
      ok: teardownErrorMessages.length === 0,
      pluginId,
      teardownErrors: teardownErrorMessages,
    };
  }

  function isInstalled(pluginId) {
    return installedPlugins.has(pluginId);
  }

  function getPlugin(pluginId) {
    const record = installedPlugins.get(pluginId);
    if (!record) return undefined;
    return {
      pluginId: record.pluginId,
      manifest: record.manifest,
      nodeTypes: [...record.nodeTypes],
      runtimeTypes: [...record.runtimeTypes],
      installedAt: record.installedAt,
    };
  }

  function listPlugins() {
    return Array.from(installedPlugins.values()).map((record) => ({
      pluginId: record.pluginId,
      name: record.manifest.name,
      version: record.manifest.version,
      nodeTypeCount: record.nodeTypes.length,
      runtimeTypeCount: record.runtimeTypes.length,
      installedAt: record.installedAt,
    }));
  }

  return {
    installPlugin,
    uninstallPlugin,
    isInstalled,
    getPlugin,
    listPlugins,
  };
}
