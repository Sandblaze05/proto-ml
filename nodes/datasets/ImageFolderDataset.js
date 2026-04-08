/**
 * Image Folder Dataset Node Definition
 * Data contract for folder-based image classification datasets.
 * Shape convention: [B, C, H, W] — batch, channels, height, width
 */
export const ImageFolderDatasetDef = {
  type: 'dataset.image',
  category: 'dataset',
  label: 'Image Folder',
  icon: 'ImageIcon',
  color: '#c084fc', // purple

  inputs: [],

  // Typed output ports — downstream nodes validate against these
  outputs: [
    { name: 'out',         datatype: 'any',        shape: [] },
    { name: 'images',      datatype: 'tensor',     shape: ['B', 'C', 'H', 'W'] },
    { name: 'labels',      datatype: 'tensor',     shape: ['B'] },
    { name: 'classes',     datatype: 'list',        shape: ['num_classes'] },
  ],

  schema: {
    dtype: 'float32',
    task: 'classification',
    input_format: 'image',
  },

  defaultConfig: {
    // Source
    path: '',
    format: 'jpg',
    recursive: true,
    label_strategy: 'folder_name', // 'folder_name' | 'csv_mapping' | 'json_mapping' | 'none'
    label_file: '',

    resize: [224, 224],
    normalize: 'imagenet',       // Source-level defaults for previews
    color_mode: 'RGB',
  },

  metadata: {
    task: 'classification',
    num_classes: null,
    num_samples: null,
    image_size: [224, 224],
    class_distribution: {},
  },
};
