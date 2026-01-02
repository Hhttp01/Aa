import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Folder, FileText, Plus, ChevronRight, ChevronDown, Trash2, Search, Code2, 
  X, Layers, FileJson, FileCode, Globe, Hash, Download, PlusSquare, 
  FolderPlus, FilePlus, RefreshCcw 
} from 'lucide-react';
import { generateId, cleanNameString, getFileIcon } from './utils/helpers';
import { downloadZip } from './utils/zipService';

const EMPTY_PROJECT_STRUCTURE = { id: 'root', name: 'new-project', type: 'folder', children: [] };

const App = () => {
  const [tree, setTree] = useState(() => {
    const saved = localStorage.getItem('path-forge-tree');
    return saved ? JSON.parse(saved) : EMPTY_PROJECT_STRUCTURE;
  });
  const [editingFileId, setEditingFileId] = useState(null);
  const [bulkPathInput, setBulkPathInput] = useState("");
  const [quickPath, setQuickPath] = useState(""); 
  const [expandedFolders, setExpandedFolders] = useState(new Set(['root'])); 
  const [searchTerm, setSearchTerm] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    localStorage.setItem('path-forge-tree', JSON.stringify(tree));
  }, [tree]);

  const findNodeById = useCallback((node, id) => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const createPathInTree = (fullPath, currentTree, currentExpanded) => {
    const segments = fullPath.split('/').map(s => cleanNameString(s)).filter(s => s !== "");
    let currentNode = currentTree;
    segments.forEach((part, index) => {
      const isLast = index === segments.length - 1;
      const isFile = isLast && part.includes('.') && !fullPath.endsWith('/');
      let existingNode = currentNode.children.find(c => c.name === part);
      if (!existingNode) {
        existingNode = { id: generateId(), name: part, type: isFile ? 'file' : 'folder', content: isFile ? "" : undefined, children: isFile ? undefined : [] };
        currentNode.children.push(existingNode);
      }
      if (existingNode.type === 'folder') {
        currentExpanded.add(existingNode.id);
        currentNode = existingNode;
      }
    });
    return { newTree: currentTree, newExpanded: currentExpanded };
  };

  const addNewItemManual = (parentId, type) => {
    const name = type === 'folder' ? 'new-folder' : 'new-file.txt';
    const newTree = JSON.parse(JSON.stringify(tree));
    const parentNode = parentId === 'root' ? newTree : findNodeById(newTree, parentId);
    if (parentNode && parentNode.type === 'folder') {
      const newNode = { id: generateId(), name: name, type: type, content: type === 'file' ? "" : undefined, children: type === 'folder' ? [] : undefined };
      parentNode.children.push(newNode);
      const newExpanded = new Set(expandedFolders);
      newExpanded.add(parentId);
      setTree(newTree);
      setExpandedFolders(newExpanded);
      if (type === 'file') setEditingFileId(newNode.id);
    }
  };

  const deleteNode = (id, e) => {
    e.stopPropagation();
    const newTree = JSON.parse(JSON.stringify(tree));
    const deleteRecursive = (node) => {
      if (!node.children) return false;
      const idx = node.children.findIndex(c => c.id === id);
      if (idx !== -1) { node.children.splice(idx, 1); return true; }
      return node.children.some(deleteRecursive);
    };
    deleteRecursive(newTree);
    setTree(newTree);
    if (editingFileId === id) setEditingFileId(null);
  };

  const updateFileContent = (newContent) => {
    if (!editingFileId) return;
    const newTree = JSON.parse(JSON.stringify(tree));
    const updateRecursive = (node) => {
      if (node.id === editingFileId) { node.content = newContent; return true; }
      return node.children ? node.children.some(updateRecursive) : false;
    };
    updateRecursive(newTree);
    setTree(newTree);
  };

  const getFileIconComponent = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    switch(ext) {
      case 'html': return <Globe size={16} className="text-orange-400" />;
      case 'json': return <FileJson size={16} className="text-yellow-400" />;
      case 'css': return <Hash size={16} className="text-blue-400" />;
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx': return <FileCode size={16} className="text-blue-300" />;
      default: return <FileText size={16} className="text-slate-400" />;
    }
  };

  const renderTree = (node, depth = 0) => {
    if (node.id !== 'root' && searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase()) && node.type === 'file') return null;
    const isExpanded = expandedFolders.has(node.id);
    const isActive = editingFileId === node.id;

    return (
      <div key={node.id} className="select-none">
        {node.id !== 'root' && (
          <div 
            onClick={() => {
              if (node.type === 'folder') {
                const next = new Set(expandedFolders);
                isExpanded ? next.delete(node.id) : next.add(node.id);
                setExpandedFolders(next);
              } else { setEditingFileId(node.id); }
            }}
            className={`group flex items-center gap-2 py-1 px-3 cursor-pointer rounded-lg transition-all
              ${isActive ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-100'}`}
            style={{ paddingRight: `${depth * 14}px` }}
          >
            <span className="shrink-0 opacity-50">
              {node.type === 'folder' ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <div className="w-3.5" />}
            </span>
            <span className="shrink-0">
              {node.type === 'folder' ? <Folder size={15} className={isExpanded ? 'text-blue-400' : 'text-slate-500'} /> : getFileIconComponent(node.name)}
            </span>
            <span className="text-sm truncate flex-1 font-medium">{node.name}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all mr-auto">
                {node.type === 'folder' && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); addNewItemManual(node.id, 'file'); }} className="p-1 hover:bg-green-500/20 text-green-500 rounded"><FilePlus size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); addNewItemManual(node.id, 'folder'); }} className="p-1 hover:bg-blue-500/20 text-blue-400 rounded"><FolderPlus size={12} /></button>
                  </>
                )}
                <button onClick={(e) => deleteNode(node.id, e)} className="p-1 hover:bg-red-500/20 text-red-400 rounded"><Trash2 size={12} /></button>
            </div>
          </div>
        )}
        {(isExpanded || node.id === 'root') && node.children && (
          <div className={node.id === 'root' ? '' : 'border-r border-slate-800/50 mr-4'}>
            {node.children.map(child => renderTree(child, node.id === 'root' ? 0 : depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const activeFile = useMemo(() => editingFileId ? findNodeById(tree, editingFileId) : null, [editingFileId, tree, findNodeById]);

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 text-slate-200 overflow-hidden font-sans" dir="rtl">
      <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/40 backdrop-blur-xl z-30">
        <div className="flex items-center gap-4">
          <Code2 size={24} className="text-blue-500" />
          <h1 className="text-sm font-bold">Path Forge <span className="text-blue-500">Lite</span></h1>
        </div>
        <button onClick={() => downloadZip(tree)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-600/20">
          <Download size={14} /> הורד פרויקט (ZIP)
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-l border-slate-800 bg-slate-900/20 flex flex-col shrink-0">
          <div className="p-4 space-y-4 border-b border-slate-800/50">
            <input 
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-green-500 font-mono"
              placeholder="נתיב מהיר (src/api/user.js)" 
              value={quickPath}
              onChange={e => setQuickPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickPath.trim()) {
                  const newTree = JSON.parse(JSON.stringify(tree));
                  const res = createPathInTree(quickPath.trim(), newTree, new Set(expandedFolders));
                  setTree(res.newTree); setExpandedFolders(res.newExpanded); setQuickPath("");
                }
              }}
            />
            <div className="relative group">
              <Search className="absolute right-3 top-2.5 text-slate-600" size={14} />
              <input className="w-full bg-slate-950/50 border border-slate-800 rounded-lg pr-9 pl-3 py-2 text-xs outline-none" placeholder="חיפוש..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <textarea className="w-full h-24 bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] outline-none font-mono" placeholder="הדבק רשימת נתיבים..." value={bulkPathInput} onChange={e => setBulkPathInput(e.target.value)} />
            <button onClick={() => {
              let newTree = JSON.parse(JSON.stringify(tree));
              let newExpanded = new Set(expandedFolders);
              bulkPathInput.split('\n').filter(l => l.trim()).forEach(line => createPathInTree(line.trim(), newTree, newExpanded));
              setTree(newTree); setExpandedFolders(newExpanded); setBulkPathInput("");
            }} className="w-full bg-slate-800 py-2 rounded-lg text-xs font-bold transition-all">בצע בנייה</button>
            <button onClick={() => {if(window.confirm('לאפס?')) setTree(EMPTY_PROJECT_STRUCTURE)}} className="w-full text-[10px] text-red-500 flex items-center justify-center gap-1"><RefreshCcw size={10}/> איפוס פרויקט</button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-4">{renderTree(tree)}</div>
        </aside>

        <main className="flex-1 flex flex-col bg-slate-950">
          {activeFile ? (
            <div className="h-full flex flex-col">
              <div className="h-11 border-b border-slate-800 flex items-center justify-between bg-slate-900/30 px-4">
                <span className="text-xs text-blue-400 font-mono">{activeFile.name}</span>
                <button onClick={() => setEditingFileId(null)} className="hover:text-white"><X size={14} /></button>
              </div>
              <textarea 
                className="flex-1 bg-transparent p-6 outline-none font-mono text-sm leading-relaxed text-slate-300 resize-none" 
                value={activeFile.content || ""} 
                onChange={e => updateFileContent(e.target.value)} 
                spellCheck="false" 
              />
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-800 opacity-30 select-none">
              <Code2 size={120} className="mb-6" />
              <p className="text-sm font-bold uppercase tracking-widest">בחר קובץ</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;