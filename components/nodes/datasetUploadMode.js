export function getUploadInputMode(nodeType, sourceMode) {
  const csvSourceMode = nodeType === 'dataset.csv' ? (sourceMode || 'folder') : null;
  const textSourceMode = nodeType === 'dataset.text' ? (sourceMode || 'file') : null;
  const useDirectoryPicker = nodeType === 'dataset.image' || (nodeType === 'dataset.csv' && csvSourceMode === 'folder') || (nodeType === 'dataset.text' && textSourceMode === 'folder');
  const acceptCsvFiles = nodeType === 'dataset.csv' && csvSourceMode === 'files';
  const acceptJsonFiles = nodeType === 'dataset.json';
  const acceptTextFiles = nodeType === 'dataset.text' && textSourceMode === 'file';

  return {
    useDirectoryPicker,
    acceptCsvFiles,
    acceptJsonFiles,
    acceptTextFiles,
  };
}
