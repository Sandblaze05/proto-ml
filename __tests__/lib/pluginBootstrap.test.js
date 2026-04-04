import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { bootstrapPluginsFromRepo } from '../../lib/plugins/pluginBootstrap.js';
import { hasNodeDef } from '../../nodes/nodeRegistry.js';

describe('pluginBootstrap', () => {
  it('loads plugin manifests from a repository folder', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'proto-ml-plugin-'));

    const pluginJson = {
      manifest: {
        id: 'test.bootstrap.plugin',
        name: 'Bootstrap Test Plugin',
        version: '1.0.0',
        apiVersion: 1,
      },
      nodes: [
        {
          type: 'transform.plugin.bootstrap_test',
          kind: 'transform',
          category: 'programming',
          label: 'Bootstrap Test Node',
          accepts: ['*'],
          produces: ['*'],
          inputs: [{ name: 'in', datatype: 'any', shape: [], optional: false }],
          outputs: [{ name: 'out', datatype: 'any', shape: [] }],
          defaultConfig: {},
          uiSchema: {},
        },
      ],
    };

    await fs.writeFile(path.join(dir, 'plugin.json'), JSON.stringify(pluginJson, null, 2), 'utf8');

    const result = await bootstrapPluginsFromRepo({ pluginsDir: dir, force: true });

    expect(result.ok).toBe(true);
    expect(result.plugins.some((plugin) => plugin.pluginId === 'test.bootstrap.plugin')).toBe(true);
    expect(hasNodeDef('transform.plugin.bootstrap_test')).toBe(true);

    await fs.rm(dir, { recursive: true, force: true });
  });
});
