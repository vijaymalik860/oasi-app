import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import {
  CalendarCheck, Search, Save, ChevronLeft, ChevronRight, ChevronDown,
  UserCheck, UserX, Clock, Filter
} from 'lucide-react';

const ATTENDANCE_OPTIONS = [
  { value: 'Present', label: 'Present', color: 'var(--success-500)' },
  { value: 'Absent', label: 'Absent', color: 'var(--danger-500)' },
  { value: 'Half Day', label: 'Half Day', color: 'var(--warning-500)' },
  { value: 'Hourly Leave', label: 'Hourly Leave', color: 'var(--info-500)' },
  { value: 'Leave', label: 'Leave', color: 'var(--gray-500)' },
  { value: 'Duty Outside', label: 'Duty Outside', color: 'var(--primary-500)' },
];

export default function AttendanceRegister() {
  const { user, isSuperAdmin, isStateAdmin, isRangeAdmin, isDistrictAdmin, isUnitAdmin } = useAuth();
  const toast = useToast();

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // UI State
  const [viewMode, setViewMode] = useState('hierarchy'); // 'hierarchy' | 'register'
  const [selectedEntity, setSelectedEntity] = useState(null); // { id, name, type, unitId }
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState(new Set());
  const [searchHierarchy, setSearchHierarchy] = useState('');

  // Data State
  const [units, setUnits] = useState([]);
  const [subUnits, setSubUnits] = useState({}); // unitId -> subUnits[]
  const [personnel, setPersonnel] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); 
  const [masterRanks, setMasterRanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [bulkAction, setBulkAction] = useState('');

  // Countdown State
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isDeadlineReached, setIsDeadlineReached] = useState(false);

  // Smart Lookup State: id -> { name, module }
  const [lookupNames, setLookupNames] = useState({});

  // 1. Load Hierarchy on Mount
  useEffect(() => {
    loadHierarchy();
    loadMasterRanks();
  }, [user]);

  async function loadHierarchy() {
    try {
      setHierarchyLoading(true);
      
      // Fetch all units
      const unitData = await api.hierarchy.units();
      
      // Map to UI names
      let mappedUnits = (unitData||[]).map(u => ({ 
        id: u.id, 
        unitName: u.name, 
        unitType: u.unit_type,
        stateId: u.state_id,
        rangeId: u.range_id,
        districtId: u.district_id,
        assignedModule: u.assigned_module
      })).filter(u => u.assignedModule === 'attendance');
      
      mappedUnits.sort((a, b) => (a.unitName || '').localeCompare(b.unitName || ''));
      setUnits(mappedUnits);

      // Fetch all sub-units for these units in one go
      const uIds = mappedUnits.map(u => u.id);
      if (uIds.length > 0) {
        const subUnitData = await api.hierarchy.subUnits();
        
        const subUnitsMap = {};
        (subUnitData||[]).filter(su => su.assigned_module === 'attendance' && uIds.includes(su.unit_id)).forEach(su => {
          const mappedSU = { 
            id: su.id, 
            subUnitName: su.name, 
            unitId: su.unit_id,
            assignedModule: su.assigned_module 
          };
          if (!subUnitsMap[mappedSU.unitId]) subUnitsMap[mappedSU.unitId] = [];
          subUnitsMap[mappedSU.unitId].push(mappedSU);
        });
        setSubUnits(subUnitsMap);
      }
    } catch (err) {
      console.error('Hierarchy load error:', err);
      toast.error('Failed to load Unit hierarchy.');
    } finally {
      setHierarchyLoading(false);
    }
  }

  // Real-time Countdown Timer (to 5 PM)
  useEffect(() => {
    const checkTime = () => {
      const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
      if (selectedDate !== todayStr) {
        setTimeLeft('');
        return;
      }

      const now = new Date();
      const deadline = new Date();
      deadline.setHours(17, 0, 0, 0); // 5 PM

      const diff = deadline - now;
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        setIsUrgent(true);
        if (!isDeadlineReached && !loading && personnel.length > 0 && selectedEntity) {
          setIsDeadlineReached(true);
          triggerAutoMarking(personnel, attendanceMap);
        }
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      setIsUrgent(h === 0 && m < 30);
    };

    checkTime(); // Run immediately
    const timer = setInterval(checkTime, 1000);
    return () => clearInterval(timer);
  }, [selectedDate, loading, personnel, attendanceMap, isDeadlineReached, selectedEntity]);

  // 2. Load Personnel when entity is selected
  useEffect(() => {
    if (viewMode === 'register' && selectedEntity) {
      loadData();
    }
  }, [viewMode, selectedEntity, selectedDate]);

  async function loadData() {
    if (!selectedEntity) return;
    try {
      setLoading(true);
      
      // 1. Fetch Active Personnel
      let personnelParams = {};
      if (selectedEntity.type === 'subunit') {
        personnelParams.current_sub_unit_id = selectedEntity.id;
      } else {
        personnelParams.current_unit_id = selectedEntity.id;
      }
      
      const pData = await api.personnel.list(personnelParams);
      const personnelData = (pData||[]).filter(p => p.service_status === 'Active' && !p.is_deleted);

      const mappedPersonnel = personnelData.map(p => ({
        id: p.id,
        fullName: p.full_name,
        beltNumber: p.belt_number,
        rank: p.rank,
        currentUnitId: p.current_unit_id,
        currentSubUnitId: p.current_sub_unit_id,
        stateId: p.state_id,
        rangeId: p.range_id,
        districtId: p.district_id
      }));
      setPersonnel(mappedPersonnel);

      // 2. Fetch Attendance for this entity and date
      let attParams = { date: selectedDate };
      if (selectedEntity.type === 'subunit') {
        attParams.sub_unit_id = selectedEntity.id;
      } else {
        attParams.unit_id = selectedEntity.id;
      }

      const attData = await api.attendance.get(attParams);

      const attMap = {};
      (attData||[]).forEach(d => {
        attMap[d.personnel_id] = { 
          id: d.id, 
          personnelId: d.personnel_id,
          attendanceType: d.attendance_type,
          ...d
        };
      });
      setAttendanceMap(attMap);

      // 4. Auto-Marking check
      if (selectedEntity && selectedDate === new Date().toISOString().split('T')[0]) {
        await triggerAutoMarking(mappedPersonnel, attMap);
      }
    } catch (err) {
      console.error('Data load error:', err);
      toast.error('Failed to load personnel data.');
    } finally {
      setLoading(false);
    }
  }

  function toggleUnit(unitId) {
    const next = new Set(expandedUnits);
    if (next.has(unitId)) next.delete(unitId);
    else next.add(unitId);
    setExpandedUnits(next);
  }

  function openRegister(entity) {
    setSelectedEntity(entity);
    setViewMode('register');
    window.scrollTo(0, 0);
  }

  function goBack() {
    setViewMode('hierarchy');
    setPersonnel([]);
    setAttendanceMap({});
  }


  // Resolve Unit and Sub-Unit IDs to names on-the-fly
  async function resolveHierarchyNames(data) {
    if (data.length === 0) return;
  }

  // Filter personnel: Search and Rank
  const filteredPersonnel = useMemo(() => {
    return personnel.filter(p => {
      // 1. Rank filter
      if (rankFilter && p.rank !== rankFilter) return false;

      // 2. Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match =
          (p.fullName || '').toLowerCase().includes(term) ||
          (p.beltNumber || '').toLowerCase().includes(term) ||
          (p.rank || '').toLowerCase().includes(term);
        if (!match) return false;
      }
      return true;
    });
  }, [personnel, searchTerm, rankFilter]);

  // Stats
  const stats = useMemo(() => {
    try {
      const safePersonnel = filteredPersonnel || [];
      const total = safePersonnel.length;
      const present = safePersonnel.filter(p => {
        const a = attendanceMap[p.id];
        return a?.attendanceType === 'Present' || a?.attendanceType === 'Duty Outside';
      }).length;
      const absent = safePersonnel.filter(p => attendanceMap[p.id]?.attendanceType === 'Absent').length;
      const onLeave = safePersonnel.filter(p => {
        const a = attendanceMap[p.id];
        return a?.attendanceType === 'Leave' || a?.attendanceType === 'Half Day' || a?.attendanceType === 'Hourly Leave';
      }).length;
      const unmarked = total - safePersonnel.filter(p => attendanceMap[p.id]).length;
      return { total, present, absent, onLeave, unmarked };
    } catch (e) {
      console.error('Stats calculation error:', e);
      return { total: 0, present: 0, absent: 0, onLeave: 0, unmarked: 0 };
    }
  }, [filteredPersonnel, attendanceMap]);

  const LATE_THRESHOLD = "10:00"; // 10:00 AM

  async function triggerAutoMarking(currentPersonnel, currentAttMap) {
    const now = new Date();
    if (now.getHours() < 17) return; // Only after 5 PM

    const unmarked = currentPersonnel.filter(p => !currentAttMap[p.id]);
    if (unmarked.length === 0) return;

    try {
      setSaving(true);
      const payload = unmarked.map(p => ({
        personnel_id: p.id,
        date: selectedDate,
        attendance_type: 'Present',
        attendance_source: 'System-Auto',
        marking_method: 'System',
        state_id: p.stateId || user.stateId || null,
        range_id: p.rangeId || user.rangeId || null,
        district_id: p.districtId || user.districtId || null,
        unit_id: p.currentUnitId || user.unitId || null,
        sub_unit_id: p.currentSubUnitId || user.subUnitId || null,
        marked_by_user_id: user.id || '00000000-0000-0000-0000-000000000000', // System identifier
        marked_by_role: 'system',
        is_late: false,
        marked_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const data = await api.attendance.bulk(payload);

      const newAttMap = {};
      (data||[]).forEach(d => {
        newAttMap[d.personnel_id] = { id: d.id, personnelId: d.personnel_id, attendanceType: d.attendance_type };
      });

      setAttendanceMap(prev => ({ ...prev, ...newAttMap }));
      toast.info(`System auto-marked ${unmarked.length} personnel as Present.`);
    } catch (err) {
      console.error('Auto-marking error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function loadMasterRanks() {
    if (!user?.stateId) return;
    try {
      const fields = await api.admin.fieldTypes(user.stateId);
      const rankField = (fields||[]).find(f => f.field_name === 'rank');
      if (rankField) {
        const values = await api.admin.dropdownValues({ stateId: user.stateId });
        const rankValues = (values||[]).filter(v => v.field_type_id === rankField.id);
        rankValues.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        setMasterRanks(rankValues);
      }
    } catch (err) {
      console.error('Failed to load ranks:', err);
    }
  }

  // Mark single attendance
  async function markAttendance(personnelId, attendanceType, hourlyDetails = {}) {
    try {
      const existing = attendanceMap[personnelId];
      const person = personnel.find(p => p.id === personnelId);

      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5);
      const isLate = timeStr > LATE_THRESHOLD;

      const payload = {
        personnel_id: personnelId,
        date: selectedDate,
        attendance_type: attendanceType,
        attendance_source: 'Register',
        marking_method: 'Manual',
        state_id: person?.stateId || user.stateId || null,
        range_id: person?.rangeId || user.rangeId || null,
        district_id: person?.districtId || user.districtId || null,
        unit_id: person?.currentUnitId || user.unitId || null,
        sub_unit_id: person?.currentSubUnitId || user.subUnitId || null,
        marked_by_user_id: user.id || null,
        marked_by_role: user.role,
        is_late: isLate,
        updated_at: new Date().toISOString(),
        ...hourlyDetails
      };

      if (!existing) {
        payload.created_at = new Date().toISOString();
        payload.marked_at = new Date().toISOString();
      }

      const data = await api.attendance.mark(payload);

      setAttendanceMap(prev => ({
        ...prev,
        [personnelId]: {
          id: data.id || data[0]?.id,
          personnelId,
          attendanceType,
          ...hourlyDetails,
        },
      }));
    } catch (err) {
      console.error('Mark attendance error:', err);
      toast.error('Failed to update attendance.');
    }
  }

  // Bulk mark all visible personnel
  async function handleBulkAction() {
    if (!bulkAction) return;
    setSaving(true);
    try {
      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 5);
      const isLate = timeStr > LATE_THRESHOLD;

      const payload = filteredPersonnel.map(person => ({
        personnel_id: person.id,
        date: selectedDate,
        attendance_type: bulkAction,
        attendance_source: 'Register',
        marking_method: 'Manual',
        state_id: person.stateId || user.stateId || null,
        range_id: person.rangeId || user.rangeId || null,
        district_id: person.districtId || user.districtId || null,
        unit_id: person.currentUnitId || user.unitId || null,
        sub_unit_id: person.currentSubUnitId || user.subUnitId || null,
        marked_by_user_id: user.id || null,
        marked_by_role: user.role,
        is_late: isLate,
        updated_at: new Date().toISOString(),
      }));

      const data = await api.attendance.bulk(payload);

      setAttendanceMap(prev => {
        const updated = { ...prev };
        (data||[]).forEach(d => {
          updated[d.personnel_id] = { id: d.id, personnelId: d.personnel_id, attendanceType: d.attendance_type };
        });
        return updated;
      });

      toast.success(`Marked ${filteredPersonnel.length} personnel as "${bulkAction}".`);
      setBulkAction('');
    } catch (err) {
      if (import.meta.env.DEV) console.error('Bulk action error:', err);
      toast.error('Bulk action failed.');
    } finally {
      setSaving(false);
    }
  }

  // Date navigation
  function changeDate(delta) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  }

  // Check if after 5 PM deadline
  const now = new Date();
  const deadlineHour = 17; // 5 PM
  const isAfterDeadline = now.getHours() >= deadlineHour && selectedDate === now.toISOString().split('T')[0];

  // Ranks for filter: Use master ranks if loaded, fallback to unique from personnel
  const availableRanks = useMemo(() => {
    if (masterRanks.length > 0) return masterRanks.map(r => r.value);
    return [...new Set(personnel.map(p => p.rank).filter(Boolean))];
  }, [masterRanks, personnel]);

  // Final defensive check to catch any accidental crashes
  if (!user) return <div className="p-8 text-center"><div className="spinner"></div><p>Verifying authentication...</p></div>;

  try {
    return (
      <div key={`attendance-root-${selectedDate}-${selectedEntity?.id || 'none'}`}>
        <div className="page-header">
          <h2>Attendance Register</h2>
          <div className="page-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Timer in Header */}
            {timeLeft && (
              <div className={`countdown-timer ${isUrgent ? 'urgent' : ''}`} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: isUrgent ? 'var(--danger-500)' : 'var(--success-600)',
                  color: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: 'none',
                  minWidth: '180px',
                  justifyContent: 'center'
                }}>
                <Clock size={18} />
                <span>{isDeadlineReached ? 'Auto-Marking Complete' : `Final Submission: ${timeLeft}`}</span>
              </div>
            )}
            {isAfterDeadline && !isDeadlineReached && (
              <span className="badge badge-warning" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                ⚠️ Past 5:00 PM deadline
              </span>
            )}
          </div>
        </div>

        {/* Date Selector & Stats */}
        <div className="stats-bar" style={{ marginBottom: 16 }}>
          <div className="stat-widget" style={{ flex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => changeDate(-1)}>
                <ChevronLeft size={18} />
              </button>
              <input
                type="date"
                className="form-input date-field"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ textAlign: 'center', fontWeight: 600 }}
              />
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => changeDate(1)}>
                <ChevronRight size={18} />
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>
                Today
              </button>
            </div>
          </div>
          <div className="stat-widget">
            <div className="stat-widget-icon green"><UserCheck size={18} /></div>
            <div className="stat-widget-data"><h3>{stats?.present || 0}</h3><p>Present</p></div>
          </div>
          <div className="stat-widget">
            <div className="stat-widget-icon red"><UserX size={18} /></div>
            <div className="stat-widget-data"><h3>{stats?.absent || 0}</h3><p>Absent</p></div>
          </div>
          <div className="stat-widget">
            <div className="stat-widget-icon amber"><Clock size={18} /></div>
            <div className="stat-widget-data"><h3>{stats?.onLeave || 0}</h3><p>Leave</p></div>
          </div>
          <div className="stat-widget">
            <div className="stat-widget-icon info"><CalendarCheck size={18} /></div>
            <div className="stat-widget-data"><h3>{stats?.unmarked || 0}</h3><p>Unmarked</p></div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="panel card-container">
          {viewMode === 'hierarchy' ? (
            <div className="hierarchy-explorer">
              <div className="panel-header" style={{ borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', flexWrap: 'wrap' }}>
                  <div className="search-input-wrapper" style={{ flex: 1, minWidth: '250px' }}>
                    <Search size={16} className="search-icon" />
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Find Unit / Sub-unit..." 
                      value={searchHierarchy}
                      onChange={e => setSearchHierarchy(e.target.value)}
                    />
                  </div>
                  <div style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>
                    {units?.length || 0} Units Available
                  </div>
                </div>
              </div>

              <div className="hierarchy-list" style={{ padding: '10px' }}>
                {hierarchyLoading ? (
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <div className="spinner spinner-lg"></div>
                    <p className="mt-4 text-gray-500">Building organizational hierarchy...</p>
                  </div>
                ) : units.filter(u => (u.unitName || '').toLowerCase().includes(searchHierarchy.toLowerCase())).length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <Filter size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
                    <p>No units matching your search scope.</p>
                  </div>
                ) : (
                  units
                    .filter(u => (u.unitName || '').toLowerCase().includes(searchHierarchy.toLowerCase()) || 
                                 (subUnits[u.id] || []).some(su => (su.subUnitName || '').toLowerCase().includes(searchHierarchy.toLowerCase())))
                    .map(unit => {
                      const isOpen = expandedUnits.has(unit.id);
                      const unitSubUnits = subUnits[unit.id] || [];
                      
                      return (
                        <div key={unit.id} className="unit-section" style={{ 
                          marginBottom: 10, 
                          border: '1px solid var(--gray-200)', 
                          borderRadius: 12, 
                          overflow: 'hidden',
                          background: 'white',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                          <div 
                            className="unit-header" 
                            onClick={() => toggleUnit(unit.id)}
                            style={{ 
                              padding: '14px 20px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              cursor: 'pointer',
                              background: isOpen ? 'var(--primary-50)' : 'transparent',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ 
                              width: 32, 
                              height: 32, 
                              borderRadius: 8, 
                              background: isOpen ? 'var(--primary-100)' : 'var(--gray-100)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              marginRight: 16,
                              color: isOpen ? 'var(--primary-600)' : 'var(--gray-500)'
                            }}>
                              {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--navy)' }}>{unit.unitName}</h3>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                                {unitSubUnits.length} Sub-units • {unit.unitType || 'General'}
                              </p>
                            </div>
                            <button 
                              className="btn btn-ghost btn-sm" 
                              onClick={(e) => { e.stopPropagation(); openRegister({ id: unit.id, name: unit.unitName, type: 'unit' }); }}
                              style={{ fontSize: '0.75rem' }}
                            >
                              Mark Unit Staff
                            </button>
                          </div>

                          {isOpen && (
                            <div className="unit-body" style={{ background: 'var(--gray-50)', borderTop: '1px solid var(--gray-100)' }}>
                              {unitSubUnits.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.85rem' }}>
                                  No designated sub-units for this unit.
                                </div>
                              ) : (
                                <div className="subunit-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', padding: '15px' }}>
                                  {unitSubUnits.map(su => (
                                    <div 
                                      key={su.id} 
                                      className="subunit-card"
                                      onClick={() => openRegister({ id: su.id, name: su.subUnitName, type: 'subunit', unitId: unit.id })}
                                      style={{ 
                                        background: 'white', 
                                        padding: '12px 16px', 
                                        borderRadius: 10, 
                                        border: '1px solid var(--gray-200)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        transition: 'transform 0.1s, box-shadow 0.1s'
                                      }}
                                      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                                      onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary-400)' }}></div>
                                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--gray-700)' }}>{su.subUnitName}</span>
                                      </div>
                                      <ChevronRight size={14} style={{ color: 'var(--gray-300)' }} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          ) : (
            <div className="register-view">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button className="btn btn-secondary btn-icon btn-sm" onClick={goBack}>
                    <ChevronLeft size={18} />
                  </button>
                  <div>
                    <h3 style={{ margin: 0 }}>{selectedEntity?.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                      Detailed Attendance Register • {selectedDate}
                    </p>
                  </div>
                </div>

                <div className="table-controls" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div className="search-input-wrapper" style={{ width: 160 }}>
                    <Search size={14} className="search-icon" />
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Search personnel..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '4px 8px 4px 28px' }}
                    />
                  </div>
                  <select className="filter-select" style={{ width: 110, fontSize: '0.8rem' }} value={rankFilter} onChange={(e) => setRankFilter(e.target.value)}>
                    <option value="">All Ranks</option>
                    {availableRanks.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <select className="filter-select" style={{ width: 120, fontSize: '0.8rem' }} value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
                      <option value="">Bulk Action...</option>
                      {ATTENDANCE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>All: {opt.label}</option>
                      ))}
                    </select>
                    {bulkAction && (
                      <button className="btn btn-primary btn-sm" onClick={handleBulkAction} disabled={saving} style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                        Apply
                      </button>
                    )}
                  </div>
                </div>
              </div>

            {(() => {
              if (loading) return (
                <div className="empty-state">
                  <div className="spinner spinner-lg" style={{ margin: '0 auto' }}></div>
                  <p>Loading personnel...</p>
                </div>
              );

              if (filteredPersonnel.length === 0) return (
                <div className="empty-state">
                  <CalendarCheck className="icon" style={{ opacity: 0.1 }} size={48} />
                  <h4>No personnel found</h4>
                  <p>No active personnel were found for the selected {selectedEntity?.type}.</p>
                  <button className="btn btn-secondary mt-4" onClick={goBack}>Change Selection</button>
                </div>
              );

              // Group by Sub-Unit
              const groupedBySubUnit = {};
              const unitSubUnits = subUnits[selectedEntity.type === 'unit' ? selectedEntity.id : selectedEntity.unitId] || [];
              
              // Initialize groups
              groupedBySubUnit['main'] = { name: `${selectedEntity.name} (Main Office)`, personnel: [] };
              unitSubUnits.forEach(su => {
                groupedBySubUnit[su.id] = { name: su.subUnitName, personnel: [] };
              });

              // Assign personnel to groups
              filteredPersonnel.forEach(p => {
                const sId = p.currentSubUnitId;
                if (sId && groupedBySubUnit[sId]) {
                  groupedBySubUnit[sId].personnel.push(p);
                } else {
                  groupedBySubUnit['main'].personnel.push(p);
                }
              });

              // Filter out empty groups for display, except maybe 'main' if it has kids
              const activeGroups = Object.keys(groupedBySubUnit).filter(id => groupedBySubUnit[id].personnel.length > 0);

              if (activeGroups.length === 0) return (
                <div className="empty-state">
                   <p>Personnel exist but are filtered out by current search/rank criteria.</p>
                </div>
              );

              return activeGroups.map(groupId => (
                <div key={groupId} className="subunit-table-section mb-6">
                  <div style={{ 
                    padding: '8px 16px', 
                    background: 'var(--gray-50)', 
                    borderLeft: '4px solid var(--primary-500)',
                    marginBottom: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--gray-700)' }}>
                      {groupedBySubUnit[groupId].name} 
                      <span className="badge badge-neutral ml-2">{groupedBySubUnit[groupId].personnel.length}</span>
                    </h4>
                  </div>
                  
                  <div className="table-container" style={{ border: '1px solid var(--gray-200)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: 50 }}>S.No</th>
                          <th>Belt No.</th>
                          <th>Name</th>
                          <th>Rank</th>
                          <th style={{ width: 180 }}>Attendance</th>
                          <th style={{ width: 220 }}>Remarks</th>
                          <th style={{ width: 120 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedBySubUnit[groupId].personnel.map((p, idx) => {
                          const att = attendanceMap[p.id];
                          const currentType = att?.attendanceType || '';
                          const statusOpt = ATTENDANCE_OPTIONS.find(o => o.value === currentType);
                          return (
                            <tr key={p.id}>
                              <td>{idx + 1}</td>
                              <td style={{ fontWeight: 600 }}>{p.beltNumber || '—'}</td>
                              <td>{p.fullName || '—'}</td>
                              <td><span className="badge badge-primary">{p.rank || '—'}</span></td>
                              <td>
                                <select
                                  className="form-select"
                                  value={currentType}
                                  onChange={(e) => markAttendance(p.id, e.target.value)}
                                  disabled={saving}
                                  style={{
                                    borderColor: statusOpt?.color || 'var(--gray-200)',
                                    fontWeight: currentType ? 600 : 400,
                                    color: statusOpt?.color || 'inherit',
                                    padding: '4px 8px',
                                    fontSize: '0.85rem',
                                    height: '32px'
                                  }}
                                >
                                  <option value="">— Select —</option>
                                  {ATTENDANCE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder="Add remark..."
                                  defaultValue={att?.remarks || ''}
                                  onBlur={(e) => {
                                    if(e.target.value !== (att?.remarks || '')) {
                                      markAttendance(p.id, currentType || 'Present', { remarks: e.target.value });
                                    }
                                  }}
                                  disabled={saving}
                                  style={{ padding: '4px 8px', fontSize: '0.85rem', height: '32px' }}
                                />
                              </td>
                              <td>
                                {currentType ? (
                                  <span className={`badge ${
                                    currentType === 'Present' || currentType === 'Duty Outside' ? 'badge-success' :
                                    currentType === 'Absent' ? 'badge-danger' :
                                    'badge-warning'
                                  }`} style={{ fontSize: '0.75rem' }}>
                                    {currentType}
                                  </span>
                                ) : (
                                  <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>Unmarked</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ));
            })()}

          <div className="panel-footer">
            <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
              {filteredPersonnel?.length || 0} personnel • {Object.keys(attendanceMap).length} marked • {stats?.unmarked || 0} remaining
            </span>
          </div>
        </div>
      )}
      </div>
     </div>
    );
  } catch (error) {
    return (
      <div className="p-8 text-center text-red-500">
        <h3>Critical Error in Attendance Register</h3>
        <p>{error.message}</p>
        <button className="btn btn-primary mt-4" onClick={() => window.location.reload()}>Reload Page</button>
      </div>
    );
  }
}
