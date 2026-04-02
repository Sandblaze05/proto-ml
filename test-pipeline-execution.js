#!/usr/bin/env node
/**
 * Test: End-to-End Pipeline Execution
 * 
 * This test creates a simple pipeline graph, compiles it with the pipelineCompiler,
 * and executes the generated Python code to verify that apply_transform, apply_lifecycle,
 * and apply_node are correctly wired to real runtime implementations.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { compileExecutionGraph } from './lib/executor/pipelineCompiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a test pipeline: CSV Dataset -> Tabular Transform -> Split -> DataLoader
const testGraph = {
  nodes: [
    {
      id: 'csv-1',
      type: 'dataset.csv',
      config: {
        path: 'data/uploads',
        files: ['sample.csv'],
        header: true,
        delimiter: ',',
      },
    },
    {
      id: 'drop-cols',
      type: 'transform.tabular.drop_columns',
      config: {
        columns: [],
      },
    },
    {
      id: 'fill-missing',
      type: 'transform.tabular.fill_missing',
      config: {
        strategy: 'mean',
        columns: [],
      },
    },
    {
      id: 'scaler',
      type: 'transform.tabular.standard_scaler',
      config: {
        columns: [],
      },
    },
    {
      id: 'split',
      type: 'lifecycle.split',
      config: {
        split_type: 'train_val_test',
        train_pct: 70,
        val_pct: 20,
        test_pct: 10,
        shuffle: true,
        seed: 42,
      },
    },
    {
      id: 'loader',
      type: 'lifecycle.dataloader',
      config: {
        batch_size: 32,
        shuffle: true,
        num_workers: 0,
      },
    },
  ],
  edges: [
    { source: 'csv-1', target: 'drop-cols', sourceHandle: 'out', targetHandle: 'in' },
    { source: 'drop-cols', target: 'fill-missing', sourceHandle: 'out', targetHandle: 'in' },
    { source: 'fill-missing', target: 'scaler', sourceHandle: 'out', targetHandle: 'in' },
    { source: 'scaler', target: 'split', sourceHandle: 'out', targetHandle: 'dataset' },
    { source: 'split', target: 'loader', sourceHandle: 'train', targetHandle: 'dataset' },
  ],
};

console.log('📊 Testing End-to-End Pipeline Execution\n');
console.log('1️⃣  Compiling pipeline...');

const result = compileExecutionGraph(testGraph);

if (!result.ok) {
  console.error('❌ Compilation failed:');
  result.errors.forEach((e) => console.error(`   - ${e}`));
  process.exit(1);
}

console.log(`✅ Compilation successful (${result.metadata.nodeCount} nodes, ${result.metadata.edgeCount} edges)`);
console.log(`\n2️⃣  Generated Python code:\n${'='.repeat(80)}\n`);

// Print first 100 lines of generated code
const lines = result.code.split('\n');
const preview = lines.slice(0, 100).join('\n');
console.log(preview);
if (lines.length > 100) {
  console.log(`\n... (${lines.length - 100} more lines)\n`);
}

console.log('='.repeat(80));

// Write generated code to temporary file
const tmpDir = path.join(__dirname, '.tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir);
}

const tmpPyFile = path.join(tmpDir, 'test_pipeline.py');
fs.writeFileSync(tmpPyFile, result.code, 'utf8');
console.log(`\n3️⃣  Wrote generated code to: ${tmpPyFile}`);

// Create minimal test data for the pipeline
const testDataDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

const testCsvPath = path.join(testDataDir, 'sample.csv');
const testCsvData = `name,age,salary,department
Alice,28,50000,Engineering
Bob,34,65000,Sales
Charlie,42,75000,Engineering
Diana,29,55000,Sales
Eve,38,70000,Engineering
Frank,31,60000,HR
Grace,26,48000,Sales
Henry,45,80000,Engineering
Iris,33,62000,HR
Jack,29,58000,Sales`;

if (!fs.existsSync(testCsvPath)) {
  fs.writeFileSync(testCsvPath, testCsvData, 'utf8');
  console.log(`✅ Created test CSV at: ${testCsvPath}`);
} else {
  console.log(`📄 Using existing test CSV at: ${testCsvPath}`);
}

// Try to execute the Python code
console.log('\n4️⃣  Executing generated Python code...\n');

const pyResult = spawnSync('python3', [tmpPyFile], {
  cwd: __dirname,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

if (pyResult.error) {
  console.error('❌ Python execution failed:');
  console.error(pyResult.error.message);
  console.error('\nNote: Python 3 may not be installed or accessible. See output below for debugging.');
} else if (pyResult.status !== 0) {
  console.error('❌ Python execution exited with status:', pyResult.status);
  console.error('\nSTDOUT:\n', pyResult.stdout);
  console.error('\nSTDERR:\n', pyResult.stderr);
} else {
  console.log('✅ Python execution succeeded!\n');
  console.log('Output:\n', pyResult.stdout);
}

// Print execution summary
console.log('\n' + '='.repeat(80));
console.log('📋 Pipeline Compilation Summary');
console.log('='.repeat(80));
console.log(`Nodes: ${result.metadata.nodeCount}`);
console.log(`Edges: ${result.metadata.edgeCount}`);
console.log(`Datasets: ${result.metadata.datasetCount}`);
console.log(`Execution Order: ${result.metadata.order.join(' → ')}`);
console.log('='.repeat(80));
