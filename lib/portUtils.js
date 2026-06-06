'use client';

/**
 * Port Utility Functions — shared across node components.
 */

export const PORT_TW = {
  tensor: { dot: 'bg-purple-400', badge: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
  dataloader: { dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  sequence: { dot: 'bg-blue-400', badge: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  list: { dot: 'bg-amber-400', badge: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  dict: { dot: 'bg-red-400', badge: 'text-red-400 bg-red-400/10 border-red-400/30' },
  model: { dot: 'bg-amber-400', badge: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  loss: { dot: 'bg-red-400', badge: 'text-red-400 bg-red-400/10 border-red-400/30' },
  metrics: { dot: 'bg-blue-400', badge: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
};
export const PORT_TW_DEFAULT = { dot: 'bg-[#faebd7]', badge: 'text-[#faebd7] bg-[#faebd7]/10 border-[#faebd7]/30' };

export const PORT_HEX = {
  tensor: '#c084fc',
  dataloader: '#34d399',
  sequence: '#60a5fa',
  list: '#fbbf24',
  dict: '#f87171',
  model: '#fbbf24',
  loss: '#f87171',
  metrics: '#60a5fa',
  default: '#faebd7',
};

export function portHex(dt) { return PORT_HEX[dt] ?? PORT_HEX.default; }
export function portTw(dt) { return PORT_TW[dt] ?? PORT_TW_DEFAULT; }

export function inferPortDatatype(name = '', fallback = 'default') {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return fallback;

  if (n === 'images' || n.includes('image') || n.includes('tensor') || n.includes('pixel')) return 'tensor';
  if (n === 'labels' || n.includes('label') || n.includes('sequence') || n.includes('token')) return 'sequence';
  if (n === 'classes' || n.includes('class') || n.includes('map') || n.includes('dict') || n.includes('meta')) return 'dict';
  if (n.includes('loader') || n.includes('batch')) return 'dataloader';
  if (n.includes('list') || n.includes('ids') || n.includes('index')) return 'list';
  if (n.includes('model')) return 'model';
  if (n.includes('loss') || n.includes('objective')) return 'loss';
  if (n.includes('metric') || n.includes('score')) return 'metrics';

  return fallback;
}

export function normalizePort(port, idx, fallbackPrefix) {
  if (typeof port === 'string') {
    const trimmed = port.trim();
    const name = trimmed || `${fallbackPrefix}_${idx + 1}`;
    return {
      name,
      datatype: inferPortDatatype(name, 'default'),
      shape: [],
    };
  }

  if (port && typeof port === 'object') {
    const name = typeof port.name === 'string' && port.name.trim().length > 0
      ? port.name.trim()
      : `${fallbackPrefix}_${idx + 1}`;

    return {
      ...port,
      name,
      datatype: inferPortDatatype(name, port.datatype || 'default'),
      shape: Array.isArray(port.shape) ? port.shape : [],
    };
  }

  return {
    name: `${fallbackPrefix}_${idx + 1}`,
    datatype: 'default',
    shape: [],
  };
}
