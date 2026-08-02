/**
 * Image Folder Dataset Node Definition
 * Data contract for folder-based image classification datasets.
 * Shape convention: [B, C, H, W] — batch, channels, height, width
 */
export const ImageFolderDatasetDef = {
  type: 'dataset.image',
  kind: 'dataset',
  category: 'dataset',
  label: 'Image Folder',
  icon: 'ImageIcon',
  color: '#c084fc',

  inputs: [],

  outputs: [
    { name: 'out',         datatype: 'tensor',     shape: [] },
    { name: 'images',      datatype: 'tensor',     shape: ['B', 'C', 'H', 'W'] },
    { name: 'labels',      datatype: 'tensor',     shape: ['B'] },
    { name: 'classes',     datatype: 'list',        shape: ['num_classes'] },
  ],

  ports: {
    inputs: [],
    outputs: [
      { name: 'out', datatype: 'tensor', shape: [], role: 'data' },
      { name: 'images', datatype: 'tensor', shape: ['B', 'C', 'H', 'W'], role: 'data' },
      { name: 'labels', datatype: 'tensor', shape: ['B'], role: 'labels' },
      { name: 'classes', datatype: 'list', shape: ['num_classes'], role: 'data' },
    ],
  },

  config: {
    defaults: {
      path: '',
      format: 'jpg',
      recursive: true,
      label_strategy: 'folder_name',
      label_file: '',
      resize: [224, 224],
      normalize: 'imagenet',
      color_mode: 'RGB',
    },
    schema: {
      dtype: 'float32',
      task: 'classification',
      input_format: 'image',
    },
  },

  preview: 'dataset.image',
  backend: 'dataset.image',

  cache: {
    version: '1.0.0',
    seed: 42,
    deterministic: true,
  },

  metadata: {
    task: 'classification',
    num_classes: null,
    num_samples: null,
    image_size: [224, 224],
    class_distribution: {},
  },
};
