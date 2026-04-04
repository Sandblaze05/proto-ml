import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { getDefaultPluginRegistry } from './defaultPluginRegistry.js';

const SUPPORTED_EXTENSIONS = new Set(['.json', '.js', '.mjs', '.cjs']);

async function loadPluginFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) return null;

  if (ext === '.json') {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  }

  const imported = await import(pathToFileURL(filePath).href);
  return imported.default || imported.plugin || imported;
}

async function discoverPluginFiles(pluginsDir) {
  const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(pluginsDir, entry.name);

    if (entry.isFile()) {
      files.push(fullPath);
      continue;
    }

    if (entry.isDirectory()) {
      const candidates = ['plugin.json', 'index.js', 'index.mjs', 'index.cjs'];
      for (const candidate of candidates) {
        const candidatePath = path.join(fullPath, candidate);
        try {
          const stat = await fs.stat(candidatePath);
          if (stat.isFile()) files.push(candidatePath);
        } catch {
          // ignore missing candidate files
        }
      }
    }
  }

  return files;
}

function getBootstrapState() {
  if (!globalThis.__PROTO_ML_PLUGIN_BOOTSTRAP__) {
    globalThis.__PROTO_ML_PLUGIN_BOOTSTRAP__ = {
      done: false,
      plugins: [],
      warnings: [],
      loadedFrom: '',
    };
  }
  return globalThis.__PROTO_ML_PLUGIN_BOOTSTRAP__;
}

export async function bootstrapPluginsFromRepo(options = {}) {
  const pluginsDir = options.pluginsDir || path.join(process.cwd(), 'plugins');
  const force = options.force === true;
  const state = getBootstrapState();

  if (state.done && !force) {
    return {
      ok: true,
      skipped: true,
      plugins: state.plugins,
      warnings: state.warnings,
      loadedFrom: state.loadedFrom,
    };
  }

  const registry = getDefaultPluginRegistry();
  const warnings = [];
  const loadedPlugins = [];

  let pluginFiles = [];
  try {
    pluginFiles = await discoverPluginFiles(pluginsDir);
  } catch {
    // No plugin directory yet. Treat as no-op bootstrap.
    state.done = true;
    state.plugins = [];
    state.warnings = [];
    state.loadedFrom = pluginsDir;
    return { ok: true, skipped: false, plugins: [], warnings: [], loadedFrom: pluginsDir };
  }

  for (const filePath of pluginFiles) {
    try {
      const plugin = await loadPluginFromFile(filePath);
      if (!plugin || !plugin.manifest) {
        warnings.push(`Skipping ${path.basename(filePath)}: missing plugin manifest.`);
        continue;
      }

      const installResult = registry.installPlugin(plugin, {
        overwrite: true,
        overwriteNodes: true,
        overwriteRuntimeFactories: true,
      });

      loadedPlugins.push({
        ...installResult,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        nodeDefs: Array.isArray(plugin.nodes) ? plugin.nodes : [],
        source: filePath,
      });
    } catch (error) {
      warnings.push(`Failed to load ${path.basename(filePath)}: ${error?.message || String(error)}`);
    }
  }

  state.done = true;
  state.plugins = loadedPlugins;
  state.warnings = warnings;
  state.loadedFrom = pluginsDir;

  return {
    ok: true,
    skipped: false,
    plugins: loadedPlugins,
    warnings,
    loadedFrom: pluginsDir,
  };
}
