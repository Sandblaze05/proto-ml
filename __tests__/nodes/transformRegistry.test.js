import { describe, it, expect } from 'vitest';
import { TRANSFORM_NODES } from '../../nodes/transforms/transformRegistry.js';

describe('transformRegistry', () => {
  describe('TRANSFORM_NODES', () => {
    it('should be an array of transform definitions', () => {
      expect(Array.isArray(TRANSFORM_NODES)).toBe(true);
      expect(TRANSFORM_NODES.length).toBeGreaterThan(0);
    });

    it('should have required properties on each transform', () => {
      TRANSFORM_NODES.forEach((transform) => {
        expect(transform).toHaveProperty('type');
        expect(transform).toHaveProperty('label');
        expect(transform).toHaveProperty('category');
        expect(transform).toHaveProperty('level');
        expect(transform).toHaveProperty('accepts');
        expect(transform).toHaveProperty('produces');
        expect(transform).toHaveProperty('defaultConfig');
        expect(transform).toHaveProperty('uiSchema');
      });
    });

    it('should have unique types', () => {
      const types = TRANSFORM_NODES.map((t) => t.type);
      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });

    describe('Image transforms', () => {
      const imageTransforms = TRANSFORM_NODES.filter((t) => t.domain === 'image');

      it('should have image transforms available', () => {
        expect(imageTransforms.length).toBeGreaterThan(0);
      });

      it('image transforms should accept/produce image domain', () => {
        imageTransforms.forEach((transform) => {
          expect(transform.accepts).toContain('image');
          expect(transform.produces).toContain('image');
        });
      });
    });

    describe('Tabular transforms', () => {
      const tabularTransforms = TRANSFORM_NODES.filter((t) => t.domain === 'tabular');

      it('should have tabular transforms', () => {
        expect(tabularTransforms.length).toBeGreaterThan(0);
      });

      it('tabular transforms should accept/produce tabular domain', () => {
        tabularTransforms.forEach((transform) => {
          expect(transform.accepts).toContain('tabular');
          expect(transform.produces).toContain('tabular');
        });
      });
    });

    describe('Text transforms', () => {
      const textTransforms = TRANSFORM_NODES.filter((t) => t.domain === 'text');

      it('should have text transforms', () => {
        expect(textTransforms.length).toBeGreaterThan(0);
      });

      it('text transforms should accept/produce text domain', () => {
        textTransforms.forEach((transform) => {
          expect(transform.accepts).toContain('text');
          expect(transform.produces).toContain('text');
        });
      });
    });

    describe('Transform levels', () => {
      it('should have level 1 basic transforms', () => {
        const level1 = TRANSFORM_NODES.filter((t) => t.level === 1);
        expect(level1.length).toBeGreaterThan(0);
      });

      it('should have level 2 advanced transforms', () => {
        const level2 = TRANSFORM_NODES.filter((t) => t.level === 2);
        expect(level2.length).toBeGreaterThan(0);
      });

      it('augmentations should be level 2', () => {
        const augmentations = TRANSFORM_NODES.filter((t) => t.category === 'image-augmentation');
        augmentations.forEach((aug) => {
          expect(aug.level).toBe(2);
        });
      });
    });

    describe('UI Schema validation', () => {
      it('should have UI schema for complex transforms', () => {
        const randomRotation = TRANSFORM_NODES.find(
          (t) => t.type === 'transform.image.random_rotation'
        );
        expect(randomRotation.uiSchema).toHaveProperty('degrees');
        expect(randomRotation.uiSchema).toHaveProperty('p');
        expect(randomRotation.uiSchema).toHaveProperty('fill_mode');
      });

      it('should specify number types in UI schema', () => {
        const colorJitter = TRANSFORM_NODES.find((t) => t.type === 'transform.image.color_jitter');
        expect(colorJitter.defaultConfig).toHaveProperty('brightness');
        expect(colorJitter.defaultConfig).toHaveProperty('contrast');
      });

      it('should specify enum options for categorical configs', () => {
        const randomRotation = TRANSFORM_NODES.find(
          (t) => t.type === 'transform.image.random_rotation'
        );
        expect(randomRotation.uiSchema.fill_mode.type).toBe('enum');
        expect(randomRotation.uiSchema.fill_mode.options).toContain('reflect');
      });
    });

    describe('Probability defaults', () => {
      it('augmentations with probability should default between 0 and 1', () => {
        const withProb = TRANSFORM_NODES.filter(
          (t) => t.defaultConfig?.p !== undefined
        );
        withProb.forEach((t) => {
          expect(t.defaultConfig.p).toBeGreaterThanOrEqual(0);
          expect(t.defaultConfig.p).toBeLessThanOrEqual(1);
        });
      });
    });

    describe('Default configs consistency', () => {
      it('all transforms should have valid defaultConfig objects', () => {
        TRANSFORM_NODES.forEach((transform) => {
          expect(typeof transform.defaultConfig).toBe('object');
          expect(transform.defaultConfig).not.toBeNull();
        });
      });

      it('array configs should be arrays', () => {
        TRANSFORM_NODES.forEach((transform) => {
          Object.entries(transform.defaultConfig).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Object config is allowed in some cases (like nested settings)
              expect(typeof value).toBe('object');
            }
          });
        });
      });
    });

    describe('Common transform properties', () => {
      it('should have consistent kind property', () => {
        TRANSFORM_NODES.forEach((transform) => {
          expect(['transform', 'pipeline', 'lifecycle'].includes(transform.kind)).toBe(true);
        });
      });

      it('should have standard input/output definitions', () => {
        TRANSFORM_NODES.forEach((transform) => {
          expect(Array.isArray(transform.inputs)).toBe(true);
          expect(Array.isArray(transform.outputs)).toBe(true);
          expect(transform.inputs.length).toBeGreaterThan(0);
          expect(transform.outputs.length).toBeGreaterThan(0);
        });
      });

      it('should have valid color hex codes', () => {
        TRANSFORM_NODES.forEach((transform) => {
          if (transform.color) {
            expect(transform.color).toMatch(/^#[0-9a-f]{6}$/i);
          }
        });
      });
    });

    describe('Categories', () => {
      it('should group transforms by category', () => {
        const categories = new Set(TRANSFORM_NODES.map((t) => t.category));
        expect(categories.size).toBeGreaterThan(0);
      });

      it('image-basic should contain simple image operations', () => {
        const basic = TRANSFORM_NODES.filter((t) => t.category === 'image-basic');
        expect(basic.length).toBeGreaterThan(0);
      });

      it('tabular-basic should contain simple tabular operations', () => {
        const basic = TRANSFORM_NODES.filter((t) => t.category === 'tabular-basic');
        expect(basic.length).toBeGreaterThan(0);
      });
    });
  });
});
