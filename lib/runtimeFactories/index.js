const ImageFolderRuntime = require('../datasetRuntimes/ImageFolderRuntime');
const CSVDatasetRuntime = require('../datasetRuntimes/CSVDatasetRuntime');
const TextDatasetRuntime = require('../datasetRuntimes/TextDatasetRuntime');
const JSONDatasetRuntime = require('../datasetRuntimes/JSONDatasetRuntime');
const TransformPreviewRuntime = require('./transformPreviewRuntime');
const LifecyclePreviewRuntime = require('./lifecyclePreviewRuntime');

// Map node type string -> runtime factory (fn that returns runtime instance)
const exactFactories = {
  'dataset.image': (config) => new ImageFolderRuntime(config),
  'dataset.csv': (config) => new CSVDatasetRuntime(config),
  'dataset.text': (config) => new TextDatasetRuntime(config),
  'dataset.json': (config) => new JSONDatasetRuntime(config),
};

const dynamicFactories = Object.create(null);

function getFactoryForType(nodeType) {
  return dynamicFactories[nodeType] || exactFactories[nodeType];
}

function register(nodeType, factory, options = {}) {
  if (typeof nodeType !== 'string' || !nodeType.trim()) {
    throw new Error('Invalid runtime factory type: expected non-empty string.');
  }
  if (typeof factory !== 'function') {
    throw new Error(`Invalid runtime factory for ${nodeType}: expected function.`);
  }

  const { overwrite = false } = options;
  const existing = getFactoryForType(nodeType);

  if (existing && !overwrite) {
    throw new Error(`Runtime factory already exists for node type: ${nodeType}`);
  }

  dynamicFactories[nodeType] = factory;
  return { nodeType, replaced: Boolean(existing) };
}

function unregister(nodeType) {
  if (!dynamicFactories[nodeType]) return false;
  delete dynamicFactories[nodeType];
  return true;
}

function listRegisteredTypes() {
  return Array.from(new Set([
    ...Object.keys(exactFactories),
    ...Object.keys(dynamicFactories),
  ])).sort();
}

function resolveFactory(nodeType) {
  const exactOrDynamic = getFactoryForType(nodeType);
  if (exactOrDynamic) return exactOrDynamic;
  if (typeof nodeType !== 'string') return undefined;
  if (nodeType.startsWith('transform.')) {
    return (config) => new TransformPreviewRuntime(nodeType, config);
  }
  if (nodeType.startsWith('lifecycle.')) {
    return (config) => new LifecyclePreviewRuntime(nodeType, config);
  }
  return undefined;
}

const factories = {
  ...exactFactories,
  get: resolveFactory,
  register,
  unregister,
  listRegisteredTypes,
};

module.exports = factories;
