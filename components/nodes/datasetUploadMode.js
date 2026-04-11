export function getUploadInputMode(nodeType, sourceMode) {
  const csvSourceMode = nodeType === 'dataset.csv' ? (sourceMode || 'folder') : null;
  const useDirectoryPicker = nodeType === 'dataset.image' || (nodeType === 'dataset.csv' && csvSourceMode === 'folder');
  const acceptCsvFiles = nodeType === 'dataset.csv' && csvSourceMode === 'files';

  return {
    useDirectoryPicker,
    acceptCsvFiles,
  };
}
