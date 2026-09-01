export function getUploadInputMode(nodeType, sourceMode) {
  const csvSourceMode = nodeType === 'dataset.csv' ? (sourceMode || 'folder') : null;
  const useDirectoryPicker = nodeType === 'dataset.image' || (nodeType === 'dataset.csv' && csvSourceMode === 'folder');
  const acceptCsvFiles = nodeType === 'dataset.csv' && csvSourceMode === 'files';
  const acceptJsonFiles = nodeType === 'dataset.json';

  return {
    useDirectoryPicker,
    acceptCsvFiles,
    acceptJsonFiles,
  };
}
