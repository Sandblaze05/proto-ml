import { describe, it, expect } from 'vitest';

// Helper functions to test
function pyString(v) {
  const s = String(v ?? '');
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function pyValue(v) {
  if (v === null || v === undefined) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'None';
  if (typeof v === 'string') return pyString(v);
  if (Array.isArray(v)) return `[${v.map((it) => pyValue(it)).join(', ')}]`;
  if (typeof v === 'object') {
    const entries = Object.entries(v).map(([k, val]) => `${pyString(k)}: ${pyValue(val)}`);
    return `{${entries.join(', ')}}`;
  }
  return pyString(String(v));
}

describe('Python Template Utilities', () => {
  describe('pyString', () => {
    it('should wrap strings in single quotes', () => {
      expect(pyString('hello')).toBe("'hello'");
      expect(pyString('world')).toBe("'world'");
    });

    it('should escape quotes in strings', () => {
      expect(pyString("it's")).toBe("'it\\'s'");
      expect(pyString('say "hi"')).toBe("'say \"hi\"'");
    });

    it('should escape backslashes', () => {
      expect(pyString('C:\\Users')).toBe("'C:\\\\Users'");
      expect(pyString('path\\to\\file')).toBe("'path\\\\to\\\\file'");
    });

    it('should handle empty strings', () => {
      expect(pyString('')).toBe("''");
    });

    it('should convert null and undefined to empty string', () => {
      expect(pyString(null)).toBe("''");
      expect(pyString(undefined)).toBe("''");
    });
  });

  describe('pyValue', () => {
    describe('Primitives', () => {
      it('should convert null and undefined to None', () => {
        expect(pyValue(null)).toBe('None');
        expect(pyValue(undefined)).toBe('None');
      });

      it('should convert booleans', () => {
        expect(pyValue(true)).toBe('True');
        expect(pyValue(false)).toBe('False');
      });

      it('should convert numbers', () => {
        expect(pyValue(0)).toBe('0');
        expect(pyValue(42)).toBe('42');
        expect(pyValue(3.14)).toBe('3.14');
        expect(pyValue(-100)).toBe('-100');
      });

      it('should handle special float values', () => {
        expect(pyValue(Infinity)).toBe('None');
        expect(pyValue(-Infinity)).toBe('None');
        expect(pyValue(NaN)).toBe('None');
      });

      it('should convert strings with escaping', () => {
        expect(pyValue('hello')).toBe("'hello'");
        expect(pyValue("it's")).toBe("'it\\'s'");
        expect(pyValue('path\\file')).toBe("'path\\\\file'");
      });
    });

    describe('Arrays', () => {
      it('should convert arrays to Python lists', () => {
        expect(pyValue([1, 2, 3])).toBe('[1, 2, 3]');
        expect(pyValue([])).toBe('[]');
      });

      it('should handle mixed-type arrays', () => {
        expect(pyValue([1, 'two', true, null])).toBe("[1, 'two', True, None]");
      });

      it('should handle nested arrays', () => {
        expect(pyValue([[1, 2], [3, 4]])).toBe('[[1, 2], [3, 4]]');
      });

      it('should handle arrays with strings containing special chars', () => {
        const str1 = "it's";
        const str2 = 'path\\file';
        const result = pyValue([str1, str2]);
        expect(result).toContain("'it\\'s'");
      });
    });

    describe('Objects', () => {
      it('should convert objects to Python dicts', () => {
        const result = pyValue({ key: 'value' });
        expect(result).toBe("{'key': 'value'}");
      });

      it('should handle multiple keys', () => {
        const result = pyValue({ a: 1, b: 'two', c: true });
        expect(result).toContain("'a': 1");
        expect(result).toContain("'b': 'two'");
        expect(result).toContain("'c': True");
      });

      it('should handle empty objects', () => {
        expect(pyValue({})).toBe('{}');
      });

      it('should convert nested objects', () => {
        const obj = { outer: { inner: 'value' } };
        const result = pyValue(obj);
        expect(result).toContain("'outer':");
        expect(result).toContain("'inner': 'value'");
      });

      it('should handle objects with special values', () => {
        const obj = { nullVal: null, bool: false, list: [1, 2] };
        const result = pyValue(obj);
        expect(result).toContain("'nullVal': None");
        expect(result).toContain("'bool': False");
        expect(result).toContain("'list': [1, 2]");
      });
    });

    describe('Complex Structures', () => {
      it('should handle mixed nested structures', () => {
        const data = {
          name: 'dataset',
          config: [
            { size: 224, mean: [0.5, 0.5] },
            { size: 256, mean: [0.4, 0.6] },
          ],
        };
        const result = pyValue(data);
        expect(result).toContain("'name': 'dataset'");
        expect(result).toContain('[');
        expect(result).toContain('224');
      });

      it('should handle config objects common in ML pipelines', () => {
        const config = {
          type: 'resize',
          size: [224, 224],
          interpolation: 'bilinear',
          preserve_aspect_ratio: true,
        };
        const result = pyValue(config);
        expect(result).toContain("'type': 'resize'");
        expect(result).toContain("'size': [224, 224]");
        expect(result).toContain("'preserve_aspect_ratio': True");
      });
    });

    describe('Edge Cases', () => {
      it('should handle very large numbers', () => {
        expect(pyValue(999999999999)).toBe('999999999999');
      });

      it('should handle strings that look like code', () => {
        const result = pyValue('print("hello")');
        expect(result).toContain("'");
        expect(result).toBe("'print(\"hello\")'");
      });

      it('should not create valid Python when passed non-string types', () => {
        // While these convert, they should be treated as fallback behavior
        expect(pyValue(Symbol('test'))).toBe("'Symbol(test)'");
      });

      it('should handle very deeply nested structures', () => {
        const deep = {
          a: {
            b: {
              c: {
                d: {
                  e: 'value',
                },
              },
            },
          },
        };
        const result = pyValue(deep);
        expect(result).toContain("'a':");
        expect(result).toContain("'value'");
      });
    });
  });

  describe('Integration - Real-world configs', () => {
    it('should generate valid Python config for image dataset', () => {
      const config = {
        path: './data/images',
        extensions: ['jpg', 'png'],
        recursive: true,
        size_limit: 10485760,
      };

      const result = pyValue(config);
      
      expect(result).toContain("'path':");
      expect(result).toContain("'extensions': ['jpg', 'png']");
      expect(result).toContain("'size_limit': 10485760");
    });

    it('should generate valid Python config for transform', () => {
      const config = {
        type: 'resize',
        size: [224, 224],
        interpolation: 'bilinear',
        preserve_aspect: true,
        pad_if_needed: true,
        fill_value: 0,
      };

      const result = pyValue(config);
      
      expect(result).toContain('[224, 224]');
      expect(result).toContain("'interpolation': 'bilinear'");
      expect(result).toContain("'preserve_aspect': True");
    });

    it('should generate valid Python config for model', () => {
      const config = {
        architecture: 'resnet50',
        pretrained: true,
        num_classes: 1000,
        input_size: [3, 224, 224],
        optimizer: {
          type: 'adam',
          lr: 0.001,
          betas: [0.9, 0.999],
        },
      };

      const result = pyValue(config);
      
      expect(result).toContain("'architecture': 'resnet50'");
      expect(result).toContain('[3, 224, 224]');
      expect(result).toContain("'optimizer':");
      expect(result).toContain('[0.9, 0.999]');
    });
  });
});
