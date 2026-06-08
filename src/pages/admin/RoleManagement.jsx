import React, { useState, useEffect } from 'react';
import { Shield, Edit2, X, ShieldAlert } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function RoleManagement() {
  const { isStateAdmin, isSuperAdmin } = useAuth();
  const toast = useToast();
  
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    try {
      setLoading(true);
      const token = localStorage.getItem('oasi_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/admin/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load roles');
      const data = await res.json();
      setRoles(data || []);
    } catch (err) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      const token = localStorage.getItem('oasi_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/admin/roles/${editModal.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ description: editModal.description })
      });
      
      if (!res.ok) throw new Error('Failed to update role');
      toast.success('Role updated successfully');
      setEditModal(null);
      loadRoles();
    } catch (err) {
      toast.error(err.message || 'Error updating role');
    } finally {
      setSaving(false);
    }
  }

  if (!isStateAdmin && !isSuperAdmin) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <ShieldAlert size={48} style={{ color: 'var(--gray-300)', marginBottom: 16 }} />
        <h3 style={{ color: 'var(--gray-500)' }}>Access Denied</h3>
      </div>
    );
  }

  const ROLE_BADGE_COLOR = {
    super_admin:    'badge-danger',
    state_admin:    'badge-primary',
    range_admin:    'badge-info',
    district_admin: 'badge-warning',
    unit_admin:     'badge-success',
    staff:          'badge-neutral',
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Shield size={28} className="text-primary" />
          <div>
            <h2>Role Management</h2>
            <p className="text-sm text-gray-500">
              System predefined roles aur unke access levels
            </p>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 24 }}>
        <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)', marginBottom: 20 }}>
          <strong>Note:</strong> Yeh OASI ke core roles hain jo system access define karte hain. 
          Naye roles create karna ya inka naam badalna allowed nahi hai kyunki application logic in par nirbhar hai.
        </p>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Role Name</th>
                <th>Description</th>
                <th style={{ textAlign: 'center' }}>Active Users</th>
                {isSuperAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
              ) : roles.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">Koi role nahi mila.</td></tr>
              ) : (
                roles.map(r => (
                  <tr key={r.id}>
                    <td className="font-semibold text-gray-500">#{r.rank_level}</td>
                    <td>
                      <span className={`badge ${ROLE_BADGE_COLOR[r.name] || 'badge-neutral'}`}>
                        {r.name.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.88rem', color: 'var(--gray-700)' }}>
                      {r.description || '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      {r.user_count || 0}
                    </td>
                    {isSuperAdmin && (
                      <td>
                        <div className="actions justify-end">
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Edit Role Description"
                            onClick={() => setEditModal(r)}
                          >
                            <Edit2 size={15} style={{ color: 'var(--primary-500)' }} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>Edit Role</h3>
              <button className="btn-close" onClick={() => setEditModal(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--gray-50)', padding: 10, borderRadius: 6 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>Role: </span>
                  <strong>{editModal.name}</strong>
                </div>
                <div className="form-group mb-0">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={editModal.description || ''}
                    onChange={e => setEditModal({ ...editModal, description: e.target.value })}
                    placeholder="Role ke baare mein likhein..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
