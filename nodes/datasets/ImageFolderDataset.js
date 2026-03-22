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

  // Optional input: a transform pipeline node can be connected
  inputs: [
    { name: 'transform', datatype: 'transform', shape: [], optional: true },
  ],

  // Typed output ports — downstream nodes validate against these
  outputs: [
    { name: 'images',      datatype: 'tensor',     shape: ['B', 'C', 'H', 'W'] },
    { name: 'labels',      datatype: 'tensor',     shape: ['B'] },
    { name: 'classes',     datatype: 'list',        shape: ['num_classes'] },
    { name: 'train_loader', datatype: 'dataloader', shape: [] },
    { name: 'val_loader',   datatype: 'dataloader', shape: [] },
    { name: 'test_loader',  datatype: 'dataloader', shape: [] },
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

    // Loading
    batch_size: 32,
    shuffle: true,
    workers: 4,
    pin_memory: true,
    prefetch: true,

    // Image Processing
    resize: [224, 224],
    normalize: 'imagenet',       // 'imagenet' | 'zero_one' | 'custom' | 'none'
    color_mode: 'RGB',           // 'RGB' | 'Grayscale'
    augmentation: false,

    // Advanced
    cache: 'none',               // 'none' | 'ram' | 'disk'
    lazy_loading: true,
    memory_map: false,
    streaming: false,

    // Splits
    train_split: 0.7,
    val_split: 0.15,
    test_split: 0.15,
  },

  metadata: {
    task: 'classification',
    num_classes: null,
    num_samples: null,
    image_size: [224, 224],
    class_distribution: {},
  },
};
