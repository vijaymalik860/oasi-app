import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { Users, UserCheck, UserX, Building2, ClipboardList, AlertTriangle, TrendingUp, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { Database, Trash2 } from 'lucide-react';

export default function Dashboard() {
  const { user, isSuperAdmin, isStateAdmin, isRangeAdmin, isDistrictAdmin, isUnitAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [resetting, setResetting] = useState(false);
  const [stats, setStats] = useState({
    totalPersonnel: 0,
    presentToday: 0,
    absentToday: 0,
    activeChitthas: 0,
    pendingAlerts: 0,
  });
  const [hierarchyStats, setHierarchyStats] = useState({
    ranges: 0,
    commissionerates: 0,
    others: 0
  });
  const [recentPersonnel, setRecentPersonnel] = useState([]);
  
  // Super Admin specific state
  const [allDistricts, setAllDistricts] = useState([]);
  const [stateAdmins, setStateAdmins] = useState([]);
  const [statesList, setStatesList] = useState([]);
  const [expandedStates, setExpandedStates] = useState({});

  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadDashboardData();
    fetchHierarchy();
  }, [user, isSuperAdmin, isStateAdmin, isRangeAdmin, isDistrictAdmin, isUnitAdmin]);

  async function fetchHierarchy() {
    try {
      const data = await api.hierarchy.ranges(user.stateId);
      if (data) {
        const counts = { ranges: 0, commissionerates: 0, others: 0 };
        data.forEach(row => {
          const name = row.name || '';
          if (name.toLowerCase().includes('commissionerate')) counts.commissionerates++;
          else if (name.toLowerCase().includes('range')) counts.ranges++;
          else counts.others++;
        });
        setHierarchyStats(counts);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Hierarchy fetch error:', err);
    }
  }

  async function loadDashboardData() {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // 1. Personnel list
      const personnelData = await api.personnel.list();
      const active = (personnelData || []).filter(p => p.service_status === 'Active' && !p.is_deleted);
      setRecentPersonnel(active.slice(0, 10).map(p => ({
        id: p.id,
        fullName: p.full_name,
        beltNumber: p.belt_number,
        rank: p.rank,
        mobileNumber: p.mobile_number,
        serviceStatus: p.service_status,
      })));

      // 2. Attendance stats
      const attData = await api.attendance.get({ date: today });
      const presentToday = (attData || []).filter(a =>
        ['Present', 'Duty Outside'].includes(a.attendance_type)
      ).length;

      setStats({
        totalPersonnel: active.length,
        presentToday,
        absentToday: active.length - presentToday,
        activeChitthas: 0,
        pendingAlerts: 0,
      });

      // 3. Super Admin — load states
      if (isSuperAdmin) {
        const states = await api.hierarchy.states();
        setStatesList((states || []).map(s => ({ id: s.id, stateName: s.name })));
        const users = await api.admin.users();
        setStateAdmins((users || []).filter(u => u.role_name === 'state_admin' && u.is_active)
          .map(a => ({ id: a.id, beltNumber: a.belt_number, name: a.name, stateId: a.state_id })));
      }

      // 4. Districts for super admin
      if (isSuperAdmin) {
        const distData = await api.hierarchy.districts();
        setAllDistricts((distData || []).map(d => ({ id: d.id, districtName: d.name, ...d })));
      }

    } catch (err) {
      if (import.meta.env.DEV) console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // M3: Removed dead 'vacancy' variable — stats.totalUnits was never populated

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <h2>OASI Overview</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <div className="page-header-actions">

        </div>
      </div>

      {/* Main Content Area based on Role */}
      {!isSuperAdmin ? (
        <>
          {/* Stats widgets */}
          <div className="stats-bar">
            <div className="stat-widget">
              <div className="stat-widget-icon blue"><Users size={22} /></div>
              <div className="stat-widget-data">
                <h3>{loading ? '—' : stats.totalPersonnel}</h3>
                <p>Total Personnel</p>
              </div>
            </div>
            <div className="stat-widget">
              <div className="stat-widget-icon green"><UserCheck size={22} /></div>
              <div className="stat-widget-data">
                <h3>{loading ? '—' : stats.presentToday}</h3>
                <p>Present Today</p>
              </div>
            </div>
            <div className="stat-widget">
              <div className="stat-widget-icon red"><UserX size={22} /></div>
              <div className="stat-widget-data">
                <h3>{loading ? '—' : stats.absentToday}</h3>
                <p>Absent Today</p>
              </div>
            </div>
            
            {!isDistrictAdmin && !isUnitAdmin && (
              <div className="stat-widget">
                <div className="stat-widget-data" style={{ width: '100%', padding: '0 5px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--gray-100)', paddingBottom: '4px' }}>
                    Org. Structure
                  </p>
                  {[
                    { label: 'Ranges', value: hierarchyStats.ranges },
                    { label: 'Commissionerates', value: hierarchyStats.commissionerates },
                    { label: 'Others', value: hierarchyStats.others }
                  ].map((row, idx) => (
                    <div key={row.label} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '3px 0',
                      borderBottom: idx < 2 ? '1px solid var(--gray-50)' : 'none'
                    }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)', fontWeight: 500 }}>{row.label}</span>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary-700)' }}>
                        {loading ? '—' : (row.value ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="stat-widget" onClick={() => navigate('/reports/fir')} style={{ cursor: 'pointer' }}>
              <div className="stat-widget-icon purple"><FileText size={22} /></div>
              <div className="stat-widget-data">
                <h3><TrendingUp size={18} /></h3>
                <p>Crime Analytics</p>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>Recent Personnel</h3>
            </div>
            <div className="table-container">
              {loading ? (
                <div className="empty-state">
                  <div className="spinner spinner-lg" style={{ margin: '0 auto' }}></div>
                  <p>Loading data...</p>
                </div>
              ) : recentPersonnel.length === 0 ? (
                <div className="empty-state">
                  <Users className="icon" />
                  <h4>No personnel records yet</h4>
                  <p>Add personnel or import data from Excel to get started.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Belt No.</th>
                      <th>Name</th>
                      <th>Rank</th>
                      <th>Mobile</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPersonnel.map((p, idx) => (
                      <tr key={p.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{p.beltNumber || '—'}</td>
                        <td>{p.fullName || '—'}</td>
                        <td>
                            <span className="badge badge-primary">{p.rank || '—'}</span>
                        </td>
                        <td>{p.mobileNumber || '—'}</td>
                        <td>
                          <span className={`badge ${p.serviceStatus === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                            {p.serviceStatus || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
          {/* Districts Table (Grouped by State) - Minimal SuperAdmin Scope */}
          <div className="panel">
            <div className="panel-header">
              <h3>All Configured States & Districts</h3>
            </div>
            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {loading ? (
                <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
              ) : allDistricts.length === 0 ? (
                <div className="empty-state"><p>No districts found.</p></div>
              ) : (
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--white)', zIndex: 10 }}>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>State / District Name</th>
                      <th>Total Districts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statesList.map((stateObj) => {
                      const stateId = stateObj.id;
                      const stateName = stateObj.stateName || stateId;
                      // Group districts for this state (fallback to 'haryana' if missing, for old data)
                      const stateDistricts = allDistricts.filter(d => (d.stateId || 'haryana') === stateId);
                      const isExpanded = expandedStates[stateId];

                      if (stateDistricts.length === 0) return null;

                      return (
                        <React.Fragment key={stateId}>
                          {/* State Group Row */}
                          <tr 
                            onClick={() => setExpandedStates(prev => ({ ...prev, [stateId]: !prev[stateId] }))}
                            style={{ cursor: 'pointer', background: 'var(--gray-50)' }}
                          >
                            <td style={{ textAlign: 'center', width: '40px' }}>
                              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </td>
                            <td style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                              <span style={{ textTransform: 'capitalize' }}>{stateName}</span>
                            </td>
                            <td>
                              <span className="badge badge-primary">{stateDistricts.length}</span>
                            </td>
                          </tr>
                          
                          {/* District Rows (Expandable) */}
                          {isExpanded && stateDistricts
                            .sort((a, b) => (a.districtName || '').localeCompare(b.districtName || ''))
                            .map((d, idx) => (
                              <tr key={d.id} style={{ background: 'var(--white)' }}>
                                <td style={{ textAlign: 'right', color: 'var(--gray-400)', width: '40px' }}>{idx + 1}.</td>
                                <td colSpan={2} style={{ paddingLeft: '1rem' }}>
                                  {d.districtName || '—'}
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* State Admins Table */}
          <div className="panel">
            <div className="panel-header">
              <h3>State Admin Users</h3>
            </div>
            <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {loading ? (
                <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }}></div></div>
              ) : stateAdmins.length === 0 ? (
                <div className="empty-state"><p>No State Admins configured.</p></div>
              ) : (
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--white)', zIndex: 10 }}>
                    <tr>
                      <th>S.No</th>
                      <th>Belt / User ID</th>
                      <th>Name</th>
                      <th>State Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stateAdmins.map((admin, idx) => (
                      <tr key={admin.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{admin.beltNumber || '—'}</td>
                        <td>{admin.name || '—'}</td>
                        <td>
                          <span className="badge badge-info" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {admin.stateId || '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
