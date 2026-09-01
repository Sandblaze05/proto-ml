import { describe, expect, it } from 'vitest';
import { getUploadInputMode } from '../../components/nodes/datasetUploadMode';

describe('getUploadInputMode', () => {
  it('uses directory picker for image datasets', () => {
    const mode = getUploadInputMode('dataset.image');
    expect(mode).toEqual({
      useDirectoryPicker: true,
      acceptCsvFiles: false,
      acceptJsonFiles: false,
    });
  });

  it('uses directory picker for csv folder mode', () => {
    const mode = getUploadInputMode('dataset.csv', 'folder');
    expect(mode).toEqual({
      useDirectoryPicker: true,
      acceptCsvFiles: false,
      acceptJsonFiles: false,
    });
  });

  it('uses file picker with csv accept filter for explicit files mode', () => {
    const mode = getUploadInputMode('dataset.csv', 'files');
    expect(mode).toEqual({
      useDirectoryPicker: false,
      acceptCsvFiles: true,
      acceptJsonFiles: false,
    });
  });

  it('defaults csv source mode to folder', () => {
    const mode = getUploadInputMode('dataset.csv');
    expect(mode).toEqual({
      useDirectoryPicker: true,
      acceptCsvFiles: false,
      acceptJsonFiles: false,
    });
  });

  it('uses file picker with json accept filter for json datasets', () => {
    const mode = getUploadInputMode('dataset.json');
    expect(mode).toEqual({
      useDirectoryPicker: false,
      acceptCsvFiles: false,
      acceptJsonFiles: true,
    });
  });
});
