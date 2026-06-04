import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ClipboardList, Trash2, Edit2, Eye, Copy, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';

export default function ChitthaList() {
  const { user, isDistrictAdmin, isStateAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [chitthas, setChitthas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedForCopy, setSelectedForCopy] = useState(null);

  useEffect(() => {
    fetchChitthas();
  }, [user]);

  async function fetchChitthas() {
    try {
      setLoading(true);
      const data = await api.chitthas.list();
      setChitthas((data || []).map(c => ({
        id: c.id,
        ...c,
        chitthaDate: c.chittha_date,
        unitName: c.unit_name || 'Unknown Unit',
        sectionCount: 12
      })));
    } catch (err) {
      console.error(err);
      toast.error('Failed to load chitthas');
    } finally {
      setLoading(false);
    }
  }

  const filteredChitthas = useMemo(() => {
    return chitthas.filter(c => {
      const matchUnit = (c.unitName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchDate = selectedDate ? c.chitthaDate === selectedDate : true;
      return matchUnit && matchDate;
    });
  }, [chitthas, searchTerm, selectedDate]);

  const groupedChitthas = useMemo(() => {
    const groups = {};
    filteredChitthas.forEach(c => {
      if (!groups[c.chitthaDate]) groups[c.chitthaDate] = [];
      groups[c.chitthaDate].push(c);
    });
    return groups;
  }, [filteredChitthas]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this duty roster?')) return;
    try {
      setLoading(true);
      await api.chitthas.remove(id);
      toast.success('Roster deleted successfully');
      fetchChitthas();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete roster');
      setLoading(false);
    }
  }

  return (
    <div className="chittha-list-page">
      <div className="page-header">
        <div className="header-text">
          <h2>📝 Naukari Chittha</h2>
          <p className="sub-heading">Daily Duty Rosters — {user?.districtName || 'Hisar'}</p>
        </div>
        <button className="btn btn-gold" onClick={() => navigate('/chitthas/new')}>
          <Plus size={18} /> New
        </button>
      </div>

      <div className="panel" style={{ marginBottom: 24, padding: '12px 16px' }}>
        <div className="search-filter-bar">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input 
              type="text" 
              placeholder="Filter by Unit..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <input 
            type="date" 
            className="filter-select" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          {(searchTerm || selectedDate) && (
            <button className="btn btn-ghost" onClick={() => { setSearchTerm(''); setSelectedDate(''); }}>Clear</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="spinner-container"><div className="spinner"></div></div>
      ) : Object.keys(groupedChitthas).length === 0 ? (
        <div className="empty-state">
           <ClipboardList size={48} opacity={0.2} />
           <p>No rosters found matching your filters.</p>
        </div>
      ) : (
        <div className="chittha-date-groups">
          {Object.keys(groupedChitthas).map(date => (
            <div key={date} className="date-group">
              <div className="date-divider">
                <span>{formatDate(date)}</span>
              </div>
              <div className="chittha-grid">
                {groupedChitthas[date].map(chittha => (
                  <div key={chittha.id} className="chittha-card">
                    <div className="card-main">
                      <div className="unit-icon-box">
                        <ClipboardList size={22} color="white" />
                      </div>
                      <div className="unit-info">
                        <h4 className="unit-name">{chittha.unitName || 'Unit Name'}</h4>
                        <div className="unit-meta">
                          <span>{chittha.dateLabel || formatDate(chittha.chitthaDate)}</span>
                          <span className="dot">•</span>
                          <span>{chittha.sectionCount || 12} sections</span>
                        </div>
                        {chittha.isCopied && <span className="badge-copied">📋 Copied</span>}
                      </div>
                    </div>
                    
                    <div className="card-actions desktop-only">
                      <button className="btn-icon-text" onClick={() => navigate(`/chitthas/${chittha.id}`)} title="View"><Eye size={16} /> View</button>
                      <button className="btn-icon-text" onClick={() => navigate(`/chitthas/edit/${chittha.id}`)} title="Edit"><Edit2 size={16} /> Edit</button>
                      <button className="btn-icon-text" onClick={() => { setSelectedForCopy(chittha); setShowCopyModal(true); }} title="Copy"><Copy size={16} /> Copy</button>
                      <button className="btn-icon-text delete" onClick={() => handleDelete(chittha.id)} title="Delete"><Trash2 size={16} /></button>
                    </div>

                    {/* Mobile action grid */}
                    <div className="card-actions-mobile">
                      <button onClick={() => navigate(`/chitthas/${chittha.id}`)}><Eye size={18} /> View</button>
                      <button onClick={() => navigate(`/chitthas/edit/${chittha.id}`)}><Edit2 size={18} /> Edit</button>
                      <button onClick={() => { setSelectedForCopy(chittha); setShowCopyModal(true); }}><Copy size={18} /> Copy</button>
                      <button className="delete" onClick={() => handleDelete(chittha.id)}><Trash2 size={18} /> Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Copy Modal Simulator */}
      {showCopyModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Copy Roster</h3>
              <button className="btn btn-ghost" onClick={() => setShowCopyModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
               <div className="form-group">
                 <label className="form-label">New Date</label>
                 <input type="date" className="form-input" defaultValue={new Date().toISOString().split('T')[0]} />
               </div>
               <div className="form-group">
                 <label className="form-label">Roster Name / Version</label>
                 <input type="text" className="form-input" defaultValue={`${selectedForCopy?.unitName} v2`} />
               </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCopyModal(false)}>Cancel</button>
              <button className="btn btn-gold" onClick={() => { toast.success('Roster copied successfully'); setShowCopyModal(false); }}>Copy Now</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .btn-gold { background-color: var(--gold); color: white; border: none; }
        .btn-gold:hover { background-color: #d19914; }
        .sub-heading { color: var(--gray-500); font-size: 0.8525rem; margin-top: 4px; }
        
        .date-divider { position: relative; display: flex; align-items: center; margin: 32px 0 16px; font-size: 0.75rem; font-weight: 700; color: var(--gray-400); text-transform: uppercase; letter-spacing: 1px; }
        .date-divider::after { content: ''; flex: 1; height: 1px; background: var(--gray-200); margin-left: 16px; }

        .chittha-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 16px; }
        @media (max-width: 768px) { .chittha-grid { grid-template-columns: 1fr; } }

        .chittha-card { background: white; border: 1px solid var(--gray-200); border-radius: var(--radius-lg); padding: 16px; transition: transform 0.2s, box-shadow 0.2s; position: relative; }
        .chittha-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
        
        .card-main { display: flex; gap: 16px; margin-bottom: 12px; }
        .unit-icon-box { min-width: 48px; min-height: 48px; background: var(--navy); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .unit-info { flex: 1; }
        .unit-name { margin: 0; font-size: 1rem; color: var(--navy); font-weight: 700; }
        .unit-meta { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--gray-500); margin-top: 4px; }
        .dot { color: var(--gray-300); }
        .badge-copied { background: #eef2ff; color: #4338ca; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-top: 8px; display: inline-block; }

        .card-actions { display: flex; border-top: 1px solid var(--gray-100); padding-top: 12px; gap: 4px; }
        .btn-icon-text { background: none; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; color: var(--gray-600); display: flex; align-items: center; gap: 6px; cursor: pointer; transition: background 0.2s; }
        .btn-icon-text:hover { background: var(--gray-50); color: var(--navy); }
        .btn-icon-text.delete:hover { background: var(--danger-50); color: var(--danger-600); }
        
        .card-actions-mobile { display: none; }

        @media (max-width: 600px) {
          .card-actions { display: none; }
          .card-actions-mobile { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--gray-100); margin-top: 16px; margin: 16px -16px -16px -16px; }
          .card-actions-mobile button { background: none; border: none; padding: 12px; font-size: 0.8rem; font-weight: 600; color: var(--gray-700); border-right: 1px solid var(--gray-100); border-bottom: 1px solid var(--gray-100); display: flex; flex-direction: column; align-items: center; gap: 6px; }
          .card-actions-mobile button:nth-child(2n) { border-right: none; }
          .card-actions-mobile button.delete { color: var(--danger-600); }
        }
      `}</style>
    </div>
  );
}
