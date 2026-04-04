import { createRequire } from 'module';
import { createPluginRegistry } from './pluginRegistry.js';
import { registerNodeDef, unregisterNodeDef } from '../../nodes/nodeRegistry.js';

const require = createRequire(import.meta.url);
const runtimeFactories = require('../runtimeFactories');

let defaultRegistry;

export function getDefaultPluginRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = createPluginRegistry({
      registerNodeDef,
      unregisterNodeDef,
      registerRuntimeFactory: runtimeFactories.register,
      unregisterRuntimeFactory: runtimeFactories.unregister,
    });
  }
  return defaultRegistry;
}
