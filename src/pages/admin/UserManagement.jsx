import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { UserCog, Plus, Key, ToggleLeft, ToggleRight, X, Search, ShieldAlert } from 'lucide-react';

export default function UserManagement() {
  const { isStateAdmin, isSuperAdmin } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    belt_number: '',
    password: '',
    role_name: 'district_admin',
    state_id: '',
    district_id: '',
    unit_id: ''
  });

  // Hierarchy Data for Form
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [units, setUnits] = useState([]);

  // Reset Password State
  const [resetModal, setResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    loadUsers();
    loadHierarchy();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await api.admin.users();
      setUsers(data || []);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function loadHierarchy() {
    try {
      // First get states
      const s = await api.hierarchy.states();
      setStates(s || []);
      if (s && s.length > 0) {
        setFormData(prev => ({ ...prev, state_id: s[0].id }));
        fetchDistricts(s[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchDistricts(stateId) {
    if (!stateId) return;
    try {
      // Pass no params to get all districts, or pass stateId if API requires
      const res = await api.hierarchy.districts({ stateId });
      setDistricts(res || []);
    } catch (err) { }
  }

  async function fetchUnits(districtId) {
    if (!districtId) return;
    try {
      const res = await api.hierarchy.units({ districtId });
      setUnits(res || []);
    } catch (err) { }
  }

  // Effect to load units when district changes
  useEffect(() => {
    if (formData.district_id) fetchUnits(formData.district_id);
    else setUnits([]);
  }, [formData.district_id]);


  async function handleToggle(id) {
    try {
      await api.admin.toggleUser(id);
      toast.success('User status updated');
      loadUsers();
    } catch (err) {
      toast.error('Failed to update status');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name || !formData.belt_number || !formData.password || !formData.role_name) {
      toast.warning('Please fill all required fields');
      return;
    }
    if (formData.role_name === 'district_admin' && !formData.district_id) {
      toast.warning('Please select a District');
      return;
    }
    if (formData.role_name === 'unit_admin' && !formData.unit_id) {
      toast.warning('Please select a Police Station / Unit');
      return;
    }

    try {
      setSaving(true);
      await api.admin.createUser(formData);
      toast.success('User created successfully!');
      setShowModal(false);
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.warning('Password must be at least 6 characters');
      return;
    }
    try {
      setSaving(true);
      await api.admin.resetPassword(resetModal.id, newPassword);
      toast.success('Password reset successfully!');
      setResetModal(null);
      setNewPassword('');
    } catch (err) {
      toast.error('Failed to reset password');
    } finally {
      setSaving(false);
    }
  }

  function openCreateModal() {
    setFormData({
      name: '',
      belt_number: '',
      password: '',
      role_name: 'district_admin',
      state_id: states[0]?.id || '',
      district_id: '',
      unit_id: ''
    });
    setShowModal(true);
  }

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.belt_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isStateAdmin && !isSuperAdmin) {
    return <div className="p-8 text-center text-red-500">Access Denied</div>;
  }

  return (
    <div className="user-management">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <UserCog size={28} className="text-primary" />
          <div>
            <h2>User Management</h2>
            <p className="text-sm text-gray-500">Manage admin and staff accounts</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} className="mr-2" /> Add New User
        </button>
      </div>

      <div className="panel mb-6">
        <div className="flex items-center gap-2 mb-4" style={{ maxWidth: 400 }}>
          <div className="form-group flex-1" style={{ marginBottom: 0, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--gray-400)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search by name or belt number..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Belt Number</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8">Loading users...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-500">No users found.</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td className="font-semibold text-gray-900">{u.name}</td>
                    <td className="text-mono text-gray-600">{u.belt_number}</td>
                    <td><span className="badge badge-neutral">{u.role_name.replace('_', ' ').toUpperCase()}</span></td>
                    <td>
                      {u.is_active 
                        ? <span className="badge badge-success">Active</span>
                        : <span className="badge badge-danger">Disabled</span>
                      }
                    </td>
                    <td className="text-sm text-gray-500">
                      {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                    </td>
                    <td>
                      <div className="actions justify-end">
                        <button 
                          className="btn btn-ghost btn-sm" 
                          title="Reset Password"
                          onClick={() => setResetModal(u)}
                        >
                          <Key size={16} className="text-gray-500" />
                        </button>
                        <button 
                          className="btn btn-ghost btn-sm"
                          title={u.is_active ? 'Disable Account' : 'Enable Account'}
                          onClick={() => handleToggle(u.id)}
                        >
                          {u.is_active 
                            ? <ToggleRight size={20} className="text-success" />
                            : <ToggleLeft size={20} className="text-gray-400" />
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

      {/* CREATE MODAL */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Create Admin Account</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                <div style={{ display: 'flex', gap: 16 }}>
                  <div className="form-group flex-1 mb-0">
                    <label className="form-label">Full Name</label>
                    <input required type="text" className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Ramesh Kumar" />
                  </div>
                  <div className="form-group flex-1 mb-0">
                    <label className="form-label">Belt Number (Login ID)</label>
                    <input required type="text" className="form-input" value={formData.belt_number} onChange={e => setFormData({...formData, belt_number: e.target.value.toUpperCase()})} placeholder="e.g. AMB-1234" />
                  </div>
                </div>

                <div className="form-group mb-0">
                  <label className="form-label">Temporary Password</label>
                  <input required type="text" className="form-input" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Set an initial password" minLength={6} />
                </div>

                <div className="form-group mb-0">
                  <label className="form-label">Admin Role</label>
                  <select className="form-select" value={formData.role_name} onChange={e => setFormData({...formData, role_name: e.target.value})}>
                    <option value="state_admin">State Admin (PHQ)</option>
                    <option value="district_admin">District Admin</option>
                    <option value="unit_admin">Unit Admin (SHO/Incharge)</option>
                  </select>
                </div>

                {/* Scope selection based on role */}
                {(formData.role_name === 'district_admin' || formData.role_name === 'unit_admin') && (
                  <div className="form-group mb-0" style={{ background: 'var(--gray-50)', padding: 16, borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                    <label className="form-label mb-3 flex items-center gap-2"><ShieldAlert size={16} /> Jurisdiction Scope</label>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label className="text-xs text-gray-500 font-semibold uppercase mb-1 block">District</label>
                        <select 
                          required 
                          className="form-select"
                          value={formData.district_id}
                          onChange={e => setFormData({...formData, district_id: e.target.value, unit_id: ''})}
                        >
                          <option value="">-- Select District --</option>
                          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </div>

                      {formData.role_name === 'unit_admin' && (
                        <div>
                          <label className="text-xs text-gray-500 font-semibold uppercase mb-1 block">Police Station / Unit</label>
                          <select 
                            required 
                            className="form-select"
                            value={formData.unit_id}
                            onChange={e => setFormData({...formData, unit_id: e.target.value})}
                          >
                            <option value="">-- Select Unit --</option>
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
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button className="btn-close" onClick={() => {setResetModal(null); setNewPassword('');}}><X size={20} /></button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                <p className="text-sm text-gray-600 mb-4">Set a new password for <strong>{resetModal.name} ({resetModal.belt_number})</strong>.</p>
                <div className="form-group mb-0">
                  <label className="form-label">New Password</label>
                  <input 
                    required 
                    autoFocus
                    type="text" 
                    className="form-input" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    placeholder="Enter new password" 
                    minLength={6} 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => {setResetModal(null); setNewPassword('');}}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
