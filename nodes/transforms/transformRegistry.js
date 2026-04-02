function createTransformDef({
  type,
  label,
  domain,
  level,
  category,
  defaultConfig = {},
  uiSchema = {},
  kind = 'transform',
}) {
  return {
    type,
    domain,
    kind,
    category,
    level,
    label,
    color: '#67e8f9',
    accepts: [domain],
    produces: [domain],
    inputs: [{ name: 'in', datatype: 'tensor', shape: [], optional: false }],
    outputs: [{ name: 'out', datatype: 'tensor', shape: [] }],
    defaultConfig,
    uiSchema,
    metadata: { domain },
  };
}

export const TRANSFORM_NODES = [
  // Level 1: Image
  createTransformDef({ type: 'transform.image.resize', label: 'Resize', domain: 'image', level: 1, category: 'image-basic', defaultConfig: { size: [224, 224] }, uiSchema: { size: { type: 'array:number', length: 2 } } }),
  createTransformDef({ type: 'transform.image.center_crop', label: 'Center Crop', domain: 'image', level: 1, category: 'image-basic', defaultConfig: { size: [224, 224] } }),
  createTransformDef({ type: 'transform.image.random_crop', label: 'Random Crop', domain: 'image', level: 1, category: 'image-basic', defaultConfig: { size: [224, 224], p: 1.0 } }),
  createTransformDef({ type: 'transform.image.normalize', label: 'Normalize', domain: 'image', level: 1, category: 'image-basic', defaultConfig: { mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] } }),
  createTransformDef({ type: 'transform.image.to_tensor', label: 'ToTensor', domain: 'image', level: 1, category: 'image-basic', defaultConfig: {} }),
  createTransformDef({ type: 'transform.image.grayscale', label: 'Grayscale', domain: 'image', level: 1, category: 'image-basic', defaultConfig: { num_output_channels: 1 } }),
  createTransformDef({ type: 'transform.image.pad', label: 'Pad', domain: 'image', level: 1, category: 'image-basic', defaultConfig: { padding: 4, fill: 0 } }),

  // Level 1: Tabular
  createTransformDef({ type: 'transform.tabular.drop_columns', label: 'Drop Columns', domain: 'tabular', level: 1, category: 'tabular-basic', defaultConfig: { columns: [] } }),
  createTransformDef({ type: 'transform.tabular.fill_missing', label: 'Fill Missing Values', domain: 'tabular', level: 1, category: 'tabular-basic', defaultConfig: { strategy: 'mean', columns: [] } }),
  createTransformDef({ type: 'transform.tabular.standard_scaler', label: 'StandardScaler', domain: 'tabular', level: 1, category: 'tabular-basic', defaultConfig: { columns: [] } }),
  createTransformDef({ type: 'transform.tabular.minmax_scaler', label: 'MinMaxScaler', domain: 'tabular', level: 1, category: 'tabular-basic', defaultConfig: { columns: [], range: [0, 1] } }),
  createTransformDef({ type: 'transform.tabular.label_encoding', label: 'Label Encoding', domain: 'tabular', level: 1, category: 'tabular-basic', defaultConfig: { columns: [] } }),
  createTransformDef({ type: 'transform.tabular.one_hot_encoding', label: 'One Hot Encoding', domain: 'tabular', level: 1, category: 'tabular-basic', defaultConfig: { columns: [] } }),

  // Level 1: Text
  createTransformDef({ type: 'transform.text.lowercase', label: 'Lowercase', domain: 'text', level: 1, category: 'text-basic', defaultConfig: {} }),
  createTransformDef({ type: 'transform.text.remove_punctuation', label: 'Remove Punctuation', domain: 'text', level: 1, category: 'text-basic', defaultConfig: {} }),
  createTransformDef({ type: 'transform.text.tokenization', label: 'Tokenization', domain: 'text', level: 1, category: 'text-basic', defaultConfig: { tokenizer: 'whitespace' } }),
  createTransformDef({ type: 'transform.text.stopword_removal', label: 'Stopword Removal', domain: 'text', level: 1, category: 'text-basic', defaultConfig: { language: 'english' } }),
  createTransformDef({ type: 'transform.text.truncation', label: 'Truncation', domain: 'text', level: 1, category: 'text-basic', defaultConfig: { max_length: 512 } }),
  createTransformDef({ type: 'transform.text.padding', label: 'Padding', domain: 'text', level: 1, category: 'text-basic', defaultConfig: { max_length: 512, pad_value: 0 } }),

  // Level 2: Image augmentations
  createTransformDef({ type: 'transform.image.random_horizontal_flip', label: 'RandomHorizontalFlip', domain: 'image', level: 2, category: 'image-augmentation', defaultConfig: { p: 0.5 } }),
  createTransformDef({ type: 'transform.image.random_vertical_flip', label: 'RandomVerticalFlip', domain: 'image', level: 2, category: 'image-augmentation', defaultConfig: { p: 0.5 } }),
  createTransformDef({
    type: 'transform.image.random_rotation',
    label: 'RandomRotation',
    domain: 'image',
    level: 2,
    category: 'image-augmentation',
    defaultConfig: { degrees: 30, p: 1.0, fill_mode: 'reflect' },
    uiSchema: {
      degrees: { type: 'number', min: 0, max: 360, step: 1, label: 'Angle (deg)' },
      p: { type: 'number', min: 0, max: 1, step: 0.05, label: 'Probability' },
      fill_mode: { type: 'enum', options: ['reflect', 'constant', 'nearest'], label: 'Fill Mode' },
    },
  }),
  createTransformDef({ type: 'transform.image.color_jitter', label: 'ColorJitter', domain: 'image', level: 2, category: 'image-augmentation', defaultConfig: { brightness: 0.2, contrast: 0.2, saturation: 0.2, hue: 0.1 } }),
  createTransformDef({ type: 'transform.image.gaussian_blur', label: 'GaussianBlur', domain: 'image', level: 2, category: 'image-augmentation', defaultConfig: { kernel_size: 3, sigma: [0.1, 2.0] } }),
  createTransformDef({ type: 'transform.image.random_erasing', label: 'RandomErasing', domain: 'image', level: 2, category: 'image-augmentation', defaultConfig: { p: 0.25 } }),
  createTransformDef({ type: 'transform.image.random_affine', label: 'RandomAffine', domain: 'image', level: 2, category: 'image-augmentation', defaultConfig: { degrees: 15 } }),
  createTransformDef({ type: 'transform.image.perspective_transform', label: 'PerspectiveTransform', domain: 'image', level: 2, category: 'image-augmentation', defaultConfig: { distortion_scale: 0.5, p: 0.5 } }),
  createTransformDef({ type: 'transform.image.cutmix', label: 'CutMix', domain: 'image', level: 2, category: 'image-augmentation', defaultConfig: { alpha: 1.0, p: 0.5 } }),
  createTransformDef({ type: 'transform.image.mixup', label: 'MixUp', domain: 'image', level: 2, category: 'image-augmentation', defaultConfig: { alpha: 0.2, p: 0.5 } }),

  // Pipeline and control
  createTransformDef({ type: 'transform.pipeline.compose', label: 'Compose', domain: 'image', level: 2, category: 'pipeline', defaultConfig: { transforms: [] }, uiSchema: { transforms: { type: 'array:nodeRef' } } }),
  createTransformDef({
    type: 'transform.pipeline.custom_python',
    label: 'Custom Python Transform',
    domain: 'image',
    level: 2,
    category: 'pipeline',
    defaultConfig: { code: 'def transform(x):\n    return x', runtime: 'cpu', dependencies: [] },
    uiSchema: {
      code: { type: 'code', language: 'python', label: 'Custom Transform Code' },
      runtime: { type: 'enum', options: ['cpu', 'gpu', 'auto'], label: 'Runtime' },
      dependencies: { type: 'array:string', label: 'Dependencies' },
    },
  }),
  createTransformDef({
    type: 'transform.pipeline.condition',
    label: 'Condition',
    domain: 'image',
    level: 2,
    category: 'pipeline',
    defaultConfig: { field: 'width', operator: '>', value: 500 },
    uiSchema: {
      field: { type: 'string', label: 'Field' },
      operator: { type: 'enum', options: ['>', '>=', '<', '<=', '==', '!='], label: 'Operator' },
      value: { type: 'number', label: 'Value' },
    },
  }),

  // Dataset manipulation and analytics
  createTransformDef({ type: 'transform.data.filter', label: 'Dataset Filter', domain: 'tabular', level: 2, category: 'data-ops', defaultConfig: { expression: 'label == "dog"' } }),
  createTransformDef({ type: 'transform.data.sampling', label: 'Dataset Sampling', domain: 'tabular', level: 2, category: 'data-ops', defaultConfig: { method: 'balanced', size: 1000 } }),
  createTransformDef({ type: 'transform.data.feature_generator', label: 'Feature Generator', domain: 'tabular', level: 2, category: 'data-ops', defaultConfig: { generators: ['polynomial', 'interaction'] } }),
  createTransformDef({ type: 'transform.data.validation', label: 'Data Validation', domain: 'tabular', level: 2, category: 'data-ops', defaultConfig: { checks: ['missing', 'duplicates', 'imbalance', 'outliers'] } }),
  createTransformDef({ type: 'transform.data.statistics', label: 'Dataset Statistics', domain: 'tabular', level: 2, category: 'data-ops', defaultConfig: { metrics: ['mean', 'std', 'correlation'] } }),
  createTransformDef({ type: 'transform.data.versioning', label: 'Data Versioning', domain: 'tabular', level: 2, category: 'data-ops', defaultConfig: { action: 'snapshot' } }),
  createTransformDef({ type: 'transform.data.cache', label: 'Data Cache', domain: 'tabular', level: 2, category: 'data-ops', defaultConfig: { mode: 'disk', key: '' } }),

  // Control flow
  createTransformDef({ type: 'transform.control.loop', label: 'Loop', domain: 'tabular', level: 2, category: 'control', defaultConfig: { iterator: 'class' } }),
  createTransformDef({ type: 'transform.control.parallel', label: 'Parallel', domain: 'tabular', level: 2, category: 'control', defaultConfig: { branches: 2 } }),
  createTransformDef({ type: 'transform.control.merge', label: 'Merge', domain: 'tabular', level: 2, category: 'control', defaultConfig: { strategy: 'concat' } }),
  createTransformDef({ type: 'transform.control.branch', label: 'Branch', domain: 'tabular', level: 2, category: 'control', defaultConfig: { condition: 'True' } }),
];
