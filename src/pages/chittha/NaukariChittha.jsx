import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import {
  ClipboardList, Plus, Trash2, Search, Save, Lock,
  ChevronDown, ChevronRight, AlertTriangle, Check, X,
  Clock, Users, UserPlus, Send
} from 'lucide-react';

// ─── Fixed Section Sequence Per Business Rules ───────────────────────────────
const CHITTHA_SECTIONS = [
  { key: 'unit_detail', label: '1. Unit Detail Table', mandatory: true },
  { key: 'sho', label: '2. SHO', mandatory: true },
  { key: 'investigation', label: '3. Investigation Staff', mandatory: true },
  { key: 'mhc', label: '4. MHC Staff', mandatory: true },
  { key: 'mm', label: '5. MM Staff', mandatory: true },
  { key: 'sho_mobile', label: '6. SHO Mobile', mandatory: true },
  { key: 'erv', label: '7. ERV', mandatory: false, conditionalLabel: '(Only if assigned)' },
  { key: 'rider', label: '8. Rider', mandatory: false, conditionalLabel: '(Only if assigned)' },
  { key: 'general_duty', label: '9. General Duty', mandatory: true },
  { key: 'group_d', label: '10. Group-D Staff', mandatory: true },
  { key: 'leave_rest', label: '11. Leave / Weekly Rest', mandatory: true },
  { key: 'unallocated', label: '12. Unallocated', mandatory: true, auto: true },
];

const DUTY_TYPES = [
  'Naaka', 'Escort', 'Court Duty', 'Patrol', 'Office Duty',
  'VIP Duty', 'Night Shift', 'Traffic', 'Investigation',
];

// ─── Time-Block Enforcement ──────────────────────────────────────────────────
function getChitthaTimeStatus() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  const startMinutes = 17 * 60; // 5:00 PM
  const endMinutes = 21 * 60;   // 9:00 PM

  if (currentMinutes < startMinutes) {
    return {
      allowed: false,
      reason: `Chittha creation opens at 5:00 PM. Current time: ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      timeLeft: `Opens in ${Math.floor((startMinutes - currentMinutes) / 60)}h ${(startMinutes - currentMinutes) % 60}m`,
    };
  }
  if (currentMinutes >= endMinutes) {
    return {
      allowed: false,
      reason: `Chittha window closed at 9:00 PM. Current time: ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      timeLeft: 'Window closed',
    };
  }
  return {
    allowed: true,
    reason: '',
    timeLeft: `${Math.floor((endMinutes - currentMinutes) / 60)}h ${(endMinutes - currentMinutes) % 60}m remaining`,
  };
}

export default function NaukariChittha() {
  const { user, isRangeAdmin, isDistrictAdmin, isUnitAdmin } = useAuth();
  const toast = useToast();

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [chittha, setChittha] = useState(null); // Current chittha document
  const [personnel, setPersonnel] = useState([]);
  const [assignments, setAssignments] = useState([]); // All assignments for this chittha
  const [expandedSections, setExpandedSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timeStatus, setTimeStatus] = useState(getChitthaTimeStatus());

  // Assignment modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSection, setAssignSection] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedPersonnel, setSelectedPersonnel] = useState([]);
  const [assignDutyType, setAssignDutyType] = useState('');
  const [assignLocation, setAssignLocation] = useState('');
  const [assignRemark, setAssignRemark] = useState('');

  // Update time status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeStatus(getChitthaTimeStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { loadData(); }, [selectedDate, user]);

  async function loadData() {
    try {
      setLoading(true);

      const pParams = { service_status: 'Active' };
      if (user.unitId) pParams.unit_id = user.unitId;
      else if (isDistrictAdmin && user.districtId) pParams.district_id = user.districtId;
      else if (isRangeAdmin && user.rangeId) pParams.range_id = user.rangeId;
      
      const pData = await api.personnel.list(pParams);
      
      const mappedPersonnel = (pData||[]).map(p => ({
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

      const cData = await api.chitthas.list();
      
      // Filter by date and scope
      const matchingChittha = (cData||[]).find(c => {
        if (c.chittha_date !== selectedDate) return false;
        if (user.unitId && c.unit_id !== user.unitId) return false;
        if (isDistrictAdmin && user.districtId && c.district_id !== user.districtId) return false;
        if (isRangeAdmin && user.rangeId && c.range_id !== user.rangeId) return false;
        return true;
      });

      if (matchingChittha) {
        const fullChittha = await api.chitthas.get(matchingChittha.id);
        setChittha(fullChittha);

        setAssignments((fullChittha.assignments || []).map(a => ({
          id: a.id,
          chitthaId: a.chittha_id,
          personnelId: a.personnel_id,
          sectionName: a.section_name,
          dutyType: a.duty_type,
          dutyLocation: a.duty_location,
          remarkText: a.remark_text,
          isLockedByOSI: a.is_locked_by_osi,
          personnelName: mappedPersonnel.find(p => p.id === a.personnel_id)?.fullName || a.full_name || 'Unknown',
          personnelBelt: mappedPersonnel.find(p => p.id === a.personnel_id)?.beltNumber || a.belt_number || '—',
          personnelRank: mappedPersonnel.find(p => p.id === a.personnel_id)?.rank || a.rank || '—'
        })));
      } else {
        setChittha(null);
        setAssignments([]);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('Chittha load error:', err);
      toast.error('Failed to load chittha data.');
    } finally {
      setLoading(false);
    }
  }

  // Create new chittha
  async function createChittha() {
    const status = getChitthaTimeStatus();
    if (!status.allowed) {
      toast.warning(status.reason);
      return;
    }

    try {
      setSaving(true);
      const data = {
        state_id: user.stateId || null,
        range_id: user.rangeId || null,
        district_id: user.districtId || null,
        unit_id: user.unitId || null,
        sub_unit_id: user.subUnitId || null,
        chittha_date: selectedDate,
        status: 'Draft',
        created_by_user_id: user.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      const result = await api.chitthas.create(data);
      setChittha(result);
      toast.success('Chittha created for today.');
    } catch (err) {
      if (import.meta.env.DEV) console.error('Create error:', err);
      toast.error('Failed to create chittha.');
    } finally {
      setSaving(false);
    }
  }

  // Get assigned personnel IDs
  const assignedIds = useMemo(() => new Set(assignments.map(a => a.personnelId)), [assignments]);

  // Unallocated personnel (not assigned to any section)
  const unallocatedPersonnel = useMemo(() => {
    return personnel.filter(p => !assignedIds.has(p.id));
  }, [personnel, assignedIds]);

  // Assignments per section
  const sectionAssignments = useMemo(() => {
    const map = {};
    CHITTHA_SECTIONS.forEach(s => {
      map[s.key] = assignments.filter(a => a.sectionName === s.key);
    });
    return map;
  }, [assignments]);

  // Toggle section expansion
  function toggleSection(key) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Open assignment modal
  function openAssignModal(sectionKey) {
    const status = getChitthaTimeStatus();
    if (!status.allowed) {
      toast.warning(status.reason);
      return;
    }
    setAssignSection(sectionKey);
    setSelectedPersonnel([]);
    setAssignSearch('');
    setAssignDutyType('');
    setAssignLocation('');
    setAssignRemark('');
    setShowAssignModal(true);
  }

  // Available personnel for assignment (not yet assigned)
  const availablePersonnel = useMemo(() => {
    return personnel.filter(p => !assignedIds.has(p.id)).filter(p => {
      if (!assignSearch) return true;
      const term = assignSearch.toLowerCase();
      return (p.fullName || '').toLowerCase().includes(term) ||
        (p.beltNumber || '').toLowerCase().includes(term) ||
        (p.rank || '').toLowerCase().includes(term);
    });
  }, [personnel, assignedIds, assignSearch]);

  // Save assignments
  async function saveAssignments() {
    if (selectedPersonnel.length === 0) {
      toast.warning('Select at least one person.');
      return;
    }
    setSaving(true);
    try {
      const payload = selectedPersonnel.map(personId => {
        const person = personnel.find(p => p.id === personId);
        return {
          chittha_id: chittha.id,
          personnel_id: personId,
          section_name: assignSection,
          duty_type: assignDutyType,
          duty_location: assignLocation,
          remark_text: assignRemark,
          state_id: person?.stateId || user.stateId || null,
          range_id: person?.rangeId || user.rangeId || null,
          district_id: person?.districtId || user.districtId || null,
          unit_id: person?.currentUnitId || user.unitId || null,
          sub_unit_id: person?.currentSubUnitId || user.subUnitId || null,
          is_locked_by_osi: false,
          is_vip_duty: false,
          created_at: new Date().toISOString()
        };
      });

      const updatedAssignments = [...assignments, ...payload];
      
      await api.chitthas.update(chittha.id, {
        status: chittha.status,
        assignments: updatedAssignments.map(a => ({
          personnel_id: a.personnel_id || a.personnelId,
          section_name: a.section_name || a.sectionName,
          duty_type: a.duty_type || a.dutyType,
          duty_location: a.duty_location || a.dutyLocation,
          remark_text: a.remark_text || a.remarkText,
          is_vip_duty: a.is_vip_duty || false
        }))
      });

      toast.success(`${selectedPersonnel.length} personnel assigned to ${CHITTHA_SECTIONS.find(s => s.key === assignSection)?.label}`);
      setShowAssignModal(false);
      loadData(); // Refresh
    } catch (err) {
      if (import.meta.env.DEV) console.error('Save error:', err);
      toast.error('Failed to save assignments.');
    } finally {
      setSaving(false);
    }
  }

  // Remove assignment
  async function removeAssignment(assignmentId) {
    const assignment = assignments.find(a => a.id === assignmentId);
    if (assignment?.isLockedByOSI) {
      toast.warning('This assignment is locked by OSI and cannot be modified.');
      return;
    }
    try {
      const updatedAssignments = assignments.filter(a => a.id !== assignmentId);
      await api.chitthas.update(chittha.id, {
        status: chittha.status,
        assignments: updatedAssignments.map(a => ({
          personnel_id: a.personnelId,
          section_name: a.sectionName,
          duty_type: a.dutyType,
          duty_location: a.dutyLocation,
          remark_text: a.remarkText,
          is_vip_duty: a.isLockedByOSI || false // Keep original structure mapping
        }))
      });
      toast.success('Assignment removed.');
      loadData();
    } catch (err) {
      toast.error('Failed to remove assignment.');
    }
  }

  // Submit chittha
  async function submitChittha() {
    if (unallocatedPersonnel.length > 0) {
      toast.warning(`${unallocatedPersonnel.length} personnel are still unallocated. Assign or acknowledge them first.`);
      return;
    }
    try {
      setSaving(true);
      await api.chitthas.update(chittha.id, {
        status: 'Submitted'
      });
      
      setChittha(prev => ({ ...prev, status: 'Submitted' }));
      toast.success('Chittha submitted successfully!');
    } catch (err) {
      toast.error('Failed to submit chittha.');
    } finally {
      setSaving(false);
    }
  }

  const isReadonly = !timeStatus.allowed || chittha?.status === 'Submitted' || chittha?.status === 'Approved';

  return (
    <div>
      <div className="page-header">
        <h2>Naukari Chittha</h2>
        <div className="page-header-actions" style={{ gap: 8 }}>
          <div className={`badge ${timeStatus.allowed ? 'badge-success' : 'badge-danger'}`}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            <Clock size={14} style={{ marginRight: 4 }} />
            {timeStatus.allowed ? timeStatus.timeLeft : timeStatus.timeLeft}
          </div>
        </div>
      </div>

      {/* Time Block Warning */}
      {!timeStatus.allowed && (
        <div style={{
          background: 'var(--danger-50)', border: '1px solid var(--danger-200)',
          borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex',
          alignItems: 'center', gap: 12, fontSize: '0.85rem', color: 'var(--danger-700)'
        }}>
          <AlertTriangle size={20} />
          <div>
            <strong>Chittha Window Closed</strong><br />
            {timeStatus.reason}
          </div>
        </div>
      )}

      {/* Date + Status Bar */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label className="form-label" style={{ margin: 0 }}>Date:</label>
            <input type="date" className="form-input" value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ maxWidth: 180 }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
              Personnel: <strong>{personnel.length}</strong> | Assigned: <strong>{assignedIds.size}</strong> | Remaining: <strong>{unallocatedPersonnel.length}</strong>
            </span>

            {!chittha && timeStatus.allowed && (
              <button className="btn btn-primary" onClick={createChittha} disabled={saving}>
                <Plus size={16} /> Create Today's Chittha
              </button>
            )}

            {chittha && chittha.status === 'Draft' && timeStatus.allowed && (
              <button className="btn btn-success" onClick={submitChittha} disabled={saving}>
                <Send size={16} /> Submit Chittha
              </button>
            )}

            {chittha && (
              <span className={`badge ${
                chittha.status === 'Draft' ? 'badge-warning' :
                chittha.status === 'Submitted' ? 'badge-info' :
                chittha.status === 'Approved' ? 'badge-success' : 'badge-neutral'
              }`} style={{ padding: '6px 12px' }}>
                {chittha.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* No Chittha */}
      {loading ? (
        <div className="empty-state">
          <div className="spinner spinner-lg" style={{ margin: '0 auto' }}></div>
          <p>Loading chittha...</p>
        </div>
      ) : !chittha ? (
        <div className="panel">
          <div className="empty-state" style={{ padding: 40 }}>
            <ClipboardList className="icon" />
            <h4>No chittha for {selectedDate}</h4>
            <p>{timeStatus.allowed
              ? 'Click "Create Today\'s Chittha" to start assigning duties.'
              : timeStatus.reason
            }</p>
          </div>
        </div>
      ) : (
        /* ─── Section Cards ─── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CHITTHA_SECTIONS.map(section => {
            const sectionData = sectionAssignments[section.key] || [];
            const isExpanded = expandedSections[section.key] ?? (sectionData.length > 0);
            const isUnallocated = section.key === 'unallocated';

            return (
              <div className="panel" key={section.key} style={{ marginBottom: 0 }}>
                <div
                  className="panel-header"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSection(section.key)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <h3 style={{ fontSize: '0.9rem', margin: 0 }}>
                      {section.label}
                      {section.conditionalLabel && (
                        <span style={{ fontWeight: 400, color: 'var(--gray-400)', marginLeft: 6, fontSize: '0.75rem' }}>
                          {section.conditionalLabel}
                        </span>
                      )}
                    </h3>
                    <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                      {isUnallocated ? unallocatedPersonnel.length : sectionData.length}
                    </span>
                  </div>
                  {!isReadonly && !isUnallocated && (
                    <button className="btn btn-ghost btn-sm"
                      onClick={(e) => { e.stopPropagation(); openAssignModal(section.key); }}>
                      <UserPlus size={14} /> Assign
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div>
                    {isUnallocated ? (
                      /* Unallocated: show remaining personnel */
                      unallocatedPersonnel.length === 0 ? (
                        <div style={{ padding: 16, textAlign: 'center', color: 'var(--success-500)', fontSize: '0.85rem' }}>
                          <Check size={16} style={{ marginRight: 4 }} /> All personnel allocated
                        </div>
                      ) : (
                        <div className="table-container">
                          <table className="data-table" style={{ fontSize: '0.8rem' }}>
                            <thead>
                              <tr>
                                <th>S.No</th><th>Belt No.</th><th>Name</th><th>Rank</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unallocatedPersonnel.map((p, idx) => (
                                <tr key={p.id}>
                                  <td>{idx + 1}</td>
                                  <td style={{ fontWeight: 600 }}>{p.beltNumber || '—'}</td>
                                  <td>{p.fullName || '—'}</td>
                                  <td><span className="badge badge-primary">{p.rank || '—'}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : sectionData.length === 0 ? (
                      <div style={{ padding: 16, textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.85rem' }}>
                        No personnel assigned to this section
                      </div>
                    ) : (
                      <div className="table-container">
                        <table className="data-table" style={{ fontSize: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>S.No</th><th>Belt No.</th><th>Name</th><th>Rank</th>
                              <th>Duty</th><th>Location</th><th>Remark</th>
                              {!isReadonly && <th style={{ width: 50 }}></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {sectionData.map((a, idx) => (
                              <tr key={a.id}>
                                <td>{idx + 1}</td>
                                <td style={{ fontWeight: 600 }}>{a.personnelBelt || '—'}</td>
                                <td>{a.personnelName || '—'}</td>
                                <td><span className="badge badge-primary">{a.personnelRank || '—'}</span></td>
                                <td>{a.dutyType || '—'}</td>
                                <td>{a.dutyLocation || '—'}</td>
                                <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {a.remarkText || '—'}
                                </td>
                                {!isReadonly && (
                                  <td>
                                    {a.isLockedByOSI ? (
                                      <Lock size={14} color="var(--gray-400)" title="Locked by OSI" />
                                    ) : (
                                      <button className="btn btn-ghost btn-icon btn-sm"
                                        onClick={() => removeAssignment(a.id)}
                                        style={{ color: 'var(--danger-500)' }}>
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Assignment Modal ─── */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3>Assign Personnel — {CHITTHA_SECTIONS.find(s => s.key === assignSection)?.label}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAssignModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {/* Duty details */}
              <div className="form-row" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Duty Type</label>
                  <select className="form-select" value={assignDutyType} onChange={(e) => setAssignDutyType(e.target.value)}>
                    <option value="">Select Duty</option>
                    {DUTY_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input className="form-input" value={assignLocation} onChange={(e) => setAssignLocation(e.target.value)}
                    placeholder="e.g. Main Gate, Beat 3" />
                </div>
                <div className="form-group">
                  <label className="form-label">Remark</label>
                  <input className="form-input" value={assignRemark} onChange={(e) => setAssignRemark(e.target.value)}
                    placeholder="Optional" />
                </div>
              </div>

              {/* Personnel search + selection */}
              <div className="search-input-wrapper" style={{ marginBottom: 12 }}>
                <Search className="search-icon" size={18} />
                <input
                  type="text"
                  placeholder="Search available personnel..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                />
              </div>

              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                <table className="data-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input type="checkbox"
                          checked={selectedPersonnel.length === availablePersonnel.length && availablePersonnel.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPersonnel(availablePersonnel.map(p => p.id));
                            } else {
                              setSelectedPersonnel([]);
                            }
                          }}
                        />
                      </th>
                      <th>Belt No.</th><th>Name</th><th>Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availablePersonnel.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', color: 'var(--gray-400)' }}>
                          No available personnel
                        </td>
                      </tr>
                    ) : availablePersonnel.map(p => (
                      <tr key={p.id} style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedPersonnel(prev =>
                            prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                          );
                        }}>
                        <td>
                          <input type="checkbox" checked={selectedPersonnel.includes(p.id)} readOnly />
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.beltNumber || '—'}</td>
                        <td>{p.fullName || '—'}</td>
                        <td><span className="badge badge-primary">{p.rank || '—'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedPersonnel.length > 0 && (
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--primary-500)' }}>
                  {selectedPersonnel.length} personnel selected
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveAssignments} disabled={saving || selectedPersonnel.length === 0}>
                {saving ? 'Assigning...' : <><UserPlus size={16} /> Assign {selectedPersonnel.length} Personnel</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
