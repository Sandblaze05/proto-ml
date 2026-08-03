'use strict';

function nowIso() {
  return new Date().toISOString();
}

function normalizeSchema(schema) {
  if (!schema || typeof schema !== 'object') return {};
  if (Array.isArray(schema)) {
    return schema.reduce((acc, field) => {
      const name = typeof field === 'string' ? field : field.name;
      const type = typeof field === 'string' ? 'any' : (field.type || 'any');
      if (name) acc[name] = type;
      return acc;
    }, {});
  }
  return schema;
}

function inferShape(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    const inner = value.length > 0 ? inferShape(value[0]) : [];
    return [value.length, ...inner];
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return [keys.length, ...(keys.length > 0 ? inferShape(value[keys[0]]) : [])];
  }
  return [];
}

function inferRowCount(value) {
  if (value === null || value === undefined) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === 'object') {
    if (Array.isArray(value.rows)) return value.rows.length;
    if (Array.isArray(value.data)) return value.data.length;
    if (Array.isArray(value.items)) return value.items.length;
    if (Array.isArray(value.train)) return value.train.length;
    if (Array.isArray(value.samples)) return value.samples.length;
  }
  return 1;
}

function inferSerializationFormat(value) {
  if (typeof value === 'string') return 'text';
  if (typeof value === 'number' || typeof value === 'boolean') return 'json';
  if (Array.isArray(value)) return 'json';
  if (value && typeof value === 'object') {
    if ((typeof Buffer !== 'undefined' && value instanceof Buffer) || value instanceof Uint8Array) return 'binary';
    return 'json';
  }
  return 'json';
}

class DataArtifact {
  constructor(value, options = {}) {
    this.__artifact = true;
    this.value = value;
    this.schema = normalizeSchema(options.schema || {});
    this.rowCount = options.rowCount ?? inferRowCount(value);
    this.shape = options.shape ?? inferShape(value);
    this.lineage = {
      nodeId: options.nodeId || null,
      portName: options.portName || null,
      producedAt: options.producedAt || nowIso(),
      materializationRef: options.materializationRef || null,
    };
    this.materializationRef = options.materializationRef || null;
    this.serializationFormat = options.serializationFormat || inferSerializationFormat(value);
    this.datatype = options.datatype || 'any';
    this.payload = value;
  }

  getSchema() {
    return this.schema;
  }

  getShape() {
    return this.shape;
  }

  getRowCount() {
    return this.rowCount;
  }

  getLineage() {
    return this.lineage;
  }

  getMaterializationRef() {
    return this.materializationRef;
  }

  getSerializationFormat() {
    return this.serializationFormat;
  }

  getDatatype() {
    return this.datatype;
  }

  getValue() {
    return this.value;
  }

  getPayload() {
    return this.payload;
  }

  toJSON() {
    return {
      datatype: this.datatype,
      schema: this.schema,
      rowCount: this.rowCount,
      shape: this.shape,
      lineage: this.lineage,
      materializationRef: this.materializationRef,
      serializationFormat: this.serializationFormat,
      value: this.value,
    };
  }

  static wrap(value, options = {}) {
    return new DataArtifact(value, options);
  }

  static unwrap(artifact) {
    if (artifact instanceof DataArtifact) {
      return artifact.value;
    }
    return artifact;
  }

  static isArtifact(value) {
    return value instanceof DataArtifact;
  }

  static mergeLineage(artifact, nodeId, portName, materializationRef) {
    return new DataArtifact(artifact.value, {
      schema: artifact.schema,
      rowCount: artifact.rowCount,
      shape: artifact.shape,
      nodeId: artifact.lineage.nodeId || nodeId,
      portName: artifact.lineage.portName || portName,
      producedAt: artifact.lineage.producedAt || nowIso(),
      materializationRef: artifact.materializationRef || materializationRef,
      serializationFormat: artifact.serializationFormat,
      datatype: artifact.datatype,
    });
  }
}

module.exports = { DataArtifact };
