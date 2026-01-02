import JSZip from 'jszip';

export const downloadZip = async (tree) => {
  const zip = new JSZip();
  
  const addNodeToZip = (node, currentZipFolder) => {
    if (node.type === 'file') {
      currentZipFolder.file(node.name, node.content || "");
    } else {
      const newFolder = currentZipFolder.folder(node.name);
      if (node.children) {
        node.children.forEach(child => addNodeToZip(child, newFolder));
      }
    }
  };

  tree.children.forEach(child => addNodeToZip(child, zip));
  
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tree.name}.zip`;
  a.click();
  URL.revokeObjectURL(url);
};