import { useState, useEffect } from 'react';
import { X, Search, Check, User } from 'lucide-react';
import { api } from '../../api/client';
export default function OfficerPickerModal({ isOpen, onClose, onAdd, unitId }) {
  const [loading, setLoading] = useState(false);
  const [officers, setOfficers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchOfficers();
      setSelectedIds(new Set());
      setSearchTerm('');
    }
  }, [isOpen, unitId]);

  async function fetchOfficers() {
    try {
      setLoading(true);
      const data = await api.personnel.list({ unit_id: unitId });
      
      setOfficers((data||[]).map(o => ({
        id: o.id,
        fullName: o.full_name,
        rank: o.rank,
        beltNumber: o.belt_number,
        mobileNumber: o.mobile_number,
        ...o
      })));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Fetch officers error:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredOfficers = officers.filter(o => 
    (o.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.beltNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.rank || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleAdd = () => {
    const selected = officers.filter(o => selectedIds.has(o.id));
    onAdd(selected);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3><User size={20} style={{ marginRight: 8 }} /> Add Officer from Database</h3>
          <button className="btn btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="search-input-wrapper" style={{ marginBottom: 16 }}>
            <Search className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by Name, Rank or Belt No..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          
          {loading ? (
             <div className="spinner-container"><div className="spinner"></div></div>
          ) : filteredOfficers.length === 0 ? (
             <p style={{ textAlign: 'center', color: '#999', padding: 40 }}>No officers found.</p>
          ) : (
            <div className="officer-picker-list">
              {filteredOfficers.map(off => (
                <div 
                  key={off.id} 
                  className={`officer-picker-item ${selectedIds.has(off.id) ? 'selected' : ''}`}
                  onClick={() => toggleSelect(off.id)}
                >
                  <div className="select-box">
                    {selectedIds.has(off.id) && <Check size={14} color="white" />}
                  </div>
                  <div className="off-info">
                    <span className="off-rank">{off.rank}</span>
                    <span className="off-name">{off.fullName}</span>
                    <span className="off-belt">#{off.beltNumber}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{selectedIds.size} selected</span>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-gold" onClick={handleAdd} disabled={selectedIds.size === 0}>
              Add {selectedIds.size} Selected
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .officer-picker-list { display: flex; flexDirection: column; gap: 8px; }
        .officer-picker-item { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--gray-200); border-radius: 10px; cursor: pointer; transition: all 0.2s; }
        .officer-picker-item:hover { background: var(--gray-50); border-color: var(--primary-200); }
        .officer-picker-item.selected { background: var(--primary-50); border-color: var(--primary-300); }
        
        .select-box { width: 20px; height: 20px; border: 2px solid var(--gray-300); border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .selected .select-box { background: var(--blue-active); border-color: var(--blue-active); }
        
        .off-info { display: flex; align-items: center; gap: 12px; }
        .off-rank { font-size: 0.75rem; font-weight: 700; color: white; background: var(--navy); padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
        .off-name { font-weight: 600; color: var(--gray-800); }
        .off-belt { font-size: 0.8rem; color: var(--gray-500); }
      `}</style>
    </div>
  );
}
