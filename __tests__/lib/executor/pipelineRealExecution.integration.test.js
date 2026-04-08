import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const { compileExecutionGraph } = require('../../../lib/executor/pipelineCompiler.js');

function resolvePython() {
  const direct = spawnSync('python', ['-c', 'print("ok")'], { encoding: 'utf8' });
  if (direct.status === 0) return { cmd: 'python', prefixArgs: [] };

  const python3 = spawnSync('python3', ['-c', 'print("ok")'], { encoding: 'utf8' });
  if (python3.status === 0) return { cmd: 'python3', prefixArgs: [] };

  const launcher = spawnSync('py', ['-3', '-c', 'print("ok")'], { encoding: 'utf8' });
  if (launcher.status === 0) return { cmd: 'py', prefixArgs: ['-3'] };

  return null;
}

function hasSklearn(py) {
  const check = spawnSync(py.cmd, [...py.prefixArgs, '-c', 'import sklearn; print("yes")'], {
    encoding: 'utf8',
  });
  return check.status === 0;
}

describe('Real backend execution integration', () => {
  it('executes core map drop_columns on CSV features in compiled Python runtime', () => {
    const python = resolvePython();
    if (!python) {
      expect(true).toBe(true);
      return;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ml-map-'));
    const csvPath = path.join(tempDir, 'map.csv');
    fs.writeFileSync(csvPath, ['id,f1,f2,target', '1,2,3,0', '2,4,6,1', '3,6,9,0'].join('\n'), 'utf8');

    const graph = {
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: { path: csvPath, target_column: 'target' } },
        t1: { id: 't1', type: 'transform.core.map', config: { operation: 'drop_columns', columns: ['id'] } },
      },
      edges: [
        { source: 'd1', target: 't1', sourceHandle: 'features', targetHandle: 'in' },
      ],
    };

    const compiled = compileExecutionGraph(graph, { seed: 42 });
    expect(compiled.ok).toBe(true);

    const pyFile = path.join(tempDir, 'pipeline_map_exec.py');
    const pyCode = `${compiled.code}\nprint("__MAP_RESULT__")\nprint(json.dumps(run_pipeline(), default=str))\n`;
    fs.writeFileSync(pyFile, pyCode, 'utf8');

    const run = spawnSync(python.cmd, [...python.prefixArgs, pyFile], {
      cwd: tempDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    if (run.status !== 0) {
      throw new Error(`Python map execution failed (status ${run.status})\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    }

    const marker = '__MAP_RESULT__';
    const markerIndex = run.stdout.lastIndexOf(marker);
    expect(markerIndex).toBeGreaterThan(-1);
    const jsonPayload = run.stdout.slice(markerIndex + marker.length).trim().split('\n').find((line) => line.trim().startsWith('{'));
    const result = JSON.parse(jsonPayload);

    const mapOut = result?.node_outputs?.t1;
    expect(Array.isArray(mapOut)).toBe(true);
    expect(mapOut.length).toBe(3);
    expect(mapOut[0]).not.toHaveProperty('id');
    expect(mapOut[0]).toHaveProperty('f1');
    expect(mapOut[0]).toHaveProperty('f2');
    expect(mapOut[0]).not.toHaveProperty('target');
  }, 20000);

  it('executes sklearn-backed train/predict/export pipeline with artifacts', () => {
    const python = resolvePython();
    if (!python) {
      expect(true).toBe(true);
      return;
    }

    if (!hasSklearn(python)) {
      expect(true).toBe(true);
      return;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ml-real-'));
    const csvPath = path.join(tempDir, 'train.csv');
    const artifactDir = path.join(tempDir, 'artifacts');
    const registryPath = path.join(artifactDir, 'model_registry.jsonl');

    const csv = [
      'f1,f2,target',
      '1,2,3',
      '2,4,6',
      '3,6,9',
      '4,8,12',
      '5,10,15',
      '6,12,18',
    ].join('\n');
    fs.writeFileSync(csvPath, csv, 'utf8');

    const graph = {
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: { path: csvPath } },
        s1: { id: 's1', type: 'lifecycle.split', config: { train_pct: 70, val_pct: 15, test_pct: 15, seed: 42, shuffle: true } },
        m1: {
          id: 'm1',
          type: 'lifecycle.core.model_builder',
          config: { family: 'linear_regression', backend: 'sklearn', num_outputs: 1 },
        },
        tr1: {
          id: 'tr1',
          type: 'lifecycle.core.trainer',
          config: {
            backend: 'sklearn',
            target_column: 'target',
            artifact_dir: artifactDir,
            registry_path: registryPath,
            epochs: 5,
          },
        },
        p1: {
          id: 'p1',
          type: 'lifecycle.core.predictor',
          config: { target_column: 'target', threshold: 0.5 },
        },
        e1: {
          id: 'e1',
          type: 'lifecycle.core.exporter',
          config: {
            format: 'pickle',
            path: path.join(artifactDir, 'exports', 'model'),
            artifact_dir: artifactDir,
            registry_path: registryPath,
          },
        },
      },
      edges: [
        { source: 'd1', target: 's1', sourceHandle: 'out', targetHandle: 'dataset' },
        { source: 's1', target: 'm1', sourceHandle: 'train', targetHandle: 'train_data' },
        { source: 'm1', target: 'tr1', sourceHandle: 'model', targetHandle: 'model' },
        { source: 's1', target: 'tr1', sourceHandle: 'train', targetHandle: 'train_data' },
        { source: 's1', target: 'tr1', sourceHandle: 'val', targetHandle: 'val_data' },
        { source: 'tr1', target: 'p1', sourceHandle: 'trained_model', targetHandle: 'model' },
        { source: 's1', target: 'p1', sourceHandle: 'test', targetHandle: 'inference_data' },
        { source: 'tr1', target: 'e1', sourceHandle: 'trained_model', targetHandle: 'model' },
        { source: 'tr1', target: 'e1', sourceHandle: 'artifacts', targetHandle: 'artifacts' },
      ],
    };

    const compiled = compileExecutionGraph(graph, { seed: 42 });
    expect(compiled.ok).toBe(true);

    const pyFile = path.join(tempDir, 'pipeline_real_exec.py');
    const pyCode = `${compiled.code}\nprint("__REAL_RESULT__")\nprint(json.dumps(run_pipeline(), default=str))\n`;
    fs.writeFileSync(pyFile, pyCode, 'utf8');

    const run = spawnSync(python.cmd, [...python.prefixArgs, pyFile], {
      cwd: tempDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    if (run.status !== 0) {
      throw new Error(`Python execution failed (status ${run.status})\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    }

    const marker = '__REAL_RESULT__';
    const markerIndex = run.stdout.lastIndexOf(marker);
    expect(markerIndex).toBeGreaterThan(-1);

    const jsonPayload = run.stdout.slice(markerIndex + marker.length).trim().split('\n').find((line) => line.trim().startsWith('{'));
    expect(Boolean(jsonPayload)).toBe(true);

    const result = JSON.parse(jsonPayload);
    const trainerOut = result?.node_outputs?.tr1;
    const predictorOut = result?.node_outputs?.p1;
    const exporterOut = result?.node_outputs?.e1;

    expect(trainerOut?.trained_model?.backend).toBe('sklearn');
    expect(Number(trainerOut?.metrics?.train_loss)).toBeGreaterThanOrEqual(0);
    expect(predictorOut?.predictions?.sample_count).toBeGreaterThanOrEqual(1);

    expect(fs.existsSync(registryPath)).toBe(true);
    expect(Boolean(exporterOut?.export_manifest?.manifest_path)).toBe(true);
    expect(fs.existsSync(exporterOut.export_manifest.manifest_path)).toBe(true);
  }, 30000);

  it('materializes text dataset and executes split workflow', () => {
    const python = resolvePython();
    if (!python) {
      expect(true).toBe(true);
      return;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ml-text-'));
    const txtPath = path.join(tempDir, 'corpus.txt');
    fs.writeFileSync(txtPath, ['hello world', 'foo bar', 'lorem ipsum', 'quick brown fox'].join('\n'), 'utf8');

    const graph = {
      nodes: {
        d1: {
          id: 'd1',
          type: 'dataset.text',
          config: { path: txtPath, file_format: 'txt', text_column: 'text', label_column: 'label' },
        },
        s1: { id: 's1', type: 'lifecycle.split', config: { train_pct: 50, val_pct: 25, test_pct: 25, shuffle: false } },
      },
      edges: [{ source: 'd1', target: 's1', sourceHandle: 'out', targetHandle: 'dataset' }],
    };

    const compiled = compileExecutionGraph(graph, { seed: 42 });
    expect(compiled.ok).toBe(true);

    const pyFile = path.join(tempDir, 'pipeline_text_exec.py');
    const pyCode = `${compiled.code}\nprint("__TEXT_RESULT__")\nprint(json.dumps(run_pipeline(), default=str))\n`;
    fs.writeFileSync(pyFile, pyCode, 'utf8');

    const run = spawnSync(python.cmd, [...python.prefixArgs, pyFile], {
      cwd: tempDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    if (run.status !== 0) {
      throw new Error(`Python text execution failed (status ${run.status})\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    }

    const marker = '__TEXT_RESULT__';
    const markerIndex = run.stdout.lastIndexOf(marker);
    expect(markerIndex).toBeGreaterThan(-1);
    const jsonPayload = run.stdout.slice(markerIndex + marker.length).trim().split('\n').find((line) => line.trim().startsWith('{'));
    const result = JSON.parse(jsonPayload);
    const splitOut = result?.node_outputs?.s1;

    expect(splitOut?.train?.data?.length ?? 0).toBeGreaterThan(0);
    expect((splitOut?.train?.data ?? [])[0]?.text).toBeTypeOf('string');
  }, 20000);

  it('materializes image dataset and executes split workflow', () => {
    const python = resolvePython();
    if (!python) {
      expect(true).toBe(true);
      return;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ml-image-'));
    const catDir = path.join(tempDir, 'cat');
    const dogDir = path.join(tempDir, 'dog');
    fs.mkdirSync(catDir, { recursive: true });
    fs.mkdirSync(dogDir, { recursive: true });
    fs.writeFileSync(path.join(catDir, 'a.jpg'), 'fake-jpg-a', 'utf8');
    fs.writeFileSync(path.join(dogDir, 'b.jpg'), 'fake-jpg-b', 'utf8');
    fs.writeFileSync(path.join(dogDir, 'c.jpg'), 'fake-jpg-c', 'utf8');

    const graph = {
      nodes: {
        d1: {
          id: 'd1',
          type: 'dataset.image',
          config: { path: tempDir, format: 'jpg', recursive: true, label_strategy: 'folder_name' },
        },
        s1: { id: 's1', type: 'lifecycle.split', config: { train_pct: 67, val_pct: 0, test_pct: 33, shuffle: false } },
      },
      edges: [{ source: 'd1', target: 's1', sourceHandle: 'out', targetHandle: 'dataset' }],
    };

    const compiled = compileExecutionGraph(graph, { seed: 42 });
    expect(compiled.ok).toBe(true);

    const pyFile = path.join(tempDir, 'pipeline_image_exec.py');
    const pyCode = `${compiled.code}\nprint("__IMAGE_RESULT__")\nprint(json.dumps(run_pipeline(), default=str))\n`;
    fs.writeFileSync(pyFile, pyCode, 'utf8');

    const run = spawnSync(python.cmd, [...python.prefixArgs, pyFile], {
      cwd: tempDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    if (run.status !== 0) {
      throw new Error(`Python image execution failed (status ${run.status})\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    }

    const marker = '__IMAGE_RESULT__';
    const markerIndex = run.stdout.lastIndexOf(marker);
    expect(markerIndex).toBeGreaterThan(-1);
    const jsonPayload = run.stdout.slice(markerIndex + marker.length).trim().split('\n').find((line) => line.trim().startsWith('{'));
    const result = JSON.parse(jsonPayload);
    const splitOut = result?.node_outputs?.s1;

    expect(splitOut?.train?.data?.length ?? 0).toBeGreaterThan(0);
    expect((splitOut?.train?.data ?? [])[0]?.path).toBeTypeOf('string');
  }, 20000);

  it('routes CSV targets handle to lifecycle objective with materialized payload', () => {
    const python = resolvePython();
    if (!python) {
      expect(true).toBe(true);
      return;
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-ml-target-handle-'));
    const csvPath = path.join(tempDir, 'train.csv');
    fs.writeFileSync(csvPath, ['f1,f2,target', '1,2,0', '2,4,1', '3,6,1', '4,8,0'].join('\n'), 'utf8');

    const graph = {
      nodes: {
        d1: { id: 'd1', type: 'dataset.csv', config: { path: csvPath, target_column: 'target' } },
        o1: {
          id: 'o1',
          type: 'lifecycle.core.objective',
          config: { objective_type: 'supervised', primary_metric: 'f1', loss: 'cross_entropy' },
        },
      },
      edges: [
        { source: 'd1', target: 'o1', sourceHandle: 'targets', targetHandle: 'targets' },
      ],
    };

    const compiled = compileExecutionGraph(graph, { seed: 7 });
    expect(compiled.ok).toBe(true);

    const pyFile = path.join(tempDir, 'pipeline_targets_exec.py');
    const pyCode = `${compiled.code}\nprint("__TARGET_HANDLE_RESULT__")\nprint(json.dumps(run_pipeline(), default=str))\n`;
    fs.writeFileSync(pyFile, pyCode, 'utf8');

    const run = spawnSync(python.cmd, [...python.prefixArgs, pyFile], {
      cwd: tempDir,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    if (run.status !== 0) {
      throw new Error(`Python target-handle execution failed (status ${run.status})\nSTDOUT:\n${run.stdout}\nSTDERR:\n${run.stderr}`);
    }

    const marker = '__TARGET_HANDLE_RESULT__';
    const markerIndex = run.stdout.lastIndexOf(marker);
    expect(markerIndex).toBeGreaterThan(-1);
    const jsonPayload = run.stdout.slice(markerIndex + marker.length).trim().split('\n').find((line) => line.trim().startsWith('{'));
    const result = JSON.parse(jsonPayload);

    const objectiveOut = result?.node_outputs?.o1;
    expect(objectiveOut?.metrics_spec?.target_count).toBe(4);
  }, 20000);
});
