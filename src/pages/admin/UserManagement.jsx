import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  UserCog, Plus, Key, ToggleLeft, ToggleRight, X,
  Search, ShieldAlert, Edit2, MapPin, Eye, EyeOff, Save
} from 'lucide-react';

// Issue #5 Fix: password field type="password" (not text)
// Issue #2 Fix: range_admin option added
// Issue #3 Fix: staff option added
// Issue #7 Fix: location shown in user list
// Issue #8 Fix: user edit modal added
// Issue #9 Fix: state admin sees only own-node users (backend handles, frontend shows node)

const ROLE_OPTIONS = [
  { value: 'state_admin',    label: 'State Admin (PHQ)',           needsDistrict: false, needsUnit: false, needsRange: false },
  { value: 'range_admin',    label: 'Range Admin (OASI)',          needsDistrict: false, needsUnit: false, needsRange: true  },
  { value: 'district_admin', label: 'District Admin (OASI)',       needsDistrict: true,  needsUnit: false, needsRange: false },
  { value: 'unit_admin',     label: 'Unit Admin (MHC)',            needsDistrict: true,  needsUnit: true,  needsRange: false },
  { value: 'staff',          label: 'Staff (View Only)',           needsDistrict: false, needsUnit: false, needsRange: false },
];

const ROLE_BADGE_COLOR = {
  super_admin:    'badge-danger',
  state_admin:    'badge-primary',
  range_admin:    'badge-info',
  district_admin: 'badge-warning',
  unit_admin:     'badge-success',
  staff:          'badge-neutral',
};

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function UserManagement() {
  const { isStateAdmin, isSuperAdmin, user } = useAuth();
  const toast = useToast();

  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const [showModal, setShowModal]   = useState(false);
  const [editModal, setEditModal]   = useState(null); // Issue #8: edit user
  const [saving, setSaving]         = useState(false);
  const [showPwd, setShowPwd]       = useState(false); // Issue #5: toggle visibility
  const [showResetPwd, setShowResetPwd] = useState(false);

  // Form State
  const emptyForm = {
    name: '', belt_number: '', password: '',
    role_name: 'district_admin',
    node_id: '', range_id: '', district_id: '', unit_id: ''
  };
  const [formData, setFormData] = useState(emptyForm);

  // Hierarchy
  const [ranges, setRanges]       = useState([]);
  const [districts, setDistricts] = useState([]);
  const [units, setUnits]         = useState([]);

  // Reset Password
  const [resetModal, setResetModal]   = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadUsers();
    loadHierarchyNodes();
  }, []);

  // Reload districts when district_id changes (for unit dropdown)
  useEffect(() => {
    const id = formData.district_id || editModal?.district_id;
    if (id) fetchUnits(id);
    else setUnits([]);
  }, [formData.district_id, editModal?.district_id]);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await api.admin.users();
      setUsers(data || []);
    } catch {
      toast.error('Users load karne mein error');
    } finally {
      setLoading(false);
    }
  }

  async function loadHierarchyNodes() {
    try {
      // Use hierarchy_nodes API — level 2=Range, 3=District, 4=Unit
      const token = localStorage.getItem('oasi_token');

      // Fetch ranges (level 2)
      const rRes = await fetch(`${API_BASE}/api/hierarchy/nodes-by-level?level=2`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (rRes.ok) setRanges(await rRes.json());

      // Fetch all districts (level 3)
      const dRes = await fetch(`${API_BASE}/api/hierarchy/nodes-by-level?level=3`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (dRes.ok) setDistricts(await dRes.json());

    } catch (err) {
      console.error('Hierarchy load error:', err);
    }
  }

  async function fetchUnits(districtId) {
    if (!districtId) return;
    try {
      const token = localStorage.getItem('oasi_token');
      const res = await fetch(`${API_BASE}/api/hierarchy/nodes?parentId=${districtId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUnits(await res.json());
    } catch {}
  }

  // ── Handlers ──

  async function handleToggle(id) {
    try {
      await api.admin.toggleUser(id);
      toast.success('User status update ho gaya');
      loadUsers();
    } catch {
      toast.error('Status update karne mein error');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const roleInfo = ROLE_OPTIONS.find(r => r.value === formData.role_name);

    if (!formData.name || !formData.belt_number || !formData.password) {
      toast.warning('Naam, Belt Number aur Password zaroori hain');
      return;
    }
    if (roleInfo?.needsRange && !formData.range_id) {
      toast.warning('Range select karo'); return;
    }
    if (roleInfo?.needsDistrict && !formData.district_id) {
      toast.warning('District select karo'); return;
    }
    if (roleInfo?.needsUnit && !formData.unit_id) {
      toast.warning('Unit/Police Station select karo'); return;
    }

    // node_id = most specific location
    const node_id = formData.unit_id || formData.district_id || formData.range_id || '';

    try {
      setSaving(true);
      await api.admin.createUser({ ...formData, node_id });
      toast.success('User successfully ban gaya!');
      setShowModal(false);
      setFormData(emptyForm);
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'User create karne mein error');
    } finally {
      setSaving(false);
    }
  }

  // Issue #8: Edit user — role + node update
  async function handleEditSave(e) {
    e.preventDefault();
    const node_id = editModal.unit_id || editModal.district_id || editModal.range_id || editModal.node_id || '';
    try {
      setSaving(true);
      const token = localStorage.getItem('oasi_token');
      const res = await fetch(`${API_BASE}/api/admin/users/${editModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role_name: editModal.role_name, node_id, name: editModal.name }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast.success('User update ho gaya!');
      setEditModal(null);
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Update karne mein error');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.warning('Password kam se kam 6 characters ka hona chahiye');
      return;
    }
    try {
      setSaving(true);
      await api.admin.resetPassword(resetModal.id, newPassword);
      toast.success('Password reset ho gaya!');
      setResetModal(null);
      setNewPassword('');
    } catch {
      toast.error('Password reset karne mein error');
    } finally {
      setSaving(false);
    }
  }

  function openCreateModal() {
    setFormData(emptyForm);
    setShowPwd(false);
    setShowModal(true);
  }

  // Filters
  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.belt_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = !filterRole || u.role_name === filterRole;
    return matchSearch && matchRole;
  });

  const selectedRoleInfo = ROLE_OPTIONS.find(r => r.value === formData.role_name);

  if (!isStateAdmin && !isSuperAdmin) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <ShieldAlert size={48} style={{ color: 'var(--gray-300)', marginBottom: 16 }} />
        <h3 style={{ color: 'var(--gray-500)' }}>Access Denied</h3>
      </div>
    );
  }

  return (
    <div className="user-management">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <UserCog size={28} className="text-primary" />
          <div>
            <h2>User Management</h2>
            <p className="text-sm text-gray-500">
              Admin aur Staff accounts manage karo
              {isSuperAdmin && <span style={{ marginLeft: 8, color: 'var(--primary-500)', fontSize: '0.78rem' }}>(Super Admin — sab users dikh rahe hain)</span>}
              {isStateAdmin && !isSuperAdmin && <span style={{ marginLeft: 8, color: 'var(--primary-500)', fontSize: '0.78rem' }}>(State Admin — apne state ke users)</span>}
            </p>
          </div>
        </div>
        <button className="btn btn-primary desktop-only" onClick={openCreateModal}>
          <Plus size={18} className="mr-2" /> Naya User Banao
        </button>
      </div>

      {/* Search + Filter */}
      <div className="panel mb-6">
        <div className="search-filter-bar" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <div className="form-group flex-1 search-input-wrapper" style={{ marginBottom: 0, position: 'relative', minWidth: 220 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--gray-400)' }} />
            <input
              type="text" className="form-input"
              placeholder="Naam ya Belt Number dhundho..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <select
            className="form-select" style={{ maxWidth: 200 }}
            value={filterRole} onChange={e => setFilterRole(e.target.value)}
          >
            <option value="">Sab Roles</option>
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            <option value="super_admin">Super Admin</option>
          </select>
          <span style={{ color: 'var(--gray-400)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            {filteredUsers.length} / {users.length} users
          </span>
        </div>

        {/* User Table — Issue #7 Fix: location column added */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Naam</th>
                <th>Belt Number</th>
                <th>Role</th>
                <th>
                  <MapPin size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Location (Node)
                </th>
                <th>Status</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8">Loading...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">Koi user nahi mila.</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.88rem' }}>{u.belt_number}</td>
                    <td>
                      <span className={`badge ${ROLE_BADGE_COLOR[u.role_name] || 'badge-neutral'}`}>
                        {u.role_name.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    {/* Issue #7: node_name column */}
                    <td style={{ fontSize: '0.82rem', color: 'var(--gray-600)' }}>
                      {u.node_name ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{
                            background: 'var(--primary-50)', color: 'var(--primary-600)',
                            padding: '1px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 500
                          }}>
                            L{u.node_level}
                          </span>
                          {u.node_name}
                        </span>
                      ) : <span style={{ color: 'var(--gray-300)' }}>—</span>}
                    </td>
                    <td>
                      {u.is_active
                        ? <span className="badge badge-success">Active</span>
                        : <span className="badge badge-danger">Disabled</span>
                      }
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                      {u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Kabhi nahi'}
                    </td>
                    <td>
                      <div className="actions justify-end">
                        {/* Issue #8: Edit button */}
                        {u.role_name !== 'super_admin' && (
                          <button
                            className="btn btn-ghost btn-sm" title="Edit User"
                            onClick={() => setEditModal({
                              ...u,
                              range_id: '', district_id: '', unit_id: ''
                            })}
                          >
                            <Edit2 size={15} style={{ color: 'var(--primary-500)' }} />
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm" title="Password Reset"
                          onClick={() => { setResetModal(u); setShowResetPwd(false); }}
                        >
                          <Key size={16} style={{ color: 'var(--gray-500)' }} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          title={u.is_active ? 'Disable Account' : 'Enable Account'}
                          onClick={() => handleToggle(u.id)}
                          disabled={u.role_name === 'super_admin'}
                        >
                          {u.is_active
                            ? <ToggleRight size={20} style={{ color: 'var(--success-500)' }} />
                            : <ToggleLeft size={20} style={{ color: 'var(--gray-400)' }} />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CREATE MODAL ── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520, margin: 'auto' }}>
            <div className="modal-header">
              <h3>Naya Admin Account Banao</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                <div style={{ display: 'flex', gap: 14 }}>
                  <div className="form-group flex-1 mb-0">
                    <label className="form-label">Full Name *</label>
                    <input required type="text" className="form-input"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Ramesh Kumar" />
                  </div>
                  <div className="form-group flex-1 mb-0">
                    <label className="form-label">Belt Number (Login ID) *</label>
                    <input required type="text" className="form-input"
                      value={formData.belt_number}
                      onChange={e => setFormData({ ...formData, belt_number: e.target.value.toUpperCase() })}
                      placeholder="e.g. AMB-1234" />
                  </div>
                </div>

                {/* Issue #5 Fix: password field with show/hide toggle */}
                <div className="form-group mb-0">
                  <label className="form-label">Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input required
                      type={showPwd ? 'text' : 'password'}
                      className="form-input"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Initial password set karo"
                      minLength={6}
                      style={{ paddingRight: 40 }}
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Role selector — Issue #2 + #3 Fix */}
                <div className="form-group mb-0">
                  <label className="form-label">Admin Role *</label>
                  <select className="form-select"
                    value={formData.role_name}
                    onChange={e => setFormData({ ...formData, role_name: e.target.value, range_id: '', district_id: '', unit_id: '' })}>
                    {ROLE_OPTIONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                {/* Jurisdiction scope */}
                {(selectedRoleInfo?.needsRange || selectedRoleInfo?.needsDistrict || selectedRoleInfo?.needsUnit) && (
                  <div style={{ background: 'var(--gray-50)', padding: 14, borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                    <label className="form-label mb-2" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ShieldAlert size={15} /> Jurisdiction Scope
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Range — Issue #2 Fix */}
                      {selectedRoleInfo?.needsRange && (
                        <div>
                          <label className="text-xs text-gray-500 font-semibold uppercase mb-1 block">Range</label>
                          <select required className="form-select"
                            value={formData.range_id}
                            onChange={e => setFormData({ ...formData, range_id: e.target.value })}>
                            <option value="">-- Range Select Karo --</option>
                            {ranges.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </div>
                      )}
                      {selectedRoleInfo?.needsDistrict && (
                        <div>
                          <label className="text-xs text-gray-500 font-semibold uppercase mb-1 block">District</label>
                          <select required className="form-select"
                            value={formData.district_id}
                            onChange={e => setFormData({ ...formData, district_id: e.target.value, unit_id: '' })}>
                            <option value="">-- District Select Karo --</option>
                            {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                      )}
                      {selectedRoleInfo?.needsUnit && (
                        <div>
                          <label className="text-xs text-gray-500 font-semibold uppercase mb-1 block">Police Station / Unit</label>
                          <select required className="form-select"
                            value={formData.unit_id}
                            onChange={e => setFormData({ ...formData, unit_id: e.target.value })}>
                            <option value="">-- Unit Select Karo --</option>
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Ban raha hai...' : 'Account Banao'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL — Issue #8 Fix ── */}
      {editModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460, margin: 'auto' }}>
            <div className="modal-header">
              <h3>User Edit Karo</h3>
              <button className="btn-close" onClick={() => setEditModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group mb-0">
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" value={editModal.name}
                    onChange={e => setEditModal({ ...editModal, name: e.target.value })} />
                </div>
                <div style={{ background: 'var(--gray-50)', padding: 10, borderRadius: 6 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Belt Number (change nahi hota): </span>
                  <strong>{editModal.belt_number}</strong>
                </div>
                <div className="form-group mb-0">
                  <label className="form-label">Role Change Karo</label>
                  <select className="form-select" value={editModal.role_name}
                    onChange={e => setEditModal({ ...editModal, role_name: e.target.value })}>
                    {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="form-group mb-0">
                  <label className="form-label">Node/Location (optional)</label>
                  <select className="form-select"
                    value={editModal.district_id || ''}
                    onChange={e => setEditModal({ ...editModal, district_id: e.target.value })}>
                    <option value="">-- Purana rakhna hai to change mat karo --</option>
                    {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={16} className="mr-2" />
                  {saving ? 'Save ho raha hai...' : 'Changes Save Karo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RESET PASSWORD MODAL — Issue #5 Fix ── */}
      {resetModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 400, margin: 'auto' }}>
            <div className="modal-header">
              <h3>Password Reset Karo</h3>
              <button className="btn-close" onClick={() => { setResetModal(null); setNewPassword(''); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)', marginBottom: 14 }}>
                  <strong>{resetModal.name} ({resetModal.belt_number})</strong> ka naya password set karo.
                </p>
                <div className="form-group mb-0">
                  <label className="form-label">Naya Password</label>
                  {/* Issue #5 Fix: type="password" with toggle */}
                  <div style={{ position: 'relative' }}>
                    <input required autoFocus
                      type={showResetPwd ? 'text' : 'password'}
                      className="form-input"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Naya password dalو"
                      minLength={6}
                      style={{ paddingRight: 40 }}
                    />
                    <button type="button" onClick={() => setShowResetPwd(!showResetPwd)}
                      style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)' }}>
                      {showResetPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                  onClick={() => { setResetModal(null); setNewPassword(''); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Reset ho raha hai...' : 'Password Reset Karo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Button (Mobile) */}
      <button className="btn-primary fab-btn mobile-only" onClick={openCreateModal} title="Naya User Banao">
        <Plus size={24} />
      </button>
    </div>
  );
}
