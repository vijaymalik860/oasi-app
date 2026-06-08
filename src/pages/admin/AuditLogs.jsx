import React, { useState, useEffect } from 'react';
import { History, Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function AuditLogs() {
  const { isStateAdmin, isSuperAdmin } = useAuth();
  const toast = useToast();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    try {
      setLoading(true);
      const token = localStorage.getItem('oasi_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load audit logs');
      const data = await res.json();
      setLogs(data || []);
    } catch (err) {
      toast.error('Audit logs load karne mein error');
    } finally {
      setLoading(false);
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

  const filteredLogs = logs.filter(l => 
    (l.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.belt_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <History size={28} className="text-primary" />
          <div>
            <h2>System Audit Logs</h2>
            <p className="text-sm text-gray-500">
              User actions aur system modifications ka history track
            </p>
          </div>
        </div>
      </div>

      <div className="panel mb-6">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--gray-200)' }}>
          <div className="form-group mb-0" style={{ position: 'relative', maxWidth: 400 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--gray-400)' }} />
            <input
              type="text" className="form-input"
              placeholder="Action, User, ya Entity search karo..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details / New Data</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">Koi log nahi mila.</td></tr>
              ) : (
                filteredLogs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: '0.82rem', color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>
                      {new Date(l.created_at).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <div className="font-semibold">{l.user_name || 'System'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', fontFamily: 'monospace' }}>
                        {l.belt_number || 'SYSTEM'}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                        {l.action}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>{l.entity_type}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontFamily: 'monospace' }}>
                        {l.entity_id ? l.entity_id.split('-')[0] + '...' : ''}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--gray-600)', maxWidth: 300, wordBreak: 'break-all' }}>
                      {l.new_data ? JSON.stringify(l.new_data) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
