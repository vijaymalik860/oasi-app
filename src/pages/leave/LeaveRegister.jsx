import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import {
  FileText, Plus, Search, Filter, CheckCircle, XCircle,
  Clock, Calendar, User, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LEAVE_STATUSES = [
  { value: 'Pending', label: 'Pending', color: 'badge-warning' },
  { value: 'Approved', label: 'Approved', color: 'badge-success' },
  { value: 'Rejected', label: 'Rejected', color: 'badge-danger' },
  { value: 'Cancelled', label: 'Cancelled', color: 'badge-neutral' },
];

export default function LeaveRegister() {
  const { user, isSuperAdmin, isStateAdmin, isRangeAdmin, isDistrictAdmin, isUnitAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadLeaves();
  }, [user]);

  async function loadLeaves() {
    try {
      setLoading(true);
      const data = await api.leaves.list();
      setLeaves((data||[]).map(l => ({
        id: l.id,
        personnelName: l.full_name || 'Unknown',
        beltNumber: l.belt_number || '—',
        rank: l.rank || '—',
        leaveType: l.leave_type,
        startDate: l.start_date,
        endDate: l.end_date,
        totalDays: l.total_days,
        status: l.status,
        unitId: l.unit_id,
        districtId: l.district_id,
        rangeId: l.range_id,
        ...l
      })));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Load leaves error:', err);
      toast.error('Failed to load leave records.');
    } finally {
      setLoading(false);
    }
  }

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          (l.personnelName || '').toLowerCase().includes(term) ||
          (l.beltNumber || '').toLowerCase().includes(term) ||
          (l.reason || '').toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [leaves, searchTerm, statusFilter]);

  async function updateLeaveStatus(leave, newStatus) {
    const canApprove =
      (isUnitAdmin && user.unitId && leave.unitId === user.unitId) ||
      (isDistrictAdmin && user.districtId && leave.districtId === user.districtId) ||
      (isRangeAdmin && user.rangeId && leave.rangeId === user.rangeId) ||
      isSuperAdmin || isStateAdmin;
    if (!canApprove) { toast.error('Permission denied.'); return; }
    try {
      if (newStatus === 'Approved') await api.leaves.approve(leave.id);
      else await api.leaves.reject(leave.id);
      setLeaves(prev => prev.map(l => l.id === leave.id ? { ...l, status: newStatus } : l));
      toast.success(`Leave ${newStatus.toLowerCase()} successfully.`);
    } catch (err) {
      toast.error('Failed to update leave status.');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Leave Register</h2>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => navigate('/leave/apply')}>
            <Plus size={18} /> Apply for Leave
          </button>
        </div>
      </div>

      <div className="stats-bar" style={{ marginBottom: 16 }}>
        <div className="stat-widget">
          <div className="stat-widget-icon amber"><Clock size={18} /></div>
          <div className="stat-widget-data">
            <h3>{leaves.filter(l => l.status === 'Pending').length}</h3>
            <p>Pending</p>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon green"><CheckCircle size={18} /></div>
          <div className="stat-widget-data">
            <h3>{leaves.filter(l => l.status === 'Approved').length}</h3>
            <p>Approved</p>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon red"><XCircle size={18} /></div>
          <div className="stat-widget-data">
            <h3>{leaves.filter(l => l.status === 'Rejected').length}</h3>
            <p>Rejected</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="search-filter-bar">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Search by name, belt no..."
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
              {LEAVE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="empty-state">
              <div className="spinner spinner-lg"></div>
              <p>Loading leave records...</p>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="empty-state">
              <FileText className="icon" />
              <h4>No leave records found</h4>
              <p>Apply for a new leave or adjust filters.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Personnel</th>
                  <th>Leave Type</th>
                  <th>Duration</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map(l => (
                  <tr key={l.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{l.personnelName}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                          {l.beltNumber} • {l.rank}
                        </span>
                      </div>
                    </td>
                    <td>{l.leaveType}</td>
                    <td>
                      <div style={{ fontSize: '0.85rem' }}>
                        <span>{l.startDate}</span>
                        <ArrowRight size={12} style={{ margin: '0 4px' }} />
                        <span>{l.endDate}</span>
                      </div>
                    </td>
                    <td>{l.totalDays}</td>
                    <td>
                      <span className={`badge ${LEAVE_STATUSES.find(s => s.value === l.status)?.color}`}>
                        {l.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {l.status === 'Pending' && (
                          <>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: 'var(--success-500)' }}
                              onClick={() => updateLeaveStatus(l, 'Approved')}
                              title="Approve"
                            >
                              <CheckCircle size={16} />
                            </button>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              style={{ color: 'var(--danger-500)' }}
                              onClick={() => updateLeaveStatus(l, 'Rejected')}
                              title="Reject"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        <button className="btn btn-ghost btn-icon btn-sm" title="View Details">
                          <FileText size={16} />
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
