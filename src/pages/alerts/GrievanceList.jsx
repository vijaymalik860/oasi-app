import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Search, Plus, X,
  Clock, CheckCircle, AlertCircle, User, Calendar, MapPin
} from 'lucide-react';

const GRIEVANCE_STATUSES = [
  { value: 'Pending',     label: 'Pending',     color: 'badge-warning' },
  { value: 'In Progress', label: 'In Progress', color: 'badge-info'    },
  { value: 'Escalated',  label: 'Escalated',   color: 'badge-danger'  },
  { value: 'Resolved',   label: 'Resolved',    color: 'badge-success' },
  { value: 'Closed',     label: 'Closed',      color: 'badge-neutral' },
];

const STATUS_ICONS = {
  'Pending':     <Clock size={16} />,
  'In Progress': <AlertCircle size={16} />,
  'Escalated':   <AlertCircle size={16} />,
  'Resolved':    <CheckCircle size={16} />,
  'Closed':      <X size={16} />,
};

const NEXT_ROLE = {
  unit_admin:     'district_admin',
  district_admin: 'state_admin',
  range_admin:    'state_admin',
  state_admin:    'super_admin',
};
const ROLE_LABEL = {
  district_admin: 'District Admin',
  state_admin:    'State Admin (PHQ)',
  super_admin:    'Super Admin (HQ)',
};

// ── Detail Modal ──────────────────────────────────────────────
function GrievanceDetailModal({ grievance, onClose, onStatusChange, onForward, userRole }) {
  const [updating, setUpdating]             = useState(false);
  const [forwarding, setForwarding]         = useState(false);
  const [showForwardBox, setShowForwardBox] = useState(false);
  const [forwardNotes, setForwardNotes]     = useState('');
  if (!grievance) return null;

  const statusInfo = GRIEVANCE_STATUSES.find(s => s.value === grievance.status);
  const nextRole   = NEXT_ROLE[userRole];
  const canForward = nextRole && !['Resolved', 'Closed'].includes(grievance.status);

  async function handleStatusChange(newStatus) {
    setUpdating(true);
    await onStatusChange(grievance.id, newStatus);
    setUpdating(false);
  }

  async function handleForward() {
    setForwarding(true);
    await onForward(grievance.id, forwardNotes);
    setForwarding(false);
    setShowForwardBox(false);
    setForwardNotes('');
  }

  // Status color map for header gradient
  const STATUS_GRADIENT = {
    'Pending':     'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    'In Progress': 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    'Escalated':   'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
    'Resolved':    'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    'Closed':      'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
  };
  const STATUS_TEXT_COLOR = {
    'Pending': '#92400e', 'In Progress': '#1e40af',
    'Escalated': '#991b1b', 'Resolved': '#065f46', 'Closed': '#374151',
  };

  const SectionLabel = ({ children, color = 'var(--primary-500)' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </span>
    </div>
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: 'var(--white)', borderRadius: '16px', width: '100%', maxWidth: '720px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 80px rgba(0,0,0,0.35)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Colored Header ── */}
        <div style={{ background: STATUS_GRADIENT[grievance.status] || 'var(--gray-100)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <MessageSquare size={18} color={STATUS_TEXT_COLOR[grievance.status]} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: STATUS_TEXT_COLOR[grievance.status], textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Grievance Details
              </span>
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--gray-900)', marginBottom: 6, maxWidth: 500 }}>
              {grievance.grievance_type || grievance.subject || 'Untitled Grievance'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className={`badge ${statusInfo?.color}`} style={{ fontSize: '0.78rem' }}>
                {STATUS_ICONS[grievance.status]}&nbsp;{grievance.status}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={12} />
                {new Date(grievance.created_at || grievance.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              {grievance.node_name && (
                <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={12} /> {grievance.node_name}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.08)', border: 'none', borderRadius: 8, cursor: 'pointer', padding: '6px 8px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <X size={18} color="var(--gray-600)" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Complainant Card */}
          <div>
            <SectionLabel>Complainant</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--gray-200)', backgroundColor: 'var(--white)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.2rem', flexShrink: 0 }}>
                {(grievance.applicant_name || 'U')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--gray-900)' }}>
                  {grievance.applicant_name || '—'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {grievance.applicant_mobile && <span>📞 {grievance.applicant_mobile}</span>}
                  {grievance.node_name && <span>ðŸ“ {grievance.node_name}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <SectionLabel>Description</SectionLabel>
            <div style={{ padding: '14px 16px', backgroundColor: 'var(--gray-50)', borderRadius: 10, fontSize: '0.9rem', color: 'var(--gray-700)', lineHeight: 1.7, whiteSpace: 'pre-wrap', border: '1px solid var(--gray-100)' }}>
              {grievance.description || '—'}
            </div>
          </div>

          {/* Attachments with image preview */}
          {Array.isArray(grievance.attachments) && grievance.attachments.length > 0 && (
            <div>
              <SectionLabel color="#7c3aed">Attachments ({grievance.attachments.length})</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {grievance.attachments.map((att, i) => {
                  const isImage = att.mimetype?.startsWith('image/');
                  const isPdf   = att.mimetype?.includes('pdf');
                  const isXls   = att.mimetype?.includes('sheet') || att.mimetype?.includes('excel');
                  const emoji   = isImage ? null : isPdf ? '📄' : isXls ? '📊' : 'ðŸ“';
                  const fileUrl = api.grievances.attachmentUrl(att.url);
                  return (
                    <a key={i} href={fileUrl} target="_blank" rel="noopener noreferrer" download={!isImage ? att.originalname : undefined}
                      style={{ display: 'flex', flexDirection: 'column', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--gray-200)', textDecoration: 'none', color: 'inherit', transition: 'box-shadow 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      {/* Thumbnail or icon */}
                      <div style={{ height: 100, backgroundColor: 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {isImage
                          ? <img src={fileUrl} alt={att.originalname} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ fontSize: '2.5rem' }}>{emoji}</span>
                        }
                      </div>
                      {/* File info */}
                      <div style={{ padding: '8px 10px', backgroundColor: 'var(--white)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-800)' }}>
                          {att.originalname}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: 2 }}>
                          {((att.size||0)/1024).toFixed(0)} KB Â· {isImage ? 'ðŸ” Click to view' : 'â¬‡ï¸ Download'}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Escalation Trail */}
          {Array.isArray(grievance.escalation_history) && grievance.escalation_history.length > 0 && (
            <div>
              <SectionLabel color="#d97706">Escalation Trail</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {grievance.escalation_history.map((h, i) => (
                  <div key={i} style={{ padding: '12px 14px', borderRadius: 8, backgroundColor: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.83rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <span>
                        <strong style={{ color: 'var(--gray-700)' }}>{ROLE_LABEL[h.forwarded_by_role] || h.forwarded_by_role}</strong>
                        <span style={{ color: 'var(--gray-400)', margin: '0 6px' }}>→</span>
                        <strong style={{ color: '#92400e' }}>{ROLE_LABEL[h.forwarded_to_role] || h.forwarded_to_role}</strong>
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>
                        {new Date(h.forwarded_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                      </span>
                    </div>
                    {h.notes && <div style={{ marginTop: 6, color: 'var(--gray-600)', fontStyle: 'italic', borderTop: '1px solid #fde68a', paddingTop: 6 }}>"{h.notes}"</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Forward Notes Input */}
          {showForwardBox && (
            <div style={{ padding: '16px', borderRadius: 10, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10, color: '#1e40af' }}>
                ⬆️ Forward to {ROLE_LABEL[nextRole]} — Add Notes (Optional)
              </div>
              <textarea className="form-input" rows={3} placeholder="Reason for forwarding this grievance..." value={forwardNotes} onChange={e => setForwardNotes(e.target.value)} style={{ marginBottom: 10, fontSize: '0.85rem' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowForwardBox(false)}>Cancel</button>
                <button className="btn btn-warning btn-sm" disabled={forwarding} onClick={handleForward}>
                  {forwarding ? 'Forwarding...' : `Confirm Forward`}
                </button>
              </div>
            </div>
          )}

          {/* Resolution */}
          {grievance.resolution_text && (
            <div>
              <SectionLabel color="#059669">Resolution</SectionLabel>
              <div style={{ padding: '14px 16px', backgroundColor: '#f0fdf4', borderRadius: 10, fontSize: '0.9rem', color: '#065f46', lineHeight: 1.7, border: '1px solid #a7f3d0' }}>
                ✅ {grievance.resolution_text}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {userRole !== 'staff' && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50)', flexWrap: 'wrap', gap: 8 }}>
            <div>
              {canForward && !showForwardBox && (
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #fde68a', backgroundColor: '#fffbeb', color: '#92400e', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 600 }}
                  onClick={() => setShowForwardBox(true)}>
                  ⬆️ Forward to {ROLE_LABEL[nextRole]}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
              {grievance.status === 'Pending' && (
                <button className="btn btn-warning btn-sm" disabled={updating} onClick={() => handleStatusChange('In Progress')}>
                  {updating ? '...' : '🔄 Mark In Progress'}
                </button>
              )}
              {['In Progress', 'Escalated'].includes(grievance.status) && (
                <button className="btn btn-success btn-sm" disabled={updating} onClick={() => handleStatusChange('Resolved')}>
                  {updating ? '...' : '✅ Mark Resolved'}
                </button>
              )}
              {grievance.status === 'Resolved' && (
                <button className="btn btn-neutral btn-sm" disabled={updating} onClick={() => handleStatusChange('Closed')}>
                  {updating ? '...' : 'Close Grievance'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main List Component ───────────────────────────────────────
export default function GrievanceList() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [grievances, setGrievances]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [searchTerm, setSearchTerm]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [selectedGrievance, setSelected]  = useState(null);  // â† detail modal

  useEffect(() => { fetchGrievances(); }, [user]);

  async function fetchGrievances() {
    try {
      setLoading(true);
      const data = await api.grievances.list();
      setGrievances((data||[]).map(g => ({
        id: g.id,
        personnelName: g.applicant_name,
        subject: g.grievance_type,
        description: g.description,
        status: g.status,
        beltNumber: g.belt_number,
        createdAt: g.created_at,
        ...g
      })));
    } catch (err) {
      toast.error('Failed to load grievances.');
    } finally { setLoading(false); }
  }

  const filteredItems = useMemo(() => {
    return grievances.filter(g => {
      if (statusFilter && g.status !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          (g.subject || '').toLowerCase().includes(term) ||
          (g.personnelName || '').toLowerCase().includes(term) ||
          (g.beltNumber || '').toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [grievances, searchTerm, statusFilter]);

  async function updateStatus(id, newStatus) {
    try {
      await api.grievances.update(id, { status: newStatus });
      const upd = g => g.id === id ? { ...g, status: newStatus } : g;
      setGrievances(prev => prev.map(upd));
      setSelected(prev => prev && prev.id === id ? { ...prev, status: newStatus } : prev);
      toast.success(`Grievance marked as ${newStatus}.`);
    } catch (err) { toast.error('Failed to update status.'); }
  }

  async function forwardGrievance(id, notes) {
    try {
      const updated = await api.grievances.forward(id, notes);
      const upd = g => g.id === id ? { ...g, ...updated } : g;
      setGrievances(prev => prev.map(upd));
      setSelected(prev => prev && prev.id === id ? { ...prev, ...updated } : prev);
      toast.success('Grievance forwarded to higher authority.');
    } catch (err) { toast.error('Failed to forward grievance.'); }
  }

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      {/* Detail Modal */}
      {selectedGrievance && (
        <GrievanceDetailModal
          grievance={selectedGrievance}
          userRole={user.role}
          onClose={() => setSelected(null)}
          onStatusChange={updateStatus}
          onForward={forwardGrievance}
        />
      )}

      <div className="page-header">
        <h2>Grievance Redressal</h2>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => navigate('/grievances/new')}>
            <Plus size={18} /> File Grievance
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="search-filter-bar">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Search subject, name, belt no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {GRIEVANCE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="empty-state">
              <div className="spinner spinner-lg"></div>
              <p>Loading grievances...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <MessageSquare className="icon" />
              <h4>No grievances found</h4>
              <p>No complaints match your current filters.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Complainant</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(g => (
                  <tr key={g.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(g)}>
                    <td onClick={e => e.stopPropagation()}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                        {formatDate(g.createdAt)}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{g.personnelName}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                          {g.node_name || g.beltNumber}
                        </span>
                      </div>
                    </td>
                    <td style={{ maxWidth: 300 }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{g.subject}</span>
                        <span style={{
                          fontSize: '0.8rem', color: 'var(--gray-500)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          maxWidth: 280,
                        }}>
                          {g.description}
                        </span>
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <span className={`badge ${GRIEVANCE_STATUSES.find(s => s.value === g.status)?.color}`}>
                        {g.status}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {user.role !== 'staff' && g.status === 'Pending' && (
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => updateStatus(g.id, 'In Progress')}
                            title="Mark In Progress"
                          >
                            Investigate
                          </button>
                        )}
                        {user.role !== 'staff' && g.status === 'In Progress' && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => updateStatus(g.id, 'Resolved')}
                          >
                            Resolve
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelected(g)}
                          title="View Details"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

