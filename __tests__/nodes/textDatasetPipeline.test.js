import { describe, it, expect } from 'vitest';
import TextDataset from '../../nodes/datasets/TextDataset.js';
import TextDatasetRuntime from '../../lib/datasetRuntimes/TextDatasetRuntime.js';
import { generateTransformPythonCode } from '../../lib/pythonTemplates/transformNodeTemplate.js';
import { generateDatasetPythonCode } from '../../lib/pythonTemplates/datasetNodeTemplate.js';
import { LIFECYCLE_NODES } from '../../nodes/lifecycle/lifecycleRegistry.js';

describe('Text Dataset & NLP Pipeline Integration', () => {
  describe('TextDataset Node Definition', () => {
    it('has complete ports and config defaults', () => {
      expect(TextDataset.type).toBe('dataset.text');
      expect(TextDataset.kind).toBe('dataset');
      expect(TextDataset.config.defaults.source_mode).toBe('file');
      expect(TextDataset.config.defaults.text_column).toBe('text');
      expect(TextDataset.config.defaults.label_column).toBe('label');

      const outputNames = TextDataset.outputs.map((p) => p.name);
      expect(outputNames).toEqual(expect.arrayContaining(['features', 'targets', 'vocab']));
    });
  });

  describe('TextDatasetRuntime helper methods', () => {
    it('parses raw text into structured rows', () => {
      const runtime = new TextDatasetRuntime();
      const rows = runtime._parseFile('Line 1\nLine 2\nLine 3', 'sample.txt');
      expect(rows.length).toBe(3);
      expect(rows[0].text).toBe('Line 1');
      expect(rows[0].source).toBe('sample.txt');
    });

    it('builds vocabulary and sorts by frequency', () => {
      const runtime = new TextDatasetRuntime();
      const rows = [
        { text: 'deep learning with neural networks' },
        { text: 'machine learning and deep algorithms' },
      ];
      const vocab = runtime._buildVocab(rows);
      expect(vocab).toContain('deep');
      expect(vocab).toContain('learning');
      expect(vocab.slice(0, 2)).toEqual(expect.arrayContaining(['deep', 'learning']));
    });

    it('builds metadata with token and label statistics', () => {
      const runtime = new TextDatasetRuntime();
      const rows = [
        { text: 'hello world', label: 'greeting', source: 'f1.txt' },
        { text: 'farewell friend', label: 'farewell', source: 'f2.txt' },
      ];
      const vocab = runtime._buildVocab(rows);
      const meta = runtime._buildMetadata(rows, vocab, 2);
      expect(meta.rows).toBe(2);
      expect(meta.vocabSize).toBe(vocab.length);
      expect(meta.numClasses).toBe(2);
      expect(meta.labelDistribution).toEqual({ greeting: 1, farewell: 1 });
    });

    it('defaults header to true for TextDataset config', () => {
      expect(TextDataset.config.defaults.header).toBe(true);
    });

    it('parses CSV with headers preserving text and label columns', () => {
      const runtime = new TextDatasetRuntime({ file_format: 'csv', header: true });
      const rows = runtime._parseFile('text,label\n"absolutely love the new dashboard",positive\n"needs, improvement",negative', 'reviews.csv');

      expect(rows).toEqual([
        { text: 'absolutely love the new dashboard', label: 'positive', source: 'reviews.csv' },
        { text: 'needs, improvement', label: 'negative', source: 'reviews.csv' },
      ]);
    });

    it('keeps quoted text and labels from headerless CSV rows', () => {
      const runtime = new TextDatasetRuntime({ file_format: 'csv', header: false });
      const rows = runtime._parseFile('"absolutely love the new dashboard",positive\n"needs, improvement",negative', 'reviews.csv');

      expect(rows).toEqual([
        { text: 'absolutely love the new dashboard', label: 'positive', source: 'reviews.csv' },
        { text: 'needs, improvement', label: 'negative', source: 'reviews.csv' },
      ]);
    });
  });

  describe('NLP Transform Code Generation', () => {
    it('generates python code for tfidf transform', () => {
      const code = generateTransformPythonCode('transform.text.tfidf', {
        max_features: 2500,
        ngram_range: '1,3',
        sublinear_tf: true,
      });
      expect(code).toContain('apply_tfidf');
      expect(code).toContain('transform.text.tfidf');
      expect(code).toContain('2500');
    });

    it('generates python code for count vectorizer transform', () => {
      const code = generateTransformPythonCode('transform.text.count_vectorizer', {
        max_features: 1000,
        binary: true,
      });
      expect(code).toContain('apply_count_vectorizer');
      expect(code).toContain('transform.text.count_vectorizer');
      expect(code).toContain('1000');
    });

    it('generates python code for embeddings transform', () => {
      const code = generateTransformPythonCode('transform.text.embedding', {
        model_name: 'all-MiniLM-L6-v2',
        batch_size: 64,
      });
      expect(code).toContain('apply_embedding');
      expect(code).toContain('transform.text.embedding');
      expect(code).toContain('all-MiniLM-L6-v2');
      expect(code).toContain('64');
    });

    it('generates python code for stem/lemmatize transform', () => {
      const code = generateTransformPythonCode('transform.text.stem_lemmatize', {
        method: 'lemmatize',
        language: 'english',
      });
      expect(code).toContain('stem_lemmatize');
    });
  });

  describe('Text Dataset Code Generation', () => {
    it('generates python loader for text dataset node', () => {
      const code = generateDatasetPythonCode('dataset.text', {
        sourceMode: 'folder',
        folderPath: '/data/corpus',
      });
      expect(code).toContain('source_mode');
      expect(code).toContain('records = []');
      expect(code).toContain('pd.DataFrame(records)');
    });
  });

  describe('Lifecycle Registry NLP Support', () => {
    it('includes nlp model families in model_builder lifecycle node', () => {
      const modelNode = LIFECYCLE_NODES.find((n) => n.type === 'lifecycle.core.model_builder');
      expect(modelNode).toBeDefined();
      expect(modelNode.uiSchema.family.options).toEqual(expect.arrayContaining([
        'naive_bayes',
        'multinomial_nb',
        'complement_nb',
        'sgd_classifier',
      ]));
    });
  });
});
