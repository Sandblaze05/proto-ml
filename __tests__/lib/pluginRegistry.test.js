import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PLUGIN_API_VERSION,
  validatePluginManifest,
  createPluginRegistry,
} from '../../lib/plugins/pluginRegistry.js';

describe('pluginRegistry', () => {
  it('validates plugin manifest shape and api compatibility', () => {
    const valid = validatePluginManifest({
      id: 'core.transforms.example',
      name: 'Example Plugin',
      version: '1.0.0',
      apiVersion: PLUGIN_API_VERSION,
    });

    expect(valid.ok).toBe(true);
    expect(valid.errors).toEqual([]);

    const invalid = validatePluginManifest({
      id: '',
      name: '',
      version: '',
      apiVersion: PLUGIN_API_VERSION + 1,
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.errors.join(' ')).toMatch(/id|name|version|not supported/i);
  });

  describe('install and uninstall lifecycle', () => {
    let registerNodeDef;
    let unregisterNodeDef;
    let registerRuntimeFactory;
    let unregisterRuntimeFactory;

    beforeEach(() => {
      registerNodeDef = vi.fn((def) => ({ type: def.type, replaced: false }));
      unregisterNodeDef = vi.fn(() => true);
      registerRuntimeFactory = vi.fn((nodeType) => ({ nodeType, replaced: false }));
      unregisterRuntimeFactory = vi.fn(() => true);
    });

    it('installs plugin nodes and runtime factories', () => {
      const registry = createPluginRegistry({
        registerNodeDef,
        unregisterNodeDef,
        registerRuntimeFactory,
        unregisterRuntimeFactory,
      });

      const plugin = {
        manifest: {
          id: 'core.transforms.runtime',
          name: 'Runtime Plugin',
          version: '0.1.0',
          apiVersion: PLUGIN_API_VERSION,
        },
        nodes: [
          {
            type: 'transform.plugin.custom',
            kind: 'transform',
            label: 'Plugin Transform',
            category: 'plugin',
            inputs: [{ name: 'in', datatype: 'any', shape: [], optional: false }],
            outputs: [{ name: 'out', datatype: 'any', shape: [] }],
          },
        ],
        runtimeFactories: {
          'transform.plugin.custom': () => ({ getSample: async () => ['ok'] }),
        },
      };

      const result = registry.installPlugin(plugin);

      expect(result.pluginId).toBe('core.transforms.runtime');
      expect(result.nodeTypes).toContain('transform.plugin.custom');
      expect(result.runtimeTypes).toContain('transform.plugin.custom');
      expect(registerNodeDef).toHaveBeenCalledTimes(1);
      expect(registerRuntimeFactory).toHaveBeenCalledTimes(1);
      expect(registry.isInstalled('core.transforms.runtime')).toBe(true);
      expect(registry.listPlugins()).toHaveLength(1);
    });

    it('rejects duplicate plugin install without overwrite', () => {
      const registry = createPluginRegistry({
        registerNodeDef,
        unregisterNodeDef,
        registerRuntimeFactory,
        unregisterRuntimeFactory,
      });

      const plugin = {
        manifest: {
          id: 'dup.plugin',
          name: 'Duplicate',
          version: '1.0.0',
        },
      };

      registry.installPlugin(plugin);
      expect(() => registry.installPlugin(plugin)).toThrow(/already installed/i);
    });

    it('uninstalls plugin and cleans up registrations', () => {
      const registry = createPluginRegistry({
        registerNodeDef,
        unregisterNodeDef,
        registerRuntimeFactory,
        unregisterRuntimeFactory,
      });

      registry.installPlugin({
        manifest: {
          id: 'cleanup.plugin',
          name: 'Cleanup',
          version: '1.0.0',
        },
        nodes: [
          {
            type: 'transform.cleanup',
            kind: 'transform',
            label: 'Cleanup',
            category: 'plugin',
            inputs: [{ name: 'in', datatype: 'any', shape: [], optional: false }],
            outputs: [{ name: 'out', datatype: 'any', shape: [] }],
          },
        ],
        runtimeFactories: {
          'transform.cleanup': () => ({ getSample: async () => [] }),
        },
      });

      const uninstallResult = registry.uninstallPlugin('cleanup.plugin');

      expect(uninstallResult.ok).toBe(true);
      expect(unregisterNodeDef).toHaveBeenCalledWith('transform.cleanup');
      expect(unregisterRuntimeFactory).toHaveBeenCalledWith('transform.cleanup');
      expect(registry.isInstalled('cleanup.plugin')).toBe(false);
    });

    it('rolls back partial install on runtime factory registration failure', () => {
      registerRuntimeFactory = vi.fn(() => {
        throw new Error('Runtime registration failed');
      });

      const registry = createPluginRegistry({
        registerNodeDef,
        unregisterNodeDef,
        registerRuntimeFactory,
        unregisterRuntimeFactory,
      });

      expect(() => {
        registry.installPlugin({
          manifest: {
            id: 'rollback.plugin',
            name: 'Rollback',
            version: '1.0.0',
          },
          nodes: [
            {
              type: 'transform.rollback',
              kind: 'transform',
              label: 'Rollback',
              category: 'plugin',
              inputs: [{ name: 'in', datatype: 'any', shape: [], optional: false }],
              outputs: [{ name: 'out', datatype: 'any', shape: [] }],
            },
          ],
          runtimeFactories: {
            'transform.rollback': () => ({ getSample: async () => [] }),
          },
        });
      }).toThrow(/runtime registration failed/i);

      expect(unregisterNodeDef).toHaveBeenCalledWith('transform.rollback');
      expect(registry.listPlugins()).toHaveLength(0);
    });
  });
});
