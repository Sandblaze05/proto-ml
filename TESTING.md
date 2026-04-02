# Unit Testing Guide for Proto-ML

This guide explains how to run and maintain the unit test suite for the Proto-ML project.

## Quick Start

### Install Dependencies
All testing dependencies are already in `package.json`:
```bash
npm install
```

### Run Tests

**Watch mode (recommended for development):**
```bash
npm test
```

**Run once (CI/CD):**
```bash
npm run test:run
```

**With coverage report:**
```bash
npm run test:coverage
```

**With interactive UI:**
```bash
npm run test:ui
```

## Test Structure

Tests are organized by module in `__tests__/`:

```
__tests__/
├── lib/
│   ├── executor/
│   │   ├── graphExecutor.test.js      # Graph execution and preview logic
│   │   └── pipelineCompiler.test.js   # Python code generation
│   ├── pythonTemplates/
│   │   └── pythonTemplateUtils.test.js # Python value serialization
│   └── clientUploadStore.test.js       # File upload utilities
├── nodes/
│   └── transformRegistry.test.js       # Available transforms database
└── store/
    └── useExecutionStore.test.js       # State management
```

## Critical Files Covered

### 1. **GraphExecutor** (`lib/executor/graphExecutor.js`)
- Pipeline execution and node previewing
- Runtime factory initialization
- Topological sorting of nodes
- Error handling for missing runtimes

**Tests:** 12 tests covering preview generation, dependency chaining, cycle detection

### 2. **PipelineCompiler** (`lib/executor/pipelineCompiler.js`)
- Python code generation from graph nodes
- Value/literal conversion (strings, numbers, arrays, objects)
- Node ID to Python symbol conversion
- Edge normalization

**Tests:** 20+ tests for Python literal generation and graph compilation

### 3. **TransformRegistry** (`nodes/transforms/transformRegistry.js`)
- Available ML transforms (image, tabular, text, augmentations)
- Transform metadata and configuration
- UI schema definitions
- Transform categories and levels

**Tests:** 25+ tests validating transform definitions, configs, and schemas

### 4. **ExecutionStore** (`store/useExecutionStore.js`)
- Graph node and edge management
- Config updates and state mutations
- Connection validation

**Tests:** 20+ tests for node operations, edge management, and state isolation

### 5. **ClientUploadStore** (`lib/clientUploadStore.js`)
- Upload ID generation
- File type detection (images, CSVs, etc.)
- Upload lifecycle management

**Tests:** 15+ tests for upload utilities and file handling

### 6. **Python Templates** (`lib/pythonTemplates/`)
- Template code generation for datasets
- Python value serialization
- Config object conversion

**Tests:** 15+ tests for config generation and escaping

## Read Test Output

### Success Output
```
✓ __tests__/lib/executor/graphExecutor.test.js (12)
✓ __tests__/lib/executor/pipelineCompiler.test.js (20)
✓ __tests__/nodes/transformRegistry.test.js (25)
✓ __tests__/store/useExecutionStore.test.js (20)
✓ __tests__/lib/clientUploadStore.test.js (15)
✓ __tests__/lib/pythonTemplates/pythonTemplateUtils.test.js (15)

Test Files  6 passed (6)
     Tests  107 passed (107)
```

### Coverage Report
After `npm run test:coverage`, view the HTML report:
```bash
# Windows
start coverage/index.html

# Mac/Linux
open coverage/index.html
```

## Adding New Tests

### Test Template
```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { functionToTest } from '../path/to/module.js';

describe('Module Name', () => {
  let state;

  beforeEach(() => {
    // Setup before each test
    state = {};
  });

  describe('Feature', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe('expected output');
    });
  });
});
```

### Best Practices
1. **One concept per test** - Keep tests focused
2. **Descriptive names** - Use `should...` pattern for clarity
3. **Arrange-Act-Assert** - Organize test logic clearly
4. **Mock external dependencies** - Use `vi.fn()` for functions
5. **Test edge cases** - null, undefined, empty arrays, etc.
6. **Group related tests** - Use nested `describe()` blocks

## Continuous Integration

Tests should run in CI/CD pipelines before deployment:

```yaml
# Example GitHub Actions
- name: Run tests
  run: npm run test:run

- name: Generate coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Coverage Goals

- **Current:** ~70% coverage of critical paths
- **Target:** 85%+ for execution, compilation, and state logic
- **Excluded:** React components, UI layers, visualization

Focus test expansion on:
1. Error handling paths
2. Edge cases in graph operations
3. Python code generation correctness
4. State mutation consistency

## Testing Common Scenarios

### Testing Graph Execution
```javascript
const graph = {
  nodes: {
    'csv-1': { id: 'csv-1', type: 'dataset.csv', config: { path: 'data.csv' } },
    'resize-1': { id: 'resize-1', type: 'transform.image.resize', config: { size: [224, 224] } },
  },
  edges: [{ from: 'csv-1', to: 'resize-1' }],
};

const result = await executor.preview(graph, 'resize-1', 5);
```

### Testing Node Config Updates
```javascript
store.addExecutionNode('node-1', { type: 'dataset.csv', config: { path: 'original.csv' } });
store.updateNodeConfig('node-1', { path: 'updated.csv' });
expect(store.getState().nodes['node-1'].config.path).toBe('updated.csv');
```

### Testing Python Generation
```javascript
const code = compilePipeline(graph);
expect(code).toContain('import pandas as pd');
expect(code).toContain('df = df.drop');
```

## Debugging Tests

### Run Single Test File
```bash
npx vitest __tests__/lib/executor/graphExecutor.test.js
```

### Run Tests Matching Pattern
```bash
npx vitest -t "should handle cycles"
```

### Debug Mode
```bash
node --inspect-brk ./node_modules/vitest/vitest.mjs
```

Then open Chrome DevTools to `chrome://inspect`

## Maintenance

### Monthly
- Review test coverage report
- Update tests as APIs change
- Add tests for new critical functions

### When Adding Features
- Write test first (TDD approach recommended)
- Ensure all tests pass
- Update this guide if structure changes

## Troubleshooting

### Tests timeout
- Increase timeout: `it('...', async () => {...}, { timeout: 10000 })`
- Check for missing mocks

### Module not found
- Verify paths are relative to test file
- Check that modules are properly imported

### State pollution between tests
- Use `beforeEach()` to reset state
- Don't use `before/after` unless necessary

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Testing Library](https://testing-library.com)
- [Jest Matchers](https://expect.dev)
