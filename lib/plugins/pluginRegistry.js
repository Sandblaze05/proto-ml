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
        const registration = registerNodeDef(def, { overwrite: overwriteNodes });
        installedNodeTypes.push(registration.type || def.type);
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
