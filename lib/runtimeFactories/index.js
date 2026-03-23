const ImageFolderRuntime = require('../datasetRuntimes/ImageFolderRuntime');
const CSVDatasetRuntime = require('../datasetRuntimes/CSVDatasetRuntime');
const TextDatasetRuntime = require('../datasetRuntimes/TextDatasetRuntime');
const JSONDatasetRuntime = require('../datasetRuntimes/JSONDatasetRuntime');

// Map node type string -> runtime factory (fn that returns runtime instance)
const factories = {
  'dataset.image': (config) => new ImageFolderRuntime(config),
  'dataset.csv': (config) => new CSVDatasetRuntime(config),
  'dataset.text': (config) => new TextDatasetRuntime(config),
  'dataset.json': (config) => new JSONDatasetRuntime(config),
};

module.exports = factories;
