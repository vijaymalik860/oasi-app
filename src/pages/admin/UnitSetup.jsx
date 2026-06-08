import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import {
  Plus, Edit, Trash2, Building2, ChevronRight,
  MapPin, X, AlertTriangle, Upload, Loader2,
  FileText, CheckCircle, Info, Download
} from 'lucide-react';

export default function UnitSetup() {
  const { user, isSuperAdmin, isStateAdmin } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [nodes, setNodes] = useState([]);
  const [navigationStack, setNavigationStack] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // CSV Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [stateName, setStateName] = useState('Haryana Police');

  // Node Modal State
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);

  const [nodeForm, setNodeForm] = useState({ name: '', assignedModule: 'attendance' });

  const currentNode = navigationStack[navigationStack.length - 1] || null;

  useEffect(() => { loadNodes(); }, [navigationStack]);

  async function loadNodes() {
    try {
      setLoading(true);
      // Pass undefined (not null) so URL doesn't get ?parentId=null
      const parentId = currentNode?.id || undefined;
      const data = await api.hierarchy.nodes(parentId);
      const fetchedNodes = (data || []);
      fetchedNodes.sort((a, b) => a.name.localeCompare(b.name));
      setNodes(fetchedNodes);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load hierarchy nodes.');
    } finally {
      setLoading(false);
    }
  }

  function pushNavigation(node) {
    setNavigationStack(prev => [...prev, { id: node.id, name: node.name, node_code: node.node_code, level: node.level }]);
  }

  function popNavigation(index = -1) {
    if (index === -1) setNavigationStack([]);
    else setNavigationStack(prev => prev.slice(0, index + 1));
  }

  // ── CSV Import Logic ──

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      toast.error('Sirf CSV file allowed hai.');
      return;
    }
    setCsvFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const parsed = parseCSV(text);
      setCsvPreview(parsed.slice(0, 5)); // Show first 5 rows as preview
    };
    reader.readAsText(file);
  }

  function parseCSV(text) {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
      if (row.district || row.police_station) rows.push(row);
    }
    return rows;
  }

  async function runCSVImport() {
    if (!csvFile) { toast.warning('Pehle CSV file select karo.'); return; }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target.result;
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error('CSV mein koi valid data nahi mila.');
        return;
      }

      try {
        setImporting(true);
        const result = await api.hierarchy.importCSV(rows, stateName);
        setImportResult(result);
        toast.success(`Import ho gaya! ${result.stats.districts} Districts, ${result.stats.police_stations} PS.`);
        loadNodes();
      } catch (err) {
        toast.error('Import fail hua: ' + err.message);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(csvFile);
  }


  function downloadSampleCSV() {
    const sample = `district,police_station\nAmbala,PS City Ambala\nAmbala,PS Sadar Ambala\nAmbala,PS Mahesh Nagar\nRohtak,PS City Rohtak\nRohtak,PS Sadar Rohtak\nKurukshetra,PS City Kurukshetra\n`;
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'district_ps_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function openImportModal() {
    setCsvFile(null);
    setCsvPreview([]);
    setImportResult(null);
    setShowImportModal(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Node CRUD ──

  function openNodeModal(node = null) {
    setEditingNode(node);
    setNodeForm(node
      ? { name: node.name, assignedModule: node.assigned_module || 'attendance' }
      : { name: '', assignedModule: currentNode?.assigned_module || 'attendance' }
    );
    setShowNodeModal(true);
  }

  async function saveNode() {
    if (!nodeForm.name.trim()) { toast.warning('Node Name required hai.'); return; }
    try {
      setSaving(true);
      if (editingNode) {
        await api.hierarchy.updateNode(editingNode.id, {
          name: nodeForm.name.trim(),
          assigned_module: nodeForm.assignedModule,
        });
        toast.success('Node update ho gaya.');
      } else {
        const nextSuffix = nodes.length + 1;
        const newNodeCode = currentNode ? `${currentNode.node_code}.${nextSuffix}` : `${nextSuffix}`;
        await api.hierarchy.createNode({
          node_code: newNodeCode,
          name: nodeForm.name.trim(),
          level: currentNode ? (currentNode.level + 1) : 1,
          parent_id: currentNode?.id || null,
          is_fixed: false,
          assigned_module: nodeForm.assignedModule,
        });
        toast.success('Node ban gaya.');
      }
      setShowNodeModal(false);
      loadNodes();
    } catch (err) {
      toast.error('Node save nahi hua.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteModal) return;
    try {
      setSaving(true);
      await api.hierarchy.deleteNode(deleteModal.id);
      toast.success('Node delete ho gaya.');
      setDeleteModal(null);
      loadNodes();
    } catch (err) {
      toast.error('Delete fail hua.');
    } finally {
      setSaving(false);
    }
  }

  const levelLabel = (level) => {
    const map = { 1: 'State', 2: 'Range/Comm.', 3: 'District', 4: 'Police Station' };
    return map[level] || `Level ${level}`;
  };

  return (
    <div className="unit-setup">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Building2 size={24} className="text-primary" />
          <div>
            <h2>Unit Setup & Hierarchy</h2>
            <p className="text-sm text-gray-500">Manage organizational structure dynamically</p>
          </div>
        </div>
        <div className="actions">
          {(isSuperAdmin || isStateAdmin) && (
            <button className="btn btn-secondary mr-2" onClick={openImportModal}>
              <Upload size={16} className="mr-2" />
              Import CSV Data
            </button>
          )}
          <button className="btn btn-primary" onClick={() => openNodeModal()}>
            <Plus size={18} className="mr-2" />
            Add {currentNode ? 'Sub-Unit' : 'Level 1 Node'}
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="mb-4 bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex items-center gap-2 overflow-x-auto">
        <button
          className={`px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${navigationStack.length === 0 ? 'bg-primary/10 text-primary font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
          onClick={() => popNavigation(-1)}
        >
          Primary Hierarchy
        </button>
        {navigationStack.map((step, idx) => (
          <React.Fragment key={step.node_code}>
            <ChevronRight size={14} className="text-gray-300" />
            <button
              className={`px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${idx === navigationStack.length - 1 ? 'bg-primary/10 text-primary font-bold' : 'text-gray-600 hover:bg-gray-100'}`}
              onClick={() => popNavigation(idx)}
            >
              {step.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="panel overflow-hidden">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Index</th>
                <th>Name</th>
                <th>Level / Type</th>
                <th>Module</th>
                <th style={{ textAlign: 'right', paddingRight: '40px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8"><div className="spinner mx-auto mb-2"></div><p>Loading nodes...</p></td></tr>
              ) : nodes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center justify-center">
                      <MapPin size={48} className="mb-4 opacity-10" />
                      <p className="text-lg font-medium text-gray-500">Koi unit nahi mila</p>
                      <p className="text-sm text-gray-400 mb-6">
                        CSV import karo ya manually node add karo.
                      </p>
                      {(isSuperAdmin || isStateAdmin) && (
                        <button className="btn btn-secondary btn-sm" onClick={openImportModal}>
                          <Upload size={16} className="mr-2" /> Import CSV Data
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                nodes.map(node => (
                  <tr
                    key={node.id}
                    className="hover-trigger cursor-pointer"
                    onClick={() => pushNavigation(node)}
                    style={{ transition: 'background-color 0.2s' }}
                  >
                    <td className="text-mono text-xs text-gray-500">{node.node_code}</td>
                    <td>
                      <div className="font-semibold text-gray-900" style={{ fontSize: '1rem' }}>{node.name}</div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{levelLabel(node.level)}</span>
                      {node.is_fixed && <span className="badge badge-warning ml-2">Fixed</span>}
                    </td>
                    <td>
                      <span className={`badge ${node.assigned_module === 'chittha' ? 'badge-info' : 'badge-success'}`}>
                        {node.assigned_module || 'attendance'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="actions justify-end" style={{ paddingRight: '20px' }}>
                        {!node.is_fixed && (
                          <>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openNodeModal(node)}>
                              <Edit size={15} />
                            </button>
                            <button className="btn btn-ghost btn-icon btn-sm text-danger"
                              onClick={() => setDeleteModal({ id: node.id, name: node.name })}>
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                        <ChevronRight size={18} className="text-gray-300 ml-2" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CSV IMPORT MODAL ── */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '560px', width: '95%', margin: 'auto' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Upload size={20} style={{ color: 'var(--primary-600)' }} />
                <h3>CSV Se District & PS Import Karo</h3>
              </div>
              <button className="btn-close" onClick={() => setShowImportModal(false)}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Info Box */}
              <div style={{ background: 'var(--info-50,#eff6ff)', border: '1px solid var(--info-200,#bfdbfe)', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 10 }}>
                <Info size={18} style={{ color: 'var(--info-500,#3b82f6)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: '0.85rem', color: 'var(--info-700,#1d4ed8)' }}>
                  <strong>CSV Format:</strong> Do columns hone chahiye — <code>district</code> aur <code>police_station</code><br />
                  <strong>Result:</strong> State (Level 1) → District (Level 3) → PS (Level 4) automatically banenge.<br />
                  <strong>Note:</strong> Duplicate entries ignore ho jayenge.
                </div>
              </div>

              {/* State Name */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">State / Organization Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={stateName}
                  onChange={e => setStateName(e.target.value)}
                  placeholder="e.g. Haryana Police"
                />
              </div>

              {/* File Upload Area */}
              <div>
                <label className="form-label">CSV File Select Karo</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--gray-300)',
                    borderRadius: 10,
                    padding: '24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: csvFile ? 'var(--success-50,#f0fdf4)' : 'var(--gray-50)',
                    borderColor: csvFile ? 'var(--success-400,#4ade80)' : 'var(--gray-300)',
                    transition: 'all 0.2s'
                  }}
                >
                  {csvFile ? (
                    <div style={{ color: 'var(--success-600,#16a34a)' }}>
                      <CheckCircle size={28} style={{ marginBottom: 8 }} />
                      <p style={{ fontWeight: 600 }}>{csvFile.name}</p>
                      <p style={{ fontSize: '0.8rem' }}>Click to change</p>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--gray-400)' }}>
                      <FileText size={28} style={{ marginBottom: 8 }} />
                      <p style={{ fontWeight: 500, color: 'var(--gray-600)' }}>CSV file yahan click karke select karo</p>
                      <p style={{ fontSize: '0.8rem' }}>Format: district, police_station</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
              </div>

              {/* Preview */}
              {csvPreview.length > 0 && (
                <div>
                  <label className="form-label">Preview (pehli 5 rows)</label>
                  <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden' }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>District</th>
                          <th>Police Station</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, i) => (
                          <tr key={i}>
                            <td>{row.district || '—'}</td>
                            <td>{row.police_station || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Result */}
              {importResult && (
                <div style={{ background: 'var(--success-50,#f0fdf4)', border: '1px solid var(--success-200,#bbf7d0)', borderRadius: 8, padding: '12px 16px' }}>
                  <p style={{ color: 'var(--success-700,#15803d)', fontWeight: 600, marginBottom: 4 }}>✅ Import Successful!</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--success-600)' }}>
                    State: <strong>{importResult.stats?.state}</strong> &nbsp;|&nbsp;
                    Districts: <strong>{importResult.stats?.districts}</strong> &nbsp;|&nbsp;
                    Police Stations: <strong>{importResult.stats?.police_stations}</strong>
                    {importResult.stats?.skipped > 0 && <> &nbsp;|&nbsp; Skipped: <strong>{importResult.stats.skipped}</strong></>}
                  </p>
                </div>
              )}

              {/* Sample Download */}
              <button
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={downloadSampleCSV}
              >
                <Download size={14} className="mr-1" /> Sample CSV Download Karo
              </button>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>
                {importResult ? 'Close' : 'Cancel'}
              </button>
              {!importResult && (
                <button
                  className="btn btn-primary"
                  onClick={runCSVImport}
                  disabled={importing || !csvFile}
                >
                  {importing
                    ? <><Loader2 size={16} className="animate-spin mr-2" />Importing...</>
                    : <><Upload size={16} className="mr-2" />Import Karo</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── NODE MODAL ── */}
      {showNodeModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px', margin: 'auto' }}>
            <div className="modal-header">
              <h3>{editingNode ? 'Edit Node' : `Add to ${currentNode?.name || 'Root'}`}</h3>
              <button className="btn-close" onClick={() => setShowNodeModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Node Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={nodeForm.name}
                  onChange={e => setNodeForm({ ...nodeForm, name: e.target.value })}
                  placeholder="e.g. Ambala Range, 1st Bn HAP..."
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Assigned Module</label>
                <select
                  className="form-select"
                  value={nodeForm.assignedModule}
                  onChange={e => setNodeForm({ ...nodeForm, assignedModule: e.target.value })}
                >
                  <option value="attendance">Attendance Register</option>
                  <option value="chittha">Chittha / Duty Management</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNodeModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveNode} disabled={saving}>
                {saving ? 'Saving...' : editingNode ? 'Update Node' : 'Create Node'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {deleteModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px', margin: 'auto' }}>
            <div className="modal-header" style={{ color: 'var(--danger-600)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} />
                <h3>Delete Node?</h3>
              </div>
            </div>
            <div className="modal-body">
              <p>Kya aap <strong>{deleteModal.name}</strong> delete karna chahte ho?</p>
              <p className="text-sm text-gray-500 mt-2">Iske saath linked personnel ki node_id NULL ho jayegi.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={saving}>
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
