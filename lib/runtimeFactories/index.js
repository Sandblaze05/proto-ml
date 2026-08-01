const ImageFolderRuntime = require('../datasetRuntimes/ImageFolderRuntime');
const CSVDatasetRuntime = require('../datasetRuntimes/CSVDatasetRuntime');
const TextDatasetRuntime = require('../datasetRuntimes/TextDatasetRuntime');
const JSONDatasetRuntime = require('../datasetRuntimes/JSONDatasetRuntime');
const DatabaseDatasetRuntime = require('../datasetRuntimes/DatabaseDatasetRuntime');
const APIDatasetRuntime = require('../datasetRuntimes/APIDatasetRuntime');
const TransformPreviewRuntime = require('./transformPreviewRuntime');
const LifecyclePreviewRuntime = require('./lifecyclePreviewRuntime');
const JupyterNodeRuntime = require('../executor/jupyterNodeRuntime');
const { TRANSFORM_NODES, LIFECYCLE_NODES } = require('../../nodes/nodeRegistry.js');
const { validateNodeSpec, getPortContract, getConfigSchema, getCacheMetadata } = require('../runtimeSpec/nodeSpec.js');
const { RuntimeRegistry } = require('../runtimeSpec/runtimeFactory.js');
const { computeNodeHash, isDeterministic, getSeed, getCacheKey } = require('../runtimeSpec/cacheMetadata.js');

const registry = new RuntimeRegistry();

registry.register('dataset.image', (config) => new ImageFolderRuntime(config));
registry.register('dataset.csv', (config) => new CSVDatasetRuntime(config));
registry.register('dataset.text', (config) => new TextDatasetRuntime(config));
registry.register('dataset.json', (config) => new JSONDatasetRuntime(config));
registry.register('dataset.database', (config) => new DatabaseDatasetRuntime(config));
registry.register('dataset.api', (config) => new APIDatasetRuntime(config));
registry.register('jupyter.execute', (config) => new JupyterNodeRuntime(config));

for (const def of TRANSFORM_NODES) {
  registry.registerDynamic(def.type, (config) => new TransformPreviewRuntime(def.type, config));
}

for (const def of LIFECYCLE_NODES) {
  registry.registerDynamic(def.type, (config) => new LifecyclePreviewRuntime(def.type, config));
}

function validateNodeSpecConformance(nodeType) {
  const def = require('../../nodes/nodeRegistry.js').getNodeDef(nodeType);
  if (!def) return { valid: false, errors: [`Node type not found: ${nodeType}`] };
  return validateNodeSpec(def);
}

function getRuntimeForNode(nodeType) {
  const factory = registry.resolve(nodeType);
  if (!factory) return undefined;
  return registry.create(nodeType);
}

function getPreview(nodeType, config, n = 5, context = {}) {
  const runtime = registry.create(nodeType, config || {});
  if (!runtime) throw new Error(`No runtime factory registered for node type: ${nodeType}`);
  return runtime.getSample(n, context);
}

function getCacheInfo(nodeType, config) {
  const def = require('../../nodes/nodeRegistry.js').getNodeDef(nodeType);
  if (!def) return null;
  return {
    nodeType,
    configHash: computeNodeHash(nodeType, config || {}, def.cache?.version || '1.0.0'),
    seed: getSeed(nodeType, config || {}),
    version: def.cache?.version || '1.0.0',
    deterministic: isDeterministic(nodeType, config || {}),
    cacheKey: getCacheKey(nodeType, config || {}, def.cache?.version || '1.0.0'),
  };
}

const factories = {
  registry,
  get: registry.resolve.bind(registry),
  create: registry.create.bind(registry),
  register: registry.register.bind(registry),
  registerDynamic: registry.registerDynamic.bind(registry),
  unregister: registry.unregister.bind(registry),
  listRegisteredTypes: registry.listTypes.bind(registry),
  validateNodeSpecConformance,
  getRuntimeForNode,
  getPreview,
  getCacheInfo,
  computeNodeHash,
  isDeterministic,
  getSeed,
  getCacheKey,
};

module.exports = factories;
