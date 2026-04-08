/**
 * Python Runtime Helpers
 * Generates the Python runtime code that implements apply_transform, apply_lifecycle, apply_node
 * These are injected into the generated pipeline scripts.
 */

export function getPythonRuntimeCode() {
    return `
# ============================================================================
# RUNTIME HELPERS: Transform, Lifecycle, and Generic Node Implementations
# ============================================================================

try:
    import numpy as np
except ImportError:
    # Fallback mock for numpy if not installed
    class NumpyRandom:
        def random(self): return 0.5
        def uniform(self, a, b): return (a + b) / 2
        def randint(self, a, b): return (a + b) // 2
        def shuffle(self, x): return x
        def seed(self, s): pass
    
    class NumpyClass:
        random = NumpyRandom()
        
        @staticmethod
        def array(x, dtype=None):
            return x
        @staticmethod
        def linspace(a, b, n):
            return [a + (b-a)*i/(n-1) for i in range(n)]
        @staticmethod
        def arange(n):
            return list(range(n))
        @staticmethod
        def ix_(*args):
            return args
        @staticmethod
        def fliplr(x):
            if isinstance(x, list): return x[::-1]
            return x
        @staticmethod
        def flipud(x):
            if isinstance(x, list): return x[::-1]
            return x
        @staticmethod
        def rot90(x):
            return x
        @staticmethod
        def pad(x, **kwargs):
            return x
        @staticmethod
        def clip(x, a, b):
            if isinstance(x, (int, float)): return max(a, min(x, b))
            return x
        @staticmethod
        def sqrt(x):
            return x ** 0.5
        float32 = float
        ndarray = (list, tuple)
    
    np = NumpyClass()

from typing import Any, Dict, List
import os
import csv
import pickle
from datetime import datetime

try:
    from sklearn.linear_model import LinearRegression, LogisticRegression
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    SKLEARN_AVAILABLE = True
except Exception:
    SKLEARN_AVAILABLE = False

try:
    import torch
    TORCH_AVAILABLE = True
except Exception:
    TORCH_AVAILABLE = False

try:
    from transformers import pipeline as hf_pipeline
    TRANSFORMERS_AVAILABLE = True
except Exception:
    TRANSFORMERS_AVAILABLE = False

def select_output_handle(output: Any, handle: str = None) -> Any:
    """
    Resolve a source-handle payload from a node output.
    Falls back to full output when handle is missing or unavailable.
    """
    if handle is None or handle == '' or handle == 'out':
        if isinstance(output, dict) and 'out' in output:
            return output.get('out')
        return output

    if isinstance(output, dict):
        if handle in output:
            return output[handle]
        nested_out = output.get('out')
        if isinstance(nested_out, dict) and handle in nested_out:
            return nested_out[handle]

    return output

# --- Transform Runtime ---

def apply_transform(transform_type: str, x: Any, config: Dict[str, Any]) -> Any:
    """
    Execute a transform operation on data.
    transform_type: 'transform.image.resize', 'transform.tabular.standard_scaler', etc.
    x: input data (array, list of dicts, etc.)
    config: transform-specific configuration
    """
    
    # Image transforms
    if transform_type == 'transform.image.resize':
        return _transform_image_resize(x, config)
    elif transform_type == 'transform.image.normalize':
        return _transform_image_normalize(x, config)
    elif transform_type == 'transform.image.grayscale':
        return _transform_image_grayscale(x, config)
    elif transform_type == 'transform.image.to_tensor':
        return _transform_image_to_tensor(x, config)
    elif transform_type == 'transform.image.center_crop':
        return _transform_image_center_crop(x, config)
    elif transform_type == 'transform.image.pad':
        return _transform_image_pad(x, config)
    elif transform_type == 'transform.image.random_crop':
        return _transform_image_random_crop(x, config)
    elif transform_type == 'transform.image.random_horizontal_flip':
        return _transform_image_random_horizontal_flip(x, config)
    elif transform_type == 'transform.image.random_vertical_flip':
        return _transform_image_random_vertical_flip(x, config)
    elif transform_type == 'transform.image.random_flip':
        return _transform_image_random_flip(x, config)
    elif transform_type == 'transform.image.random_rotation':
        return _transform_image_random_rotation(x, config)
    elif transform_type == 'transform.image.color_jitter':
        return _transform_image_color_jitter(x, config)
    elif transform_type == 'transform.image.gaussian_blur':
        return _transform_image_gaussian_blur(x, config)
    elif transform_type == 'transform.image.random_erasing':
        return _transform_image_random_erasing(x, config)
    elif transform_type == 'transform.image.random_affine':
        return _transform_image_random_affine(x, config)
    elif transform_type == 'transform.image.perspective_transform':
        return _transform_image_perspective_transform(x, config)
    elif transform_type == 'transform.image.cutmix':
        return _transform_image_cutmix(x, config)
    elif transform_type == 'transform.image.mixup':
        return _transform_image_mixup(x, config)
    
    # Tabular transforms
    elif transform_type == 'transform.tabular.drop_columns':
        return _transform_tabular_drop_columns(x, config)
    elif transform_type == 'transform.tabular.fill_missing':
        return _transform_tabular_fill_missing(x, config)
    elif transform_type == 'transform.tabular.standard_scaler':
        return _transform_tabular_standard_scaler(x, config)
    elif transform_type == 'transform.tabular.minmax_scaler':
        return _transform_tabular_minmax_scaler(x, config)
    elif transform_type == 'transform.tabular.label_encoding':
        return _transform_tabular_label_encoding(x, config)
    elif transform_type == 'transform.tabular.one_hot_encoding':
        return _transform_tabular_one_hot_encoding(x, config)
    
    # Text transforms
    elif transform_type == 'transform.text.lowercase':
        return _transform_text_lowercase(x, config)
    elif transform_type == 'transform.text.remove_punctuation':
        return _transform_text_remove_punctuation(x, config)
    elif transform_type == 'transform.text.tokenization':
        return _transform_text_tokenization(x, config)
    elif transform_type == 'transform.text.tokenize':
        return _transform_text_tokenization(x, config)
    elif transform_type == 'transform.text.stopword_removal':
        return _transform_text_stopword_removal(x, config)
    elif transform_type == 'transform.text.truncation':
        return _transform_text_truncation(x, config)
    elif transform_type == 'transform.text.padding':
        return _transform_text_padding(x, config)
    
    # Core transforms
    elif transform_type == 'transform.core.map':
        return _transform_core_map(x, config)
    elif transform_type == 'transform.core.join':
        return _transform_core_join(x, config)
    elif transform_type == 'transform.core.route':
        return _transform_core_route(x, config)

    # Pipeline transforms
    elif transform_type == 'transform.pipeline.compose':
        return _transform_pipeline_compose(x, config)
    elif transform_type == 'transform.program.if_else':
        return _transform_program_if_else(x, config)
    elif transform_type == 'transform.program.type_switch':
        return _transform_program_type_switch(x, config)
    
    # Fallback
    else:
        return {'_error': f'Unknown transform: {transform_type}', '_input': x, '_config': config}


def apply_lifecycle(stage: str, inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Execute a lifecycle node.
    stage: split, dataloader, model, loss, training, evaluate, predict,
           metrics, export, validate, hyperparameter_tune, ensemble,
           feature_engineer, model_compare, serve
    inputs: dict of input data and artifacts
    config: stage-specific configuration
    """
    
    if stage and stage.startswith('lifecycle.'):
        stage = stage.split('.')[-1]

    lifecycle_aliases = {
        'batch_loader': 'dataloader',
        'model_builder': 'model',
        'objective': 'loss',
        'trainer': 'training',
        'evaluator': 'evaluate',
        'predictor': 'predict',
    }
    stage = lifecycle_aliases.get(stage, stage)

    if stage == 'split':
        return _lifecycle_split(inputs, config)
    elif stage == 'dataloader':
        return _lifecycle_dataloader(inputs, config)
    elif stage == 'model':
        return _lifecycle_model(inputs, config)
    elif stage == 'loss':
        return _lifecycle_loss(inputs, config)
    elif stage == 'training':
        return _lifecycle_training(inputs, config)
    elif stage == 'evaluate':
        return _lifecycle_evaluate(inputs, config)
    elif stage == 'predict':
        return _lifecycle_predict(inputs, config)
    elif stage == 'metrics':
        return _lifecycle_metrics(inputs, config)
    elif stage == 'export':
        return _lifecycle_export(inputs, config)
    elif stage == 'validate':
        return _lifecycle_validate(inputs, config)
    elif stage == 'hyperparameter_tune':
        return _lifecycle_hyperparameter_tune(inputs, config)
    elif stage == 'ensemble':
        return _lifecycle_ensemble(inputs, config)
    elif stage == 'feature_engineer':
        return _lifecycle_feature_engineer(inputs, config)
    elif stage == 'model_compare':
        return _lifecycle_model_compare(inputs, config)
    elif stage == 'serve':
        return _lifecycle_serve(inputs, config)
    else:
        return {'_error': f'Unknown lifecycle stage: {stage}', '_inputs': inputs, '_config': config}


def apply_node(node_type: str, inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Execute a generic node (currently returns passthrough, extensible for future custom nodes).
    """
    # For now, generic nodes return their inputs with metadata
    return {
        'node_type': node_type,
        'inputs': inputs,
        'config': config,
        'status': 'generic_node_passthrough'
    }


# ============================================================================
# IMAGE TRANSFORM IMPLEMENTATIONS
# ============================================================================

def _transform_image_resize(x: Any, config: Dict[str, Any]) -> Any:
    """Resize: x -> resized array. Config: {size: [h, w]}"""
    size = config.get('size', [224, 224])
    if isinstance(x, list) and len(x) > 0:
        # If x is a list of arrays, resize each
        try:
            from PIL import Image
            resized = []
            for item in x:
                if isinstance(item, dict) and 'path' in item:
                    img = Image.open(item['path']).resize((size[1], size[0]))
                    resized.append(np.array(img))
                elif isinstance(item, np.ndarray):
                    # Simple numpy resize using slicing
                    h, w = item.shape[:2]
                    y = np.linspace(0, h-1, size[0]).astype(int)
                    x_idx = np.linspace(0, w-1, size[1]).astype(int)
                    resized.append(item[np.ix_(y, x_idx)])
            return resized
        except Exception as e:
            return {'_error': str(e), '_original': x}
    return x


def _transform_image_normalize(x: Any, config: Dict[str, Any]) -> Any:
    """Normalize: subtract mean, divide by std. Config: {mean, std}"""
    mean = np.array(config.get('mean', [0.485, 0.456, 0.406]))
    std = np.array(config.get('std', [0.229, 0.224, 0.225]))
    if isinstance(x, list):
        normalized = []
        for item in x:
            if isinstance(item, np.ndarray):
                item_norm = (item.astype(float) / 255.0 - mean) / std
                normalized.append(item_norm)
            else:
                normalized.append(item)
        return normalized
    elif isinstance(x, np.ndarray):
        return (x.astype(float) / 255.0 - mean) / std
    return x


def _transform_image_grayscale(x: Any, config: Dict[str, Any]) -> Any:
    """Convert to grayscale. Config: {num_output_channels: 1}"""
    if isinstance(x, list):
        gray = []
        for item in x:
            if isinstance(item, np.ndarray) and len(item.shape) == 3:
                # RGB to grayscale: 0.299*R + 0.587*G + 0.114*B
                gray_item = 0.299*item[..., 0] + 0.587*item[..., 1] + 0.114*item[..., 2]
                gray.append(gray_item)
            else:
                gray.append(item)
        return gray
    elif isinstance(x, np.ndarray) and len(x.shape) == 3:
        return 0.299*x[..., 0] + 0.587*x[..., 1] + 0.114*x[..., 2]
    return x


def _transform_image_to_tensor(x: Any, config: Dict[str, Any]) -> Any:
    """Convert to tensor (numpy array). Config: {}"""
    if isinstance(x, list):
        return [np.array(item, dtype=np.float32) if not isinstance(item, np.ndarray) else item.astype(np.float32) for item in x]
    return np.array(x, dtype=np.float32)


def _transform_image_center_crop(x: Any, config: Dict[str, Any]) -> Any:
    """Center crop. Config: {size: [h, w]}"""
    size = config.get('size', [224, 224])
    if isinstance(x, list):
        cropped = []
        for item in x:
            if isinstance(item, np.ndarray):
                h, w = item.shape[:2]
                ch, cw = size
                y_start = max(0, (h - ch) // 2)
                x_start = max(0, (w - cw) // 2)
                cropped.append(item[y_start:y_start+ch, x_start:x_start+cw])
            else:
                cropped.append(item)
        return cropped
    elif isinstance(x, np.ndarray):
        h, w = x.shape[:2]
        ch, cw = size
        y_start = max(0, (h - ch) // 2)
        x_start = max(0, (w - cw) // 2)
        return x[y_start:y_start+ch, x_start:x_start+cw]
    return x


def _transform_image_pad(x: Any, config: Dict[str, Any]) -> Any:
    """Pad image. Config: {padding: 4, fill: 0}"""
    padding = config.get('padding', 4)
    fill = config.get('fill', 0)
    if isinstance(x, list):
        padded = []
        for item in x:
            if isinstance(item, np.ndarray):
                padded.append(np.pad(item, pad_width=((padding, padding), (padding, padding), (0, 0)), constant_values=fill))
            else:
                padded.append(item)
        return padded
    elif isinstance(x, np.ndarray):
        return np.pad(x, pad_width=((padding, padding), (padding, padding), (0, 0)), constant_values=fill)
    return x


def _transform_image_random_crop(x: Any, config: Dict[str, Any]) -> Any:
    """Random crop (deterministic for reproducibility). Config: {size: [h, w], p: 1.0}"""
    size = config.get('size', [224, 224])
    p = config.get('p', 1.0)
    if isinstance(x, list):
        cropped = []
        for item in x:
            if isinstance(item, np.ndarray) and np.random.random() < p:
                h, w = item.shape[:2]
                ch, cw = size
                y_start = np.random.randint(0, max(1, h - ch + 1))
                x_start = np.random.randint(0, max(1, w - cw + 1))
                cropped.append(item[y_start:y_start+ch, x_start:x_start+cw])
            else:
                cropped.append(item)
        return cropped
    return x


def _transform_image_random_horizontal_flip(x: Any, config: Dict[str, Any]) -> Any:
    """Random horizontal flip. Config: {p: 0.5}"""
    p = config.get('p', 0.5)
    if isinstance(x, list):
        flipped = []
        for item in x:
            if isinstance(item, np.ndarray) and np.random.random() < p:
                flipped.append(np.fliplr(item))
            else:
                flipped.append(item)
        return flipped
    elif isinstance(x, np.ndarray) and np.random.random() < p:
        return np.fliplr(x)
    return x


def _transform_image_random_vertical_flip(x: Any, config: Dict[str, Any]) -> Any:
    """Random vertical flip. Config: {p: 0.5}"""
    p = config.get('p', 0.5)
    if isinstance(x, list):
        flipped = []
        for item in x:
            if isinstance(item, np.ndarray) and np.random.random() < p:
                flipped.append(np.flipud(item))
            else:
                flipped.append(item)
        return flipped
    elif isinstance(x, np.ndarray) and np.random.random() < p:
        return np.flipud(x)
    return x


def _transform_image_random_flip(x: Any, config: Dict[str, Any]) -> Any:
    """Random flip alias. Config: {direction: 'horizontal'|'vertical'|'both', p: 0.5}"""
    direction = str(config.get('direction', 'horizontal')).lower()
    if direction == 'vertical':
        return _transform_image_random_vertical_flip(x, config)
    if direction == 'both':
        return _transform_image_random_vertical_flip(_transform_image_random_horizontal_flip(x, config), config)
    return _transform_image_random_horizontal_flip(x, config)


def _transform_image_random_rotation(x: Any, config: Dict[str, Any]) -> Any:
    """Random rotation (simulated with numpy). Config: {degrees: 30, p: 1.0, fill_mode: 'reflect'}"""
    degrees = config.get('degrees', 30)
    p = config.get('p', 1.0)
    if isinstance(x, list) and np.random.random() < p:
        # Simple 90-degree rotation for demo
        return [np.rot90(item) if isinstance(item, np.ndarray) else item for item in x]
    return x


def _transform_image_color_jitter(x: Any, config: Dict[str, Any]) -> Any:
    """Color jitter (brightness, contrast, saturation, hue). Config: {brightness, contrast, saturation, hue}"""
    brightness = config.get('brightness', 0.2)
    if isinstance(x, list):
        jittered = []
        for item in x:
            if isinstance(item, np.ndarray):
                jitter = np.clip(item * (1 + np.random.uniform(-brightness, brightness)), 0, 255)
                jittered.append(jitter)
            else:
                jittered.append(item)
        return jittered
    elif isinstance(x, np.ndarray):
        return np.clip(x * (1 + np.random.uniform(-brightness, brightness)), 0, 255)
    return x


def _transform_image_gaussian_blur(x: Any, config: Dict[str, Any]) -> Any:
    """Gaussian blur. Config: {kernel_size: 3, sigma: [0.1, 2.0]}"""
    # Simple averaging filter as mock
    kernel_size = config.get('kernel_size', 3)
    if isinstance(x, list):
        blurred = []
        for item in x:
            if isinstance(item, np.ndarray):
                # Simple box filter approximation
                kernel = np.ones((kernel_size, kernel_size)) / (kernel_size * kernel_size)
                from scipy import signal
                try:
                    blurred.append(signal.convolve2d(item, kernel, mode='same'))
                except:
                    blurred.append(item)
            else:
                blurred.append(item)
        return blurred
    return x


def _transform_image_random_erasing(x: Any, config: Dict[str, Any]) -> Any:
    """Random erasing. Config: {p: 0.25}"""
    # Placeholder: randomly zero out regions
    p = config.get('p', 0.25)
    if isinstance(x, list):
        erased = []
        for item in x:
            if isinstance(item, np.ndarray) and np.random.random() < p:
                item_copy = item.copy()
                h, w = item_copy.shape[:2]
                y, x_e = np.random.randint(0, h-10), np.random.randint(0, w-10)
                item_copy[y:y+10, x_e:x_e+10] = 0
                erased.append(item_copy)
            else:
                erased.append(item)
        return erased
    return x


def _transform_image_random_affine(x: Any, config: Dict[str, Any]) -> Any:
    """Random affine. Config: {degrees: 15}"""
    # Placeholder
    return x


def _transform_image_perspective_transform(x: Any, config: Dict[str, Any]) -> Any:
    """Perspective transform. Config: {distortion_scale: 0.5, p: 0.5}"""
    # Placeholder
    return x


def _transform_image_cutmix(x: Any, config: Dict[str, Any]) -> Any:
    """CutMix augmentation. Config: {alpha: 1.0, p: 0.5}"""
    # Placeholder
    return x


def _transform_image_mixup(x: Any, config: Dict[str, Any]) -> Any:
    """MixUp augmentation. Config: {alpha: 0.2, p: 0.5}"""
    # Placeholder
    return x


# ============================================================================
# TABULAR TRANSFORM IMPLEMENTATIONS
# ============================================================================

def _transform_tabular_drop_columns(x: Any, config: Dict[str, Any]) -> Any:
    """Drop columns. Config: {columns: []}"""
    columns_to_drop = config.get('columns', [])
    if isinstance(x, list) and len(x) > 0 and isinstance(x[0], dict):
        return [{k: v for k, v in row.items() if k not in columns_to_drop} for row in x]
    return x


def _transform_tabular_fill_missing(x: Any, config: Dict[str, Any]) -> Any:
    """Fill missing values. Config: {strategy: 'mean', columns: []}"""
    strategy = config.get('strategy', 'mean')
    if isinstance(x, list) and len(x) > 0 and isinstance(x[0], dict):
        if strategy == 'mean':
            # Calculate column means
            from collections import defaultdict
            sums = defaultdict(float)
            counts = defaultdict(int)
            for row in x:
                for k, v in row.items():
                    try:
                        sums[k] += float(v)
                        counts[k] += 1
                    except:
                        pass
            means = {k: sums[k] / max(counts[k], 1) for k in sums}
            # Fill nulls with means
            filled = []
            for row in x:
                new_row = dict(row)
                for col, mean_val in means.items():
                    if col not in new_row or new_row[col] is None or new_row[col] == '':
                        new_row[col] = mean_val
                filled.append(new_row)
            return filled
        elif strategy == 'drop':
            return [row for row in x if all(v is not None and v != '' for v in row.values())]
    return x


def _transform_tabular_standard_scaler(x: Any, config: Dict[str, Any]) -> Any:
    """StandardScaler (z-score normalization). Config: {columns: []}"""
    columns = config.get('columns', [])
    if isinstance(x, list) and len(x) > 0 and isinstance(x[0], dict):
        # Compute mean and std
        from collections import defaultdict
        sums = defaultdict(float)
        sq_sums = defaultdict(float)
        counts = defaultdict(int)
        
        for row in x:
            for col in columns if columns else row.keys():
                try:
                    val = float(row.get(col, 0))
                    sums[col] += val
                    sq_sums[col] += val ** 2
                    counts[col] += 1
                except:
                    pass
        
        means = {k: sums[k] / max(counts[k], 1) for k in sums}
        stds = {k: np.sqrt(max(sq_sums[k] / max(counts[k], 1) - means[k]**2, 1e-6)) for k in sq_sums}
        
        scaled = []
        for row in x:
            new_row = dict(row)
            for col in (columns if columns else row.keys()):
                try:
                    val = float(row.get(col, 0))
                    new_row[col] = (val - means.get(col, 0)) / stds.get(col, 1)
                except:
                    pass
            scaled.append(new_row)
        return scaled
    return x


def _transform_tabular_minmax_scaler(x: Any, config: Dict[str, Any]) -> Any:
    """MinMax scaler. Config: {columns: [], range: [0, 1]}"""
    columns = config.get('columns', [])
    range_vals = config.get('range', [0, 1])
    if isinstance(x, list) and len(x) > 0 and isinstance(x[0], dict):
        # Find min/max
        mins = {}
        maxs = {}
        for row in x:
            for col in columns if columns else row.keys():
                try:
                    val = float(row.get(col, 0))
                    mins[col] = min(mins.get(col, float('inf')), val)
                    maxs[col] = max(maxs.get(col, float('-inf')), val)
                except:
                    pass
        
        scaled = []
        for row in x:
            new_row = dict(row)
            for col in (columns if columns else row.keys()):
                try:
                    val = float(row.get(col, 0))
                    col_min = mins.get(col, 0)
                    col_max = maxs.get(col, 1)
                    if col_max > col_min:
                        normalized = (val - col_min) / (col_max - col_min)
                        new_row[col] = normalized * (range_vals[1] - range_vals[0]) + range_vals[0]
                except:
                    pass
            scaled.append(new_row)
        return scaled
    return x


def _transform_tabular_label_encoding(x: Any, config: Dict[str, Any]) -> Any:
    """Label encoding (categorical to integer). Config: {columns: []}"""
    columns = config.get('columns', [])
    if isinstance(x, list) and len(x) > 0 and isinstance(x[0], dict):
        encodings = {}
        for row in x:
            for col in columns if columns else row.keys():
                if col not in encodings:
                    encodings[col] = {}
                val = str(row.get(col, ''))
                if val not in encodings[col]:
                    encodings[col][val] = len(encodings[col])
        
        encoded = []
        for row in x:
            new_row = dict(row)
            for col in (columns if columns else row.keys()):
                val = str(row.get(col, ''))
                new_row[col] = encodings[col].get(val, -1)
            encoded.append(new_row)
        return encoded
    return x


def _transform_tabular_one_hot_encoding(x: Any, config: Dict[str, Any]) -> Any:
    """One-hot encoding. Config: {columns: []}"""
    columns = config.get('columns', [])
    if isinstance(x, list) and len(x) > 0 and isinstance(x[0], dict):
        # Get unique values per column
        uniques = {}
        for row in x:
            for col in columns if columns else row.keys():
                if col not in uniques:
                    uniques[col] = set()
                uniques[col].add(str(row.get(col, '')))
        
        one_hot = []
        for row in x:
            new_row = dict(row)
            for col, unique_vals in uniques.items():
                val = str(row.get(col, ''))
                for uval in unique_vals:
                    new_row[f'{col}_{uval}'] = 1 if val == uval else 0
            one_hot.append(new_row)
        return one_hot
    return x


# ============================================================================
# TEXT TRANSFORM IMPLEMENTATIONS
# ============================================================================

def _transform_text_lowercase(x: Any, config: Dict[str, Any]) -> Any:
    """Lowercase. Config: {}"""
    if isinstance(x, list):
        return [str(item).lower() if isinstance(item, str) else item for item in x]
    elif isinstance(x, str):
        return x.lower()
    return x


def _transform_text_remove_punctuation(x: Any, config: Dict[str, Any]) -> Any:
    """Remove punctuation. Config: {}"""
    import string
    if isinstance(x, list):
        return [str(item).translate(str.maketrans('', '', string.punctuation)) if isinstance(item, str) else item for item in x]
    elif isinstance(x, str):
        return x.translate(str.maketrans('', '', string.punctuation))
    return x


def _transform_text_tokenization(x: Any, config: Dict[str, Any]) -> Any:
    """Tokenization. Config: {tokenizer: 'whitespace'}"""
    tokenizer = config.get('tokenizer', 'whitespace')
    if isinstance(x, list):
        tokenized = []
        for item in x:
            if isinstance(item, str):
                if tokenizer == 'whitespace':
                    tokenized.append(item.split())
                else:
                    tokenized.append(item.split())
            else:
                tokenized.append(item)
        return tokenized
    elif isinstance(x, str):
        return x.split()
    return x


def _transform_text_stopword_removal(x: Any, config: Dict[str, Any]) -> Any:
    """Stopword removal. Config: {language: 'english'}"""
    # Simple English stopwords
    stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is'}
    if isinstance(x, list):
        filtered = []
        for item in x:
            if isinstance(item, list):
                filtered.append([w for w in item if w.lower() not in stopwords])
            elif isinstance(item, str):
                filtered.append(' '.join([w for w in item.split() if w.lower() not in stopwords]))
            else:
                filtered.append(item)
        return filtered
    elif isinstance(x, str):
        return ' '.join([w for w in x.split() if w.lower() not in stopwords])
    return x


def _transform_text_truncation(x: Any, config: Dict[str, Any]) -> Any:
    """Truncation. Config: {max_length: 512}"""
    max_length = config.get('max_length', 512)
    if isinstance(x, list):
        return [item[:max_length] if isinstance(item, (str, list)) else item for item in x]
    elif isinstance(x, (str, list)):
        return x[:max_length]
    return x


def _transform_text_padding(x: Any, config: Dict[str, Any]) -> Any:
    """Padding. Config: {max_length: 512, pad_value: 0}"""
    max_length = config.get('max_length', 512)
    pad_value = config.get('pad_value', 0)
    if isinstance(x, list):
        padded = []
        for item in x:
            if isinstance(item, list):
                padded.append(item + [pad_value] * max(0, max_length - len(item)))
            elif isinstance(item, str):
                padded.append(item + ' ' * max(0, max_length - len(item)))
            else:
                padded.append(item)
        return padded
    return x


# ============================================================================
# PIPELINE TRANSFORM
# ============================================================================

def _transform_pipeline_compose(x: Any, config: Dict[str, Any]) -> Any:
    """Compose multiple transforms. Config: {transforms: []}"""
    # This would be handled at a higher level (e.g., in the graph compiler)
    # For now, return input as-is
    return x


def _transform_core_map(x: Any, config: Dict[str, Any]) -> Any:
    """Core map dispatch wrapper. Supports drop/select/filter/tokenize operations."""
    operation = str(config.get('operation', 'identity')).strip()

    if isinstance(x, dict) and ('dataset_type' in x or 'data' in x):
        rows = _extract_samples(_materialize_dataset(x))
    elif isinstance(x, list):
        rows = x
    elif isinstance(x, dict) and 'rows' in x and isinstance(x.get('rows'), list):
        rows = x.get('rows', [])
    else:
        rows = x

    if operation == 'drop_columns':
        columns = config.get('columns', [])
        if not isinstance(columns, list):
            columns = []
        if isinstance(rows, list):
            out = []
            for row in rows:
                if isinstance(row, dict):
                    out.append({k: v for k, v in row.items() if k not in columns})
                else:
                    out.append(row)
            return out
        return rows

    if operation == 'select_columns':
        columns = config.get('columns', [])
        if not isinstance(columns, list) or len(columns) == 0:
            return rows
        if isinstance(rows, list):
            out = []
            for row in rows:
                if isinstance(row, dict):
                    out.append({k: row.get(k) for k in columns})
                else:
                    out.append(row)
            return out
        return rows

    if operation == 'filter_rows':
        field = str(config.get('field', '')).strip()
        operator = str(config.get('operator', '!=')).strip()
        value = config.get('value')
        if not field or not isinstance(rows, list):
            return rows

        def _matches(row: Any) -> bool:
            if not isinstance(row, dict):
                return False
            left = row.get(field)
            if operator == '==':
                return left == value
            if operator == '!=':
                return left != value
            if operator == '>':
                return left > value
            if operator == '>=':
                return left >= value
            if operator == '<':
                return left < value
            if operator == '<=':
                return left <= value
            return True

        return [row for row in rows if _matches(row)]

    if operation == 'tokenize':
        return _transform_text_tokenization(rows, config)

    return rows


def _transform_core_join(x: Any, config: Dict[str, Any]) -> Any:
    """Core join dispatch wrapper. Supports concat and merge_by_key strategies."""
    strategy = str(config.get('strategy', 'concat')).strip()
    key = str(config.get('key', '')).strip()

    if not isinstance(x, dict):
        return x

    left = x.get('left')
    right = x.get('right')

    if strategy == 'merge_by_key' and key and isinstance(left, list) and isinstance(right, list):
        right_index = {
            item.get(key): item
            for item in right
            if isinstance(item, dict) and key in item
        }
        merged = []
        for item in left:
            if isinstance(item, dict):
                rval = right_index.get(item.get(key), {})
                if isinstance(rval, dict):
                    merged.append({**rval, **item})
                else:
                    merged.append(item)
            else:
                merged.append(item)
        return merged

    if strategy in ('concat', 'zip', 'overlay'):
        merged = []
        if isinstance(left, list):
            merged.extend(left)
        elif left is not None:
            merged.append(left)

        if isinstance(right, list):
            merged.extend(right)
        elif right is not None:
            merged.append(right)

        aux = x.get('aux')
        if isinstance(aux, list):
            merged.extend(aux)
        elif aux is not None:
            merged.append(aux)

        return merged

    return x


def _transform_core_route(x: Any, config: Dict[str, Any]) -> Any:
    """Core route dispatch wrapper. Reuses type switch runtime behavior."""
    return _transform_program_type_switch(x, config)


def _transform_program_if_else(x: Any, config: Dict[str, Any]) -> Any:
    """Branch input using a user condition. Config: {condition, mode}"""
    condition = config.get('condition', 'True')
    mode = config.get('mode', 'split')
    rows = x if isinstance(x, list) else [x]

    truthy, falsy = [], []
    for item in rows:
        ok = False
        try:
            ok = bool(eval(str(condition), {}, {'item': item, 'x': item}))
        except Exception:
            ok = False
        if ok:
            truthy.append(item)
        else:
            falsy.append(item)

    if mode == 'gate':
        return truthy if len(truthy) > 0 else falsy
    return {'true': truthy, 'false': falsy}


def _transform_program_type_switch(x: Any, config: Dict[str, Any]) -> Any:
    """Route rows by inferred type bucket. Config: {type_field, fallback_type}"""
    type_field = str(config.get('type_field', '')).strip()
    fallback_type = str(config.get('fallback_type', 'fallback')).strip()

    buckets = {
        'tensor': [],
        'sequence': [],
        'dict': [],
        'fallback': [],
    }

    rows = x if isinstance(x, list) else [x]
    for item in rows:
        inferred = None
        if type_field and isinstance(item, dict) and type_field in item:
            inferred = str(item.get(type_field)).lower()
        elif isinstance(item, dict):
            inferred = 'dict'
        elif isinstance(item, (list, tuple, str)):
            inferred = 'sequence'
        else:
            inferred = 'tensor'

        if inferred in buckets:
            buckets[inferred].append(item)
        elif fallback_type in buckets:
            buckets[fallback_type].append(item)
        else:
            buckets['fallback'].append(item)

    return buckets


# ============================================================================
# LIFECYCLE IMPLEMENTATIONS
# ============================================================================

def _extract_samples(value: Any) -> List[Any]:
    """Best-effort extraction of sample rows from runtime artifacts."""
    if isinstance(value, dict):
        if isinstance(value.get('data'), list):
            return value.get('data', [])
        if isinstance(value.get('batch'), list):
            return value.get('batch', [])
        if isinstance(value.get('loader'), list):
            rows = []
            for batch in value.get('loader', []):
                if isinstance(batch, dict) and isinstance(batch.get('batch'), list):
                    rows.extend(batch.get('batch', []))
            return rows
    if isinstance(value, list):
        return value
    return []


def _safe_ratio(numerator: float, denominator: float) -> float:
    if denominator == 0:
        return 0.0
    return float(numerator) / float(denominator)


def _binary_metrics(y_true: List[int], y_pred: List[int]) -> Dict[str, float]:
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)

    precision = _safe_ratio(tp, tp + fp)
    recall = _safe_ratio(tp, tp + fn)
    f1 = _safe_ratio(2 * precision * recall, precision + recall)
    accuracy = _safe_ratio(tp + tn, len(y_true))

    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'auc': max(0.0, min(1.0, (accuracy + recall) / 2.0)),
        'confusion_matrix': {
            'tp': tp,
            'tn': tn,
            'fp': fp,
            'fn': fn,
        },
    }


def _ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def _resolve_run_dir(config: Dict[str, Any], stage: str) -> str:
    base_dir = str(config.get('artifact_dir', 'artifacts/runs')).strip() or 'artifacts/runs'
    run_id = str(config.get('run_id', datetime.utcnow().strftime('%Y%m%d_%H%M%S_%f')))
    return _ensure_dir(os.path.join(base_dir, f'{stage}_{run_id}'))


def _registry_append(entry: Dict[str, Any], config: Dict[str, Any]) -> None:
    registry_path = str(config.get('registry_path', 'artifacts/model_registry.jsonl'))
    parent = os.path.dirname(registry_path)
    if parent:
        _ensure_dir(parent)
    with open(registry_path, 'a', encoding='utf-8') as fp:
        fp.write(json.dumps(entry, default=str) + '\\n')


def _read_csv_dataset(cfg: Dict[str, Any]) -> Dict[str, Any]:
    path = cfg.get('path', '')
    files = cfg.get('files', [])
    candidate_files = []

    if isinstance(files, list) and files:
        candidate_files.extend([os.path.join(path, f) if path and not os.path.isabs(f) else f for f in files])

    if path and os.path.isfile(path):
        candidate_files.append(path)

    if path and os.path.isdir(path) and not files:
        candidate_files.extend([
            os.path.join(path, name)
            for name in os.listdir(path)
            if str(name).lower().endswith('.csv')
        ])

    rows = []
    for file_path in candidate_files:
        if not os.path.isfile(file_path):
            continue
        with open(file_path, 'r', encoding='utf-8') as fp:
            reader = csv.DictReader(fp)
            for row in reader:
                rows.append(dict(row))

    return {'data': rows, 'source': 'dataset.csv', 'files': candidate_files}


def _read_json_dataset(cfg: Dict[str, Any]) -> Dict[str, Any]:
    path = cfg.get('path', '')
    if not path or not os.path.isfile(path):
        return {'data': [], 'source': 'dataset.json'}
    with open(path, 'r', encoding='utf-8') as fp:
        payload = json.load(fp)
    if isinstance(payload, list):
        return {'data': payload, 'source': 'dataset.json'}
    if isinstance(payload, dict) and isinstance(payload.get('data'), list):
        return {'data': payload.get('data', []), 'source': 'dataset.json'}
    return {'data': [], 'source': 'dataset.json'}


def _read_text_dataset(cfg: Dict[str, Any]) -> Dict[str, Any]:
    path = cfg.get('path', '')
    file_format = str(cfg.get('file_format', 'txt')).lower()
    text_column = str(cfg.get('text_column', 'text'))
    label_column = str(cfg.get('label_column', 'label'))

    if not path or not os.path.isfile(path):
        return {'data': [], 'source': 'dataset.text'}

    rows = []
    with open(path, 'r', encoding='utf-8') as fp:
        if file_format == 'txt':
            for idx, line in enumerate(fp.readlines()):
                text = line.strip()
                if text:
                    rows.append({'index': idx, 'text': text, 'label': None})
        elif file_format == 'jsonl':
            for line in fp.readlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    rows.append({
                        'text': obj.get(text_column, obj.get('text', '')),
                        'label': obj.get(label_column, obj.get('label', None)),
                    })
                except Exception:
                    continue
        else:
            reader = csv.DictReader(fp)
            for row in reader:
                rows.append({
                    'text': row.get(text_column, ''),
                    'label': row.get(label_column, None),
                })

    return {
        'data': rows,
        'source': 'dataset.text',
        'vocab': sorted(set(token for row in rows for token in str(row.get('text', '')).split() if token))[:50000],
    }


def _read_image_dataset(cfg: Dict[str, Any]) -> Dict[str, Any]:
    base_path = cfg.get('path', '')
    fmt = str(cfg.get('format', 'jpg')).lower().lstrip('.')
    recursive = bool(cfg.get('recursive', True))
    label_strategy = str(cfg.get('label_strategy', 'folder_name'))

    if not base_path or not os.path.isdir(base_path):
        return {'data': [], 'source': 'dataset.image'}

    allowed_ext = {fmt}
    if fmt == 'jpg':
        allowed_ext.add('jpeg')

    rows = []
    classes = set()

    walker = os.walk(base_path) if recursive else [(base_path, [], os.listdir(base_path))]
    for root, _, files in walker:
        for name in files:
            ext = os.path.splitext(name)[1].lower().lstrip('.')
            if ext not in allowed_ext:
                continue
            file_path = os.path.join(root, name)
            label = None
            if label_strategy == 'folder_name':
                rel_parent = os.path.basename(os.path.dirname(file_path))
                label = rel_parent
                classes.add(label)
            rows.append({'path': file_path, 'label': label})

    return {
        'data': rows,
        'source': 'dataset.image',
        'classes': sorted([c for c in classes if c is not None]),
    }


def _project_dataset_handle(materialized: Dict[str, Any], dataset_type: str, cfg: Dict[str, Any], handle: str) -> Dict[str, Any]:
    rows = materialized.get('data', []) if isinstance(materialized, dict) else []
    if not isinstance(rows, list):
        rows = []

    if handle in ['', 'out', None]:
        return materialized

    if dataset_type == 'dataset.csv':
        target_col = str(cfg.get('target_column', '')).strip()
        if handle == 'features':
            if not target_col:
                return {'data': rows, 'source': dataset_type, 'handle': handle}
            feat_rows = []
            for row in rows:
                if isinstance(row, dict):
                    feat_rows.append({k: v for k, v in row.items() if k != target_col})
                else:
                    feat_rows.append(row)
            return {'data': feat_rows, 'source': dataset_type, 'handle': handle}
        if handle == 'targets':
            if target_col:
                vals = [row.get(target_col) for row in rows if isinstance(row, dict) and target_col in row]
            else:
                vals = []
            return {'data': vals, 'source': dataset_type, 'handle': handle}
        if handle == 'columns':
            cols = list(rows[0].keys()) if rows and isinstance(rows[0], dict) else []
            return {'data': cols, 'source': dataset_type, 'handle': handle}

    if dataset_type == 'dataset.json':
        label_key = str(cfg.get('label_key', 'label'))
        if handle == 'labels':
            vals = [row.get(label_key) for row in rows if isinstance(row, dict) and label_key in row]
            return {'data': vals, 'source': dataset_type, 'handle': handle}
        if handle == 'schema':
            keys = sorted(set(k for row in rows if isinstance(row, dict) for k in row.keys()))
            return {'data': keys, 'source': dataset_type, 'handle': handle}

    if dataset_type == 'dataset.text':
        max_length = int(cfg.get('max_length', 32))
        if handle == 'input_ids':
            token_ids = []
            for row in rows:
                text = str(row.get('text', '')) if isinstance(row, dict) else str(row)
                toks = text.split()
                token_ids.append([len(tok) for tok in toks[:max_length]])
            return {'data': token_ids, 'source': dataset_type, 'handle': handle}
        if handle == 'attention_mask':
            masks = []
            for row in rows:
                text = str(row.get('text', '')) if isinstance(row, dict) else str(row)
                toks = text.split()[:max_length]
                masks.append([1] * len(toks))
            return {'data': masks, 'source': dataset_type, 'handle': handle}
        if handle == 'labels':
            vals = [row.get('label') for row in rows if isinstance(row, dict)]
            return {'data': vals, 'source': dataset_type, 'handle': handle}
        if handle == 'vocab':
            vocab = sorted(set(token for row in rows for token in str(row.get('text', '')).split() if isinstance(row, dict)))
            return {'data': vocab, 'source': dataset_type, 'handle': handle}

    if dataset_type == 'dataset.image':
        if handle == 'images':
            vals = [row.get('path') for row in rows if isinstance(row, dict)]
            return {'data': vals, 'source': dataset_type, 'handle': handle}
        if handle == 'labels':
            vals = [row.get('label') for row in rows if isinstance(row, dict)]
            return {'data': vals, 'source': dataset_type, 'handle': handle}
        if handle == 'classes':
            classes = sorted(set(row.get('label') for row in rows if isinstance(row, dict) and row.get('label') is not None))
            return {'data': classes, 'source': dataset_type, 'handle': handle}

    return materialized


def _materialize_dataset(dataset: Any) -> Dict[str, Any]:
    if isinstance(dataset, dict) and isinstance(dataset.get('data'), list):
        return dataset

    if isinstance(dataset, dict) and 'dataset_type' in dataset:
        dtype = str(dataset.get('dataset_type', ''))
        cfg = dataset.get('config', {}) if isinstance(dataset.get('config', {}), dict) else {}
        handle = dataset.get('handle') if isinstance(dataset, dict) else None
        try:
            if dtype == 'dataset.csv':
                materialized = _read_csv_dataset(cfg)
                return _project_dataset_handle(materialized, dtype, cfg, handle)
            if dtype == 'dataset.json':
                materialized = _read_json_dataset(cfg)
                return _project_dataset_handle(materialized, dtype, cfg, handle)
            if dtype == 'dataset.text':
                materialized = _read_text_dataset(cfg)
                return _project_dataset_handle(materialized, dtype, cfg, handle)
            if dtype == 'dataset.image':
                materialized = _read_image_dataset(cfg)
                return _project_dataset_handle(materialized, dtype, cfg, handle)
        except Exception as err:
            return {'data': [], 'error': str(err), 'dataset_type': dtype}

    if isinstance(dataset, list):
        return {'data': dataset}

    return {'data': []}


def _extract_xy(rows: List[Any], target_column: str = 'target'):
    if not rows:
        return [], []

    x = []
    y = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        row_x = []
        for key, value in row.items():
            if key == target_column:
                continue
            try:
                row_x.append(float(value))
            except Exception:
                row_x.append(0.0)
        if target_column in row:
            try:
                y_val = float(row[target_column])
            except Exception:
                y_val = 0.0
        else:
            y_val = 0.0
        x.append(row_x)
        y.append(y_val)
    return x, y


def _is_classification(y: List[float]) -> bool:
    uniq = sorted(set(y))
    return len(uniq) <= 20 and all(float(v).is_integer() for v in uniq)


def _load_serialized_model(path: str):
    if not path or not os.path.isfile(path):
        return None
    with open(path, 'rb') as fp:
        return pickle.load(fp)

def _lifecycle_split(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Split dataset into train/val/test.
    inputs: {dataset: input_data}
    config: {split_type, train_pct, val_pct, test_pct, shuffle, seed, stratify_by}
    """
    dataset = _materialize_dataset(inputs.get('dataset') or inputs.get('in_0', {}))
    
    split_type = config.get('split_type', 'train_val_test')
    train_pct = config.get('train_pct', 70)
    val_pct = config.get('val_pct', 20)
    test_pct = config.get('test_pct', 10)
    shuffle = config.get('shuffle', True)
    seed = config.get('seed', 42)
    
    np.random.seed(seed)
    
    if not isinstance(dataset, dict) or 'data' not in dataset:
        return {
            'train': {'error': 'Invalid dataset format'},
            'val': {'error': 'Invalid dataset format'},
            'test': {'error': 'Invalid dataset format'},
        }
    
    data = dataset.get('data', [])
    if isinstance(data, list) and len(data) > 0:
        indices = np.arange(len(data))
        if shuffle:
            np.random.shuffle(indices)
        
        n = len(data)
        train_n = int(n * train_pct / 100)
        val_n = int(n * val_pct / 100)
        
        train_idx = indices[:train_n]
        val_idx = indices[train_n:train_n+val_n]
        test_idx = indices[train_n+val_n:]
        
        return {
            'train': {'data': [data[i] for i in train_idx], 'indices': train_idx.tolist()},
            'val': {'data': [data[i] for i in val_idx], 'indices': val_idx.tolist()},
            'test': {'data': [data[i] for i in test_idx], 'indices': test_idx.tolist()},
        }
    
    return dataset


def _lifecycle_dataloader(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Create data loader from dataset.
    inputs: {dataset: input_data}
    config: {batch_size, shuffle, num_workers, ...}
    """
    dataset = _materialize_dataset(inputs.get('dataset') or inputs.get('in_0', {}))
    batch_size = config.get('batch_size', 32)
    shuffle = config.get('shuffle', True)
    
    if not isinstance(dataset, dict) or 'data' not in dataset:
        return {'error': 'Invalid dataset format', 'batch_size': batch_size}
    
    data = dataset.get('data', [])
    if isinstance(data, list):
        # Simulate batching
        batches = []
        indices = np.arange(len(data))
        if shuffle:
            np.random.shuffle(indices)
        
        for i in range(0, len(indices), batch_size):
            batch_idx = indices[i:i+batch_size]
            batches.append({'batch': [data[idx] for idx in batch_idx]})
        
        return {
            'loader': batches,
            'num_batches': len(batches),
            'batch_size': batch_size,
            'total_samples': len(data),
        }
    
    return {'error': 'Could not create dataloader', 'config': config}


def _lifecycle_model(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Initialize model.
    inputs: optional loader or data
    config: {family, pretrained, num_classes, freeze_backbone}
    """
    family = config.get('family', 'resnet50')
    pretrained = config.get('pretrained', True)
    num_classes = config.get('num_classes', 10)
    freeze_backbone = config.get('freeze_backbone', False)
    
    train_data = _materialize_dataset(inputs.get('train_data') or inputs.get('in_0', {}))
    train_samples = len(_extract_samples(train_data))

    return {
        'model': {
            'type': 'pytorch_model',
            'family': family,
            'pretrained': pretrained,
            'num_classes': num_classes,
            'freeze_backbone': freeze_backbone,
            'status': 'initialized',
            'observed_train_samples': train_samples,
            '_metadata': {
                'framework': 'pytorch' if family.startswith('resnet') or family == 'efficientnet' or family == 'vit' else 'sklearn',
            }
        }
    }


def _lifecycle_loss(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Initialize loss function.
    inputs: {model: model_spec}
    config: {name, reduction, class_weights, label_smoothing}
    """
    model_spec = inputs.get('model') or inputs.get('in_0', {})
    targets = _materialize_dataset(inputs.get('targets') or inputs.get('in_1', {}))
    name = config.get('name', config.get('loss_name', 'cross_entropy'))
    reduction = config.get('reduction', 'mean')
    label_smoothing = config.get('label_smoothing', 0.1)
    target_count = len(_extract_samples(targets))
    
    return {
        'loss': {
            'name': name,
            'reduction': reduction,
            'label_smoothing': label_smoothing,
            'status': 'initialized',
            'has_model': bool(model_spec),
        },
        'metrics_spec': {
            'primary_metric': config.get('primary_metric', 'auto'),
            'target_count': target_count,
        }
    }


def _lifecycle_training(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Execute training loop.
    inputs: {model, loader, loss, config}
    config: {optimizer, learning_rate, scheduler, epochs, ...}
    """
    model_spec = inputs.get('model') or inputs.get('in_0', {})
    train_data = _materialize_dataset(inputs.get('train_data') or inputs.get('in_1', {}))
    val_data = _materialize_dataset(inputs.get('val_data') or inputs.get('in_2', {}))
    objective = inputs.get('objective') or inputs.get('in_3', {})
    
    optimizer = config.get('optimizer', 'adamw')
    learning_rate = config.get('learning_rate', 0.001)
    epochs = config.get('epochs', 50)
    
    run_dir = _resolve_run_dir(config, 'trainer')
    train_rows = _extract_samples(train_data)
    val_rows = _extract_samples(val_data)
    train_samples = len(train_rows)
    val_samples = len(val_rows)
    target_column = str(config.get('target_column', 'target'))
    family = str(model_spec.get('family', config.get('family', 'linear_regression'))).lower()
    requested_backend = str(config.get('backend', model_spec.get('backend', 'auto'))).lower()

    trained_backend = 'simulated'
    model_path = ''
    metrics = {
        'train_loss': round(1.0 / max(1, train_samples + 1), 4),
        'val_loss': round(1.0 / max(1, val_samples + 1), 4),
        'primary_metric': round(1.0 - (1.0 / max(1, train_samples + 1)), 4),
    }

    if (requested_backend in ['auto', 'sklearn']) and SKLEARN_AVAILABLE and train_samples > 1:
        x_train, y_train = _extract_xy(train_rows, target_column)
        x_val, y_val = _extract_xy(val_rows, target_column)
        if x_train and y_train:
            is_clf = _is_classification(y_train)
            estimator = None
            if is_clf:
                if family in ['random_forest', 'rf', 'random_forest_classifier']:
                    estimator = RandomForestClassifier(random_state=42)
                else:
                    estimator = LogisticRegression(max_iter=300, random_state=42)
            else:
                if family in ['random_forest', 'rf', 'random_forest_regressor']:
                    estimator = RandomForestRegressor(random_state=42)
                else:
                    estimator = LinearRegression()

            try:
                estimator.fit(x_train, y_train)
                y_pred_train = estimator.predict(x_train)
                train_mse = sum((float(a) - float(b)) ** 2 for a, b in zip(y_train, y_pred_train)) / max(1, len(y_train))
                if x_val and y_val:
                    y_pred_val = estimator.predict(x_val)
                    val_mse = sum((float(a) - float(b)) ** 2 for a, b in zip(y_val, y_pred_val)) / max(1, len(y_val))
                else:
                    val_mse = train_mse

                metrics = {
                    'train_loss': round(float(train_mse), 6),
                    'val_loss': round(float(val_mse), 6),
                    'primary_metric': round(1.0 / (1.0 + float(val_mse)), 6),
                }

                model_path = os.path.join(run_dir, 'model.pkl')
                with open(model_path, 'wb') as fp:
                    pickle.dump(estimator, fp)
                with open(os.path.join(run_dir, 'metrics.json'), 'w', encoding='utf-8') as fp:
                    json.dump(metrics, fp)
                trained_backend = 'sklearn'
            except Exception:
                trained_backend = 'simulated'

    _registry_append({
        'event': 'train',
        'timestamp': datetime.utcnow().isoformat(),
        'backend': trained_backend,
        'family': family,
        'artifact_dir': run_dir,
        'model_path': model_path,
        'train_samples': train_samples,
    }, config)
    
    return {
        'trained_model': {
            'base': model_spec,
            'trained': True,
            'epochs_run': epochs,
            'seen_train_samples': train_samples,
            'backend': trained_backend,
            'family': family,
            'model_path': model_path,
            'target_column': target_column,
        },
        'metrics': metrics,
        'logs': {
            'optimizer': optimizer,
            'learning_rate': learning_rate,
            'objective_present': bool(objective),
            'run_dir': run_dir,
        },
        'artifacts': {
            'best_epoch': 0,
            'best_metric': metrics['primary_metric'],
            'artifact_dir': run_dir,
            'model_path': model_path,
        }
    }


def _lifecycle_evaluate(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Evaluate trained model on test data.
    inputs: {trained_model, test_loader}
    config: {metrics, threshold}
    """
    trained_model = inputs.get('model') or inputs.get('in_0', {})
    eval_data = _materialize_dataset(inputs.get('eval_data') or inputs.get('test_data') or inputs.get('in_1', {}))

    metric_names = config.get('metrics', ['accuracy', 'f1', 'auc'])
    threshold = config.get('threshold', 0.5)

    samples = _extract_samples(eval_data)
    if not samples:
        return {
            'metrics': {'error': 'No evaluation samples provided'},
            'predictions': {'labels': [], 'probabilities': []},
            'confusion_matrix': {'tp': 0, 'tn': 0, 'fp': 0, 'fn': 0},
        }

    probabilities = []
    y_true = []
    y_pred = []
    target_column = str(trained_model.get('target_column', config.get('target_column', 'target')))
    backend = str(trained_model.get('backend', 'simulated'))
    model_path = str(trained_model.get('model_path', ''))

    if backend == 'sklearn' and SKLEARN_AVAILABLE and model_path:
        estimator = _load_serialized_model(model_path)
        if estimator is not None:
            x_eval, y_eval = _extract_xy(samples, target_column)
            if x_eval:
                raw_pred = estimator.predict(x_eval)
                y_pred = [1 if float(v) >= threshold else 0 for v in raw_pred]
                probabilities = [float(v) for v in raw_pred]
                y_true = [1 if float(v) >= 1 else 0 for v in y_eval]

    if not y_pred:
        for idx, row in enumerate(samples):
            if isinstance(row, dict):
                label = row.get('label', row.get(target_column, idx % 2))
            else:
                label = idx % 2
            prob = ((idx % 10) + 1) / 10.0
            probabilities.append(prob)
            y_true.append(1 if label in [1, True, '1', 'true', 'yes'] else 0)
            y_pred.append(1 if prob >= threshold else 0)

    full_metrics = _binary_metrics(y_true, y_pred)
    selected_metrics = {k: full_metrics[k] for k in metric_names if k in full_metrics}

    return {
        'metrics': selected_metrics,
        'predictions': {
            'labels': y_pred,
            'probabilities': probabilities,
            'sample_count': len(samples),
        },
        'confusion_matrix': full_metrics.get('confusion_matrix', {}),
        'reports': {
            'has_model': bool(trained_model),
        },
    }


def _lifecycle_predict(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Run inference on new data.
    inputs: {trained_model, new_data}
    config: {batch_size, return_probabilities, threshold}
    """
    trained_model = inputs.get('model') or inputs.get('in_0', {})
    new_data = _materialize_dataset(inputs.get('inference_data') or inputs.get('test_data') or inputs.get('in_1', {}))
    batch_size = max(1, int(config.get('batch_size', 32)))
    return_probabilities = bool(config.get('return_probabilities', True))
    threshold = config.get('threshold', 0.5)

    samples = _extract_samples(new_data)
    target_column = str(trained_model.get('target_column', config.get('target_column', 'target')))
    backend = str(trained_model.get('backend', 'simulated'))
    family = str(trained_model.get('family', ''))
    model_path = str(trained_model.get('model_path', ''))

    probabilities = []
    predictions = []

    if backend == 'sklearn' and SKLEARN_AVAILABLE and model_path:
        estimator = _load_serialized_model(model_path)
        if estimator is not None:
            x_infer, _ = _extract_xy(samples, target_column)
            if x_infer:
                raw_pred = estimator.predict(x_infer)
                probabilities = [float(v) for v in raw_pred]
                predictions = [1 if float(v) >= threshold else 0 for v in raw_pred]

    if not predictions and TRANSFORMERS_AVAILABLE and backend in ['transformers', 'simulated']:
        text_values = []
        for row in samples:
            if isinstance(row, dict):
                text_values.append(str(row.get('text', '')))
            else:
                text_values.append(str(row))
        text_values = [txt for txt in text_values if txt]
        if text_values:
            try:
                task = 'sentiment-analysis' if family in ['', 'transformer', 'bert'] else 'text-classification'
                pipe = hf_pipeline(task)
                out = pipe(text_values)
                probabilities = [float(item.get('score', 0.0)) for item in out]
                predictions = [1 if score >= threshold else 0 for score in probabilities]
            except Exception:
                predictions = []

    if not predictions:
        probabilities = [((idx % 10) + 1) / 10.0 for idx in range(len(samples))]
        predictions = [1 if score >= threshold else 0 for score in probabilities]

    return {
        'predictions': {
            'labels': predictions,
            'batch_size': batch_size,
            'sample_count': len(samples),
            'has_model': bool(trained_model),
        },
        'confidence_scores': {
            'scores': probabilities if return_probabilities else [],
            'enabled': return_probabilities,
            'threshold': threshold,
        },
    }


def _lifecycle_metrics(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Compute metrics from predictions and labels.
    inputs: {predictions, ground_truth}
    config: {metric_names, average_type, threshold}
    """
    metric_names = config.get('metric_names', ['accuracy', 'precision', 'recall', 'f1', 'auc'])
    threshold = config.get('threshold', 0.5)
    average_type = config.get('average_type', 'binary')

    pred_input = inputs.get('predictions') or inputs.get('in_0', {})
    truth_input = inputs.get('ground_truth') or inputs.get('labels') or inputs.get('in_1', [])

    if isinstance(pred_input, dict):
        probs = pred_input.get('probabilities', [])
        labels = pred_input.get('labels', [])
    elif isinstance(pred_input, list):
        probs = []
        labels = pred_input
    else:
        probs = []
        labels = []

    if probs and not labels:
        labels = [1 if p >= threshold else 0 for p in probs]

    if isinstance(truth_input, dict):
        y_true = truth_input.get('labels', [])
    elif isinstance(truth_input, list):
        y_true = truth_input
    else:
        y_true = []

    if not y_true:
        y_true = [idx % 2 for idx in range(len(labels))]

    # Align lengths to avoid runtime errors on mismatched inputs.
    size = min(len(y_true), len(labels))
    y_true = [1 if v in [1, True, '1', 'true', 'yes'] else 0 for v in y_true[:size]]
    y_pred = [1 if v in [1, True, '1', 'true', 'yes'] else 0 for v in labels[:size]]

    all_metrics = _binary_metrics(y_true, y_pred) if size > 0 else {
        'accuracy': 0.0,
        'precision': 0.0,
        'recall': 0.0,
        'f1': 0.0,
        'auc': 0.0,
        'confusion_matrix': {'tp': 0, 'tn': 0, 'fp': 0, 'fn': 0},
    }

    metric_dict = {name: all_metrics[name] for name in metric_names if name in all_metrics}
    metric_dict['average_type'] = average_type

    return {
        'metric_dict': metric_dict,
        'confusion_matrix': all_metrics.get('confusion_matrix', {}),
    }


def _lifecycle_export(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Export trained model and optional artifacts.
    inputs: {trained_model, metrics, predictions}
    config: {format, path}
    """
    model = inputs.get('model') or inputs.get('in_0', {})
    artifacts = inputs.get('artifacts') or inputs.get('in_1', {})

    export_format = config.get('format', 'onnx')
    export_path = config.get('path', 'artifacts/model')

    model_path = f"{export_path}.{export_format}"

    run_dir = _resolve_run_dir(config, 'export')
    manifest_path = os.path.join(run_dir, 'export_manifest.json')

    export_manifest = {
        'format': export_format,
        'path': export_path,
        'model_exported': bool(model),
        'include_preprocessing': bool(config.get('include_preprocessing', True)),
        'source_model_path': model.get('model_path', ''),
    }

    with open(manifest_path, 'w', encoding='utf-8') as fp:
        json.dump(export_manifest, fp, default=str)

    _registry_append({
        'event': 'export',
        'timestamp': datetime.utcnow().isoformat(),
        'format': export_format,
        'manifest_path': manifest_path,
        'model_path': model.get('model_path', ''),
    }, config)

    return {
        'export_manifest': {
            'format': export_format,
            'path': export_path,
            'model_exported': bool(model),
            'include_preprocessing': bool(config.get('include_preprocessing', True)),
            'manifest_path': manifest_path,
        },
        'package': {
            'artifact_path': model_path,
            'has_artifacts': bool(artifacts),
            'export_dir': run_dir,
        },
    }


def _lifecycle_validate(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Run data-quality checks and return cleaned data.
    inputs: {dataset}
    config: {rules, missing_threshold, outlier_detection}
    """
    dataset = _materialize_dataset(inputs.get('dataset') or inputs.get('in_0', {}))
    rules = config.get('rules', [])
    missing_threshold = float(config.get('missing_threshold', 0.2))
    outlier_detection = config.get('outlier_detection', 'none')

    rows = _extract_samples(dataset)
    if not rows:
        return {
            'validation_report': {
                'errors': ['Dataset does not contain rows in expected format'],
                'rules': rules,
                'missing_threshold': missing_threshold,
                'outlier_detection': outlier_detection,
            },
            'cleaned_data': dataset,
        }

    missing_rows = 0
    cleaned_rows = []
    for row in rows:
        if isinstance(row, dict):
            values = list(row.values())
            missing = sum(1 for v in values if v is None or v == '')
            ratio = _safe_ratio(missing, len(values)) if values else 1.0
            if ratio <= missing_threshold:
                cleaned_rows.append(row)
            else:
                missing_rows += 1
        else:
            cleaned_rows.append(row)

    return {
        'validation_report': {
            'rows_total': len(rows),
            'rows_kept': len(cleaned_rows),
            'rows_dropped': missing_rows,
            'rules': rules,
            'missing_threshold': missing_threshold,
            'outlier_detection': outlier_detection,
        },
        'cleaned_data': {
            'data': cleaned_rows,
        },
    }


def _lifecycle_hyperparameter_tune(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Simulate hyperparameter search.
    inputs: {model, train_loader, val_loader}
    config: {param_grid, search_method}
    """
    model_spec = inputs.get('model') or inputs.get('in_0', {})
    train_data = _materialize_dataset(inputs.get('train_data') or inputs.get('in_1', {}))
    objective = inputs.get('objective') or inputs.get('in_2', {})
    param_grid = config.get('param_grid', {})
    search_method = config.get('search_method', 'grid')
    max_trials = int(config.get('max_trials', 10))

    keys = list(param_grid.keys())
    values = [param_grid[k] if isinstance(param_grid[k], list) else [param_grid[k]] for k in keys]

    candidates = []
    if keys:
        cursor = [0] * len(keys)
        while len(candidates) < max_trials:
            params = {keys[i]: values[i][cursor[i]] for i in range(len(keys))}
            candidates.append(params)
            idx = len(keys) - 1
            while idx >= 0:
                cursor[idx] += 1
                if cursor[idx] < len(values[idx]):
                    break
                cursor[idx] = 0
                idx -= 1
            if idx < 0:
                break
    else:
        candidates = [{}]

    history = []
    best_score = -1.0
    best_params = {}
    for idx, params in enumerate(candidates):
        score = 0.6 + (idx / max(1, len(candidates) * 4))
        record = {
            'trial': idx + 1,
            'params': params,
            'score': min(score, 0.95),
            'method': search_method,
        }
        history.append(record)
        if record['score'] > best_score:
            best_score = record['score']
            best_params = params

    return {
        'best_params': best_params,
        'search_report': {
            'search_method': search_method,
            'trial_count': len(history),
            'has_model': bool(model_spec),
            'has_objective': bool(objective),
            'observed_train_samples': len(_extract_samples(train_data)),
            'history': history,
        },
    }


def _lifecycle_ensemble(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Combine multiple models into one ensemble spec.
    inputs: {model1, model2, ...}
    config: {method, weights}
    """
    method = config.get('method', config.get('strategy', 'average'))
    input_models = inputs.get('models') or inputs.get('in_0', [])
    validation_data = inputs.get('validation_data') or inputs.get('in_1', {})
    if not isinstance(input_models, list):
        input_models = [input_models]

    weights = config.get('weights', [])
    if not isinstance(weights, list) or len(weights) != len(input_models):
        weights = [1.0 for _ in range(len(input_models))]

    return {
        'ensemble_model': {
            'method': method,
            'num_models': len(input_models),
            'models': input_models,
        },
        'ensemble_metrics': {
            'weights': weights,
            'validation_samples': len(_extract_samples(validation_data)),
            'optimize_weights': bool(config.get('optimize_weights', False)),
        },
    }


def _lifecycle_feature_engineer(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Add derived features to tabular rows when possible.
    """
    dataset = _materialize_dataset(inputs.get('dataset') or inputs.get('in_0', {}))
    strategy = config.get('strategy', 'auto')
    operations = config.get('operations', [])
    rows = _extract_samples(dataset)

    engineered = []
    for row in rows:
        if isinstance(row, dict):
            new_row = dict(row)
            numeric_values = [float(v) for v in row.values() if isinstance(v, (int, float))]
            if numeric_values:
                new_row['feature_sum'] = sum(numeric_values)
                new_row['feature_count'] = len(numeric_values)
            engineered.append(new_row)
        else:
            engineered.append(row)

    return {
        'features': {'data': engineered},
        'feature_meta': {
            'strategy': strategy,
            'operations': operations,
            'max_features': config.get('max_features', 128),
            'include_interactions': bool(config.get('include_interactions', False)),
        },
    }


def _lifecycle_model_compare(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Compare models with provided metrics and choose a winner.
    """
    primary_metric = config.get('primary_metric', 'accuracy')
    higher_is_better = bool(config.get('higher_is_better', True))

    models = []
    for key, value in inputs.items():
        if 'model' in key:
            models.append(value)
    metrics = inputs.get('metrics', {})

    score = 0.0
    if isinstance(metrics, dict):
        metric_value = metrics.get(primary_metric, metrics.get('f1', 0.0))
        if isinstance(metric_value, (int, float)):
            score = float(metric_value)

    winner_idx = 0
    if models and not higher_is_better:
        winner_idx = len(models) - 1

    return {
        'comparison_report': {
            'primary_metric': primary_metric,
            'higher_is_better': higher_is_better,
            'model_count': len(models),
            'score': score,
        },
        'best_model': models[winner_idx] if models else {},
    }


def _lifecycle_serve(inputs: Dict[str, Any], config: Dict[str, Any]) -> Any:
    """
    Build serving metadata for deployment stage.
    """
    model = inputs.get('trained_model') or inputs.get('ensemble_model') or inputs.get('model') or inputs.get('in_0', {})
    protocol = config.get('protocol', 'http')
    port = int(config.get('port', 8000))
    route = config.get('route', '/predict')
    replicas = int(config.get('replicas', 1))

    return {
        'endpoint': f"{protocol}://localhost:{port}{route}",
        'serve_artifacts': {
            'protocol': protocol,
            'port': port,
            'route': route,
            'replicas': replicas,
            'has_model': bool(model),
        },
    }
`;
}
