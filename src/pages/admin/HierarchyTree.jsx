import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, ChevronRight, ChevronDown, Save, X, RefreshCw } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';

// Recursive Tree Node Component
function TreeNode({ node, onAddChild, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);

  // Load children when expanded
  useEffect(() => {
    if (expanded && children.length === 0) {
      loadChildren();
    }
  }, [expanded]);

  async function loadChildren() {
    setLoading(true);
    try {
      const data = await api.hierarchy.nodes(node.id);
      setChildren(data || []);
    } catch (err) {
      console.error('Failed to load children', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!editName.trim()) return;
    await onEdit(node.id, editName);
    setIsEditing(false);
  }

  // To refresh children from parent when a new child is added
  const refreshChildren = async () => {
    if (expanded) await loadChildren();
    else setExpanded(true); // Expanding will auto-load
  };

  return (
    <div className="tree-node" style={{ marginLeft: node.level === 1 ? 0 : '1.5rem', marginTop: '0.5rem' }}>
      <div className="flex items-center justify-between p-2 border rounded bg-white hover:bg-gray-50 group">
        <div className="flex items-center gap-2 flex-1">
          {/* Expand/Collapse Button */}
          <button 
            className="p-1 rounded hover:bg-gray-200 text-gray-500"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          
          <Building2 size={16} className={node.level === 1 ? 'text-blue-600' : 'text-gray-400'} />
          
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="form-input text-sm py-1"
                autoFocus
              />
              <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800"><Save size={16} /></button>
              <button onClick={() => { setIsEditing(false); setEditName(node.name); }} className="text-red-600 hover:text-red-800"><X size={16} /></button>
            </div>
          ) : (
            <span className="font-semibold text-sm">
              {node.name} 
              <span className="text-xs text-gray-400 font-normal ml-2">(Level {node.level})</span>
            </span>
          )}
        </div>

        {/* Action Buttons (Visible on hover) */}
        {!isEditing && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onAddChild(node, refreshChildren)} className="text-blue-600 hover:text-blue-800" title="Add Sub-unit">
              <Plus size={16} />
            </button>
            {!node.is_fixed && (
              <>
                <button onClick={() => setIsEditing(true)} className="text-gray-600 hover:text-gray-800" title="Edit">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => onDelete(node.id)} className="text-red-600 hover:text-red-800" title="Delete">
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Children Container */}
      {expanded && (
        <div className="children-container border-l-2 border-gray-200 ml-3">
          {loading ? (
            <div className="text-xs text-gray-400 ml-6 my-2">Loading sub-units...</div>
          ) : children.length === 0 ? (
            <div className="text-xs text-gray-400 ml-6 my-2">No sub-units found.</div>
          ) : (
            children.map(child => (
              <TreeNode 
                key={child.id} 
                node={child} 
                onAddChild={onAddChild} 
                onEdit={onEdit} 
                onDelete={onDelete} 
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function HierarchyTree() {
  const [rootNodes, setRootNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    loadHierarchy();
  }, []);

  async function loadHierarchy() {
    setLoading(true);
    try {
      // Fetch level 1 nodes (parentId = null doesn't strictly work in query string if it checks for string 'null', 
      // but the backend handles `parentId` absent as root)
      const data = await api.hierarchy.nodes(); 
      setRootNodes(data || []);
    } catch (err) {
      toast.error('Failed to load hierarchy roots');
    } finally {
      setLoading(false);
    }
  }

  // --- Actions ---
  
  const handleAddChild = async (parentNode, refreshParent) => {
    const childName = prompt(`Enter name for the new sub-unit under ${parentNode.name}:`);
    if (!childName || !childName.trim()) return;

    try {
      const newNode = {
        name: childName.trim(),
        level: parentNode.level + 1,
        parent_id: parentNode.id,
        node_code: `UNIT-${Date.now()}`, // Auto-generate a unique code
      };
      await api.hierarchy.createNode(newNode);
      toast.success('Sub-unit added successfully');
      refreshParent(); // Refresh the parent's children list
    } catch (err) {
      toast.error(err.message || 'Failed to add sub-unit');
    }
  };

  const handleEdit = async (id, newName) => {
    try {
      await api.hierarchy.updateNode(id, { name: newName });
      toast.success('Node updated successfully');
      // A quick reload of the entire tree state could be heavy, 
      // but for root nodes we just reload. Children handle their own local state updates in the component.
      if (rootNodes.find(n => n.id === id)) {
        loadHierarchy();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update node');
      throw err; // throw so the child component knows it failed
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this unit? All sub-units inside it might be affected.')) return;
    try {
      await api.hierarchy.deleteNode(id);
      toast.success('Unit deleted successfully');
      // For a robust UI we'd remove it from the state, but reloading root is safe if it's a root.
      // If it's a child, we currently rely on the user to collapse/expand to refresh, or we can reload everything.
      // For now, reloading everything guarantees consistency.
      loadHierarchy();
    } catch (err) {
      toast.error(err.message || 'Failed to delete unit');
    }
  };

  const handleAddRoot = async () => {
    const rootName = prompt('Enter name for the new Root Unit (e.g. PHQ):');
    if (!rootName || !rootName.trim()) return;

    try {
      const newNode = {
        name: rootName.trim(),
        level: 1,
        parent_id: null,
        node_code: `ROOT-${Date.now()}`,
      };
      await api.hierarchy.createNode(newNode);
      toast.success('Root unit added');
      loadHierarchy();
    } catch (err) {
      toast.error(err.message || 'Failed to add root unit');
    }
  };

  return (
    <div className="panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="panel-header">
        <h3>Organization Hierarchy</h3>
        <div className="flex gap-2">
          <button onClick={loadHierarchy} className="btn btn-ghost btn-sm" title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button onClick={handleAddRoot} className="btn btn-primary btn-sm">
            <Plus size={16} /> Add Root Unit
          </button>
        </div>
      </div>
      <div className="panel-body">
        <p className="text-gray-500 text-sm mb-4">
          Manage the organization structure from Headquarters down to individual Chowkis.
          Click the <ChevronRight size={14} className="inline" /> arrow to view sub-units.
        </p>
        
        {loading ? (
          <div className="spinner" style={{ margin: '2rem auto' }}></div>
        ) : rootNodes.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No organization units found. Click "Add Root Unit" to start.
          </div>
        ) : (
          <div className="tree-container">
            {rootNodes.map(node => (
              <TreeNode 
                key={node.id} 
                node={node} 
                onAddChild={handleAddChild} 
                onEdit={handleEdit} 
                onDelete={handleDelete} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
