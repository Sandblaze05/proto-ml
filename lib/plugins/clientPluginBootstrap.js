import { registerNodeDef } from '../../nodes/nodeRegistry.js';

function getClientBootstrapState() {
  if (!globalThis.__PROTO_ML_CLIENT_PLUGIN_BOOTSTRAP__) {
    globalThis.__PROTO_ML_CLIENT_PLUGIN_BOOTSTRAP__ = {
      done: false,
      plugins: [],
      warnings: [],
    };
  }
  return globalThis.__PROTO_ML_CLIENT_PLUGIN_BOOTSTRAP__;
}

export async function bootstrapClientPlugins(options = {}) {
  const force = options.force === true;
  const state = getClientBootstrapState();

  if (state.done && !force) {
    return {
      ok: true,
      skipped: true,
      plugins: state.plugins,
      warnings: state.warnings,
    };
  }

  let response = await fetch('/api/plugins/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });

  if (response.status === 404) {
    response = await fetch('/api/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    });
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Plugin bootstrap request failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const plugins = Array.isArray(payload.plugins) ? payload.plugins : [];

  for (const plugin of plugins) {
    const nodeDefs = Array.isArray(plugin.nodeDefs) ? plugin.nodeDefs : [];
    for (const nodeDef of nodeDefs) {
      try {
        registerNodeDef(nodeDef, { overwrite: true });
      } catch {
        // Keep client bootstrap resilient to malformed plugin nodes.
      }
    }
  }

  state.done = true;
  state.plugins = plugins;
  state.warnings = Array.isArray(payload.warnings) ? payload.warnings : [];

  return {
    ok: true,
    skipped: false,
    plugins: state.plugins,
    warnings: state.warnings,
  };
}
