import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { Users, UserCheck, UserX, Building2, ClipboardList, AlertTriangle, TrendingUp, FileText, ChevronDown, ChevronRight, X, Search } from 'lucide-react';
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
    specialUnits: 0,
    districts: 0,
    units: 0
  });
  const [recentPersonnel, setRecentPersonnel] = useState([]);
  
  // Super Admin specific state
  const [allDistricts, setAllDistricts] = useState([]);
  const [statesList, setStatesList] = useState([]);
  const [expandedStates, setExpandedStates] = useState({});
  const [modalData, setModalData] = useState({ show: false, title: '', items: [], loading: false });
  const [modalSearch, setModalSearch] = useState('');

  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadDashboardData();
    fetchHierarchy();
  }, [user, isSuperAdmin]);

  async function handleRowClick(type) {
    setModalSearch('');
    setModalData({ show: true, title: type, items: [], loading: true });
    try {
      let items = [];
      if (type === 'Ranges / Commissionerates') {
        const ranges = await api.hierarchy.ranges();
        items = (ranges || []).filter(r => !(r.name || '').toLowerCase().includes('special units'));
      } else if (type === 'Special Units') {
        items = allDistricts.filter(d => (d.rangeName || '').toLowerCase().includes('special units'));
      } else if (type === 'Districts') {
        items = allDistricts.filter(d => !(d.rangeName || '').toLowerCase().includes('special units'));
      } else if (type === 'Units / Police Stations') {
        const units = await api.hierarchy.units();
        items = units || [];
      }
      setModalData({ show: true, title: type, items, loading: false });
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      setModalData(prev => ({ ...prev, loading: false }));
    }
  }

  async function fetchHierarchy() {
    try {
      const data = await api.hierarchy.stats();
      if (data && data.levels) {
        const counts = { ranges: 0, specialUnits: data.specialUnits, districts: 0, units: 0 };
        data.levels.forEach(row => {
          if (row.level === 2) counts.ranges = row.count - 1; // subtract 1 for the 'Special Units' umbrella node
          if (row.level === 3) counts.districts = row.count - data.specialUnits; // subtract special units count to get pure districts
          if (row.level === 4) counts.units = row.count;
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
          <h2>DMS Overview</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <div className="page-header-actions">

        </div>
      </div>

      {/* Main Content Area */}
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
          <div className="stat-widget-data" style={{ width: '100%', padding: '0 5px' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-800)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--gray-100)', paddingBottom: '4px' }}>
              Org. Structure
            </p>
            {[
              { label: 'Ranges / Commissionerates', value: hierarchyStats.ranges },
              { label: 'Special Units', value: hierarchyStats.specialUnits },
              { label: 'Districts', value: hierarchyStats.districts },
              { label: 'Units / Police Stations', value: hierarchyStats.units }
            ].map((row, idx) => (
              <div key={row.label} 
                onClick={() => handleRowClick(row.label)}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '5px 8px',
                  margin: '2px -8px',
                  borderRadius: '6px',
                  borderBottom: idx < 3 ? '1px solid var(--gray-50)' : 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--blue-50)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--gray-700)', fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--primary-700)' }}>
                  {loading ? '—' : (row.value ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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

        {/* Districts Table (Grouped by State) */}
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
                    // Group districts for this state, excluding special units
                    const stateDistricts = allDistricts.filter(d => 
                      (d.stateId || 'haryana') === stateId && 
                      !(d.rangeName || '').toLowerCase().includes('special units')
                    );
                    const isExpanded = expandedStates[stateId];

                    if (stateDistricts.length === 0) return null;

                    return (
                      <React.Fragment key={stateId}>
                        <tr 
                          onClick={() => setExpandedStates(prev => ({ ...prev, [stateId]: !prev[stateId] }))}
                          style={{ cursor: 'pointer', background: 'var(--gray-50)' }}
                        >
                          <td style={{ textAlign: 'center', color: 'var(--gray-500)' }}>
                            <ChevronRight style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: '0.2s', width: 16 }} />
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--gray-800)' }}>{stateName}</td>
                          <td>
                            <span className="badge badge-primary" style={{ background: 'var(--primary-50)', color: 'var(--primary-700)' }}>{stateDistricts.length}</span>
                          </td>
                        </tr>
                        
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
      </div>

      {/* Detail Modal */}
      {modalData.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="panel" style={{ width: '90%', maxWidth: '500px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-100)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>{modalData.title}</h3>
              <button 
                onClick={() => setModalData({ show: false, title: '', items: [], loading: false })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-500)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '15px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {!modalData.loading && modalData.items.length > 0 && (
                <div style={{ position: 'relative', marginBottom: '15px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '35px', borderRadius: '20px', width: '100%', border: '1px solid var(--gray-200)' }}
                  />
                </div>
              )}
              
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {modalData.loading ? (
                  <div className="spinner" style={{ margin: '20px auto' }}></div>
                ) : modalData.items.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--gray-500)' }}>No items found.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {modalData.items
                      .filter(item => (item.name || item.districtName || '').toLowerCase().includes(modalSearch.toLowerCase()))
                      .map((item, i) => (
                      <li key={item.id} style={{ 
                        padding: '10px', 
                        borderBottom: '1px solid var(--gray-50)',
                        display: 'flex', alignItems: 'center', gap: '10px'
                      }}>
                        <span style={{ color: 'var(--gray-400)', fontSize: '0.8rem', minWidth: '20px' }}>{i + 1}.</span>
                        <span style={{ fontWeight: 500, color: 'var(--gray-800)' }}>{item.name || item.districtName}</span>
                      </li>
                    ))}
                    {modalData.items.filter(item => (item.name || item.districtName || '').toLowerCase().includes(modalSearch.toLowerCase())).length === 0 && (
                      <p style={{ textAlign: 'center', color: 'var(--gray-500)', marginTop: '20px' }}>No matching results found.</p>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
