import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Plus, Trash2, X, ClipboardList, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';

const DEFAULT_HEADS = [
  { id: 'head_police', headName: 'Police Official', total: 0, absent: 0, leave: 0, present: 0 },
  { id: 'head_spo', headName: 'SPO', total: 0, absent: 0, leave: 0, present: 0 },
  { id: 'head_hgh', headName: 'HGH', total: 0, absent: 0, leave: 0, present: 0 },
  { id: 'head_hkrn', headName: 'HKRN', total: 0, absent: 0, leave: 0, present: 0 },
  { id: 'head_groupd', headName: 'Group-D (P/Temp)', total: 0, absent: 0, leave: 0, present: 0 },
];

const DEFAULT_SECTIONS = [
  { id: 'sec_sho', title: '1. SHO', officers: [] },
  { id: 'sec_investigation', title: '2. Investigation Staff', officers: [] },
  { id: 'sec_mhc', title: '3. MHC Staff', officers: [] },
  { id: 'sec_mm', title: '4. MM Staff', officers: [] },
  { id: 'sec_sho_mobile', title: '5. SHO Mobile', officers: [] },
  { id: 'sec_erv', title: '6. ERV (Emergency Response)', officers: [] },
  { id: 'sec_rider', title: '7. Rider / Patrol', officers: [] },
  { id: 'sec_general_duty', title: '8. General Duty', officers: [] },
  { id: 'sec_groupd_staff', title: '9. Group-D Staff', officers: [] },
  { id: 'sec_leave_rest', title: '10. Leave / Weekly Rest', officers: [] },
  { id: 'sec_unallocated', title: '11. Unallocated', officers: [] },
];

export default function ChitthaEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isDistrictAdmin, isStateAdmin, isUnitAdmin } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [units, setUnits] = useState([]);
  const [allUnitPersonnel, setAllUnitPersonnel] = useState([]); // Full personnel list for selected unit

  // Form State
  const [formData, setFormData] = useState({
    unitId: user?.unitId || '',
    unitName: user?.unitName || '',
    chitthaDate: new Date().toISOString().split('T')[0],
    dateLabel: '',
    status: 'Draft',
  });

  const [headSummary, setHeadSummary] = useState(DEFAULT_HEADS);
  const [sections, setSections] = useState(DEFAULT_SECTIONS);

  // Add-category dialog state
  const [showAddHead, setShowAddHead] = useState(false);
  const [newHeadName, setNewHeadName] = useState('');

  // Officer picker state (inline, not modal)
  const [pickerSectionId, setPickerSectionId] = useState(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // ---- Data Loading ----

  useEffect(() => {
    fetchUnits();
    if (id) fetchChittha();
  }, [id]);

  // When unitId changes (new chittha), fetch that unit's personnel
  useEffect(() => {
    if (formData.unitId && !id) {
      fetchUnitPersonnel(formData.unitId);
    }
  }, [formData.unitId]);

  async function fetchUnits() {
    try {
      const params = { assigned_module: 'chittha' };

      if (isUnitAdmin && user?.unitId) {
        params.unit_id = user.unitId;
      } else if (isDistrictAdmin && user?.districtId) {
        params.district_id = user.districtId;
      } else if (isStateAdmin && user?.stateId) {
        params.state_id = user.stateId;
      }

      const data = await api.hierarchy.units(params);
      
      setUnits((data||[]).map(u => ({
        id: u.id,
        unitName: u.name,
        ...u
      })));
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
    }
  }

  async function fetchUnitPersonnel(unitId) {
    try {
      const personnel = await api.personnel.list({ unit_id: unitId, service_status: 'Active' });

      const mappedPersonnel = (personnel||[]).map(p => ({
        id: p.id,
        fullName: p.full_name,
        rank: p.rank,
        beltNumber: p.belt_number,
        mobileNumber: p.mobile_number,
        ...p
      }));

      setAllUnitPersonnel(mappedPersonnel);
      // Auto-populate section 11 (Unallocated)
      const officerObjs = mappedPersonnel.map(p => toOfficerObj(p));
      setSections(prev => prev.map(s =>
        s.id === 'sec_unallocated' ? { ...s, officers: officerObjs } : { ...s, officers: [] }
      ));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to fetch unit personnel', err);
    }
  }

  async function fetchChittha() {
    try {
      const chitthaData = await api.chitthas.get(id);

      setFormData({
        unitId: chitthaData.unit_id,
        unitName: chitthaData.unit_name || '',
        chitthaDate: chitthaData.chittha_date,
        dateLabel: chitthaData.date_label || '',
        status: chitthaData.status,
      });

      if (chitthaData.head_summary) setHeadSummary(chitthaData.head_summary);

      // Map back to sections format
      if (chitthaData.section_configs) {
        const reconstructed = chitthaData.section_configs.map(s => ({
          ...s,
          officers: (chitthaData.assignments || [])
            .filter(a => a.section_name === s.id) // UI uses id as sectionName in NaukariChittha, but here it might be different. Let's check sections.
            .map(a => ({
              personnelId: a.personnel_id,
              personnelName: a.full_name || a.personnel_name_at_time, // Or fetch from personnel
              personnelRank: a.rank || a.personnel_rank_at_time,
              personnelBelt: a.belt_number || a.personnel_belt_at_time,
              dutyPoint: a.duty_location || a.duty_point,
              remarks: a.remark_text || a.remarks,
              sectionId: a.section_name
            }))
        }));
        setSections(reconstructed);
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      toast.error('Failed to load roster');
    } finally {
      setLoading(false);
    }
  }

  // ---- Helper: Personnel -> Officer Object ----
  function toOfficerObj(p) {
    return {
      personnelId: p.id || p.personnelId,
      personnelName: p.fullName,
      personnelRank: p.rank,
      personnelBelt: p.beltNumber || '',
      personnelMobile: p.mobileNumber || '',
      dutyPoint: '',
      remarks: '',
    };
  }

  // ---- Head Summary Logic ----

  const handleHeadChange = (headId, field, value) => {
    const val = parseInt(value) || 0;
    setHeadSummary(prev => prev.map(h => {
      if (h.id === headId) {
        const updated = { ...h, [field]: val };
        if (field !== 'present') updated.present = updated.total - updated.absent - updated.leave;
        return updated;
      }
      return h;
    }));
  };

  const confirmAddHead = () => {
    const name = newHeadName.trim();
    if (!name) { toast.warning('Category name cannot be empty.'); return; }
    if (headSummary.some(h => h.headName.toLowerCase() === name.toLowerCase())) {
      toast.warning('A category with this name already exists.'); return;
    }
    setHeadSummary([...headSummary, { id: `head_${Date.now()}`, headName: name, total: 0, absent: 0, leave: 0, present: 0 }]);
    setNewHeadName('');
    setShowAddHead(false);
  };

  const deleteHeadRow = (headId, headName) => {
    if (!window.confirm(`Are you sure you want to delete the entry "${headName}"?`)) return;
    setHeadSummary(headSummary.filter(h => h.id !== headId));
  };

  // ---- Section & Officer Logic ----

  // All assigned personnelIds across all sections (except unallocated)
  const assignedPersonnelIds = useMemo(() => {
    const ids = new Set();
    sections.forEach(s => {
      if (s.id !== 'sec_unallocated') {
        s.officers.forEach(o => ids.add(o.personnelId));
      }
    });
    return ids;
  }, [sections]);

  // Available officers for the picker = unit personnel NOT yet assigned anywhere (except unallocated)
  const availableOfficers = useMemo(() => {
    return allUnitPersonnel.filter(p => !assignedPersonnelIds.has(p.id || p.personnelId));
  }, [allUnitPersonnel, assignedPersonnelIds]);

  const filteredPickerOfficers = useMemo(() => {
    if (!pickerSearch) return availableOfficers;
    const term = pickerSearch.toLowerCase();
    return availableOfficers.filter(p =>
      (p.fullName || '').toLowerCase().includes(term) ||
      (p.beltNumber || '').toLowerCase().includes(term) ||
      (p.rank || '').toLowerCase().includes(term)
    );
  }, [availableOfficers, pickerSearch]);

  const handleAddOfficerToSection = (secId, officer) => {
    const officerObj = toOfficerObj(officer);
    setSections(prev => prev.map(s => {
      if (s.id === secId) {
        return { ...s, officers: [...s.officers, officerObj] };
      }
      // Remove from unallocated when added to another section
      if (s.id === 'sec_unallocated') {
        return { ...s, officers: s.officers.filter(o => o.personnelId !== officerObj.personnelId) };
      }
      return s;
    }));
    setPickerSearch('');
  };

  const removeOfficer = (secId, personnelId) => {
    if (!window.confirm('Are you sure you want to remove this officer from the duty section?')) return;
    // Find the officer object to return to unallocated
    const section = sections.find(s => s.id === secId);
    const officerToReturn = section?.officers.find(o => o.personnelId === personnelId);

    setSections(prev => prev.map(s => {
      if (s.id === secId) {
        return { ...s, officers: s.officers.filter(o => o.personnelId !== personnelId) };
      }
      // Return officer to unallocated only if it came from this unit's pool
      if (s.id === 'sec_unallocated' && officerToReturn && secId !== 'sec_unallocated') {
        // Only add back if it's in the original unit personnel list
        const isUnitPersonnel = allUnitPersonnel.some(p => (p.id || p.personnelId) === personnelId);
        if (isUnitPersonnel && !s.officers.some(o => o.personnelId === personnelId)) {
          return { ...s, officers: [...s.officers, { ...officerToReturn, dutyPoint: '', remarks: '' }] };
        }
      }
      return s;
    }));
  };

  const updateSectionTitle = (secId, title) => {
    setSections(sections.map(s => s.id === secId ? { ...s, title } : s));
  };

  const addSection = () => {
    const title = window.prompt('Enter section name:');
    if (!title?.trim()) return;
    setSections([...sections, { id: `sec_${Date.now()}`, title: title.trim(), officers: [] }]);
  };

  const deleteSection = (secId) => {
    const section = sections.find(s => s.id === secId);
    if (!window.confirm(`Delete section "${section?.title}" and all its assignments?`)) return;
    setSections(sections.filter(s => s.id !== secId));
  };

  const updateOfficerField = (secId, personnelId, field, value) => {
    setSections(prev => prev.map(s => {
      if (s.id !== secId) return s;
      return { ...s, officers: s.officers.map(o => o.personnelId === personnelId ? { ...o, [field]: value } : o) };
    }));
  };

  // ---- Save ----

  async function handleSave() {
    if (!formData.unitId) { toast.warning('Please select a Unit before saving.'); return; }
    if (!window.confirm('Save all changes to this roster?')) return;

    try {
      setSaving(true);
      
      const payload = {
        unit_id: formData.unitId,
        district_id: user?.districtId || null,
        chittha_date: formData.chitthaDate,
        date_label: formData.dateLabel || '',
        status: formData.status,
        head_summary: headSummary,
        section_configs: sections.map(s => ({ id: s.id, title: s.title })),
        updated_at: new Date().toISOString(),
      };

      let chitthaId = id;

      if (!id) {
        payload.state_id = user?.stateId || null;
        payload.range_id = user?.rangeId || null;
        
        const newChittha = await api.chitthas.create(payload);
        chitthaId = newChittha.id;
      }

      // Prepare assignments mapping for update
      const assignmentPayload = [];
      for (const section of sections) {
        for (const off of section.officers) {
          assignmentPayload.push({
            personnel_id: off.personnelId,
            section_name: section.id,
            duty_type: 'General', // Default
            duty_location: off.dutyPoint || '',
            remark_text: off.remarks || '',
            is_vip_duty: false
          });
        }
      }

      payload.assignments = assignmentPayload;

      await api.chitthas.update(chitthaId, payload);

      toast.success('Roster saved successfully!');
      navigate('/chitthas');
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      toast.error('Failed to save roster');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="spinner-container"><div className="spinner"></div></div>;

  return (
    <div className="chittha-editor-page">
      {/* Sticky Header */}
      <div className="page-header" style={{ position: 'sticky', top: 0, zIndex: 60, background: 'var(--gray-50)', padding: '12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/chitthas')}><ArrowLeft size={20} /></button>
          <h2 style={{ fontSize: '1.25rem' }}>{id ? 'Edit Chittha' : 'New Chittha'}</h2>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={18} /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="chittha-compact">
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 100 }}>

          {/* Chittha Details */}
          <div className="panel">
            <div className="panel-header"><h3><ClipboardList size={18} /> Chittha Details</h3></div>
            <div className="panel-body grid-3">
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select
                  className="form-select"
                  value={formData.unitId}
                  onChange={(e) => {
                    const unit = units.find(u => u.id === e.target.value);
                    setFormData({ ...formData, unitId: e.target.value, unitName: unit?.unitName || '' });
                  }}
                >
                  <option value="">Select Unit</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.unitName}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input type="date" className="form-input" value={formData.chitthaDate}
                  onChange={(e) => setFormData({ ...formData, chitthaDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Date Label (Optional)</label>
                <input type="text" className="form-input" placeholder="e.g. 8 AM to 8 AM" value={formData.dateLabel}
                  onChange={(e) => setFormData({ ...formData, dateLabel: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Head-wise Summary */}
          <div className="panel summary-panel">
            <div className="compact-section-header summary-header">Head-wise Summary</div>
            <div className="panel-header" style={{ padding: '4px 12px', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Strength Overview</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddHead(true)} style={{ padding: '0 4px' }}>
                <Plus size={12} /> Add
              </button>
            </div>

            {/* Inline Add Category Dialog */}
            {showAddHead && (
              <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  autoFocus
                  className="form-input"
                  style={{ height: 28, fontSize: '0.8rem', maxWidth: 220 }}
                  placeholder="Enter category name..."
                  value={newHeadName}
                  onChange={e => setNewHeadName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmAddHead(); if (e.key === 'Escape') setShowAddHead(false); }}
                />
                <button className="btn btn-primary btn-sm" style={{ padding: '2px 10px', height: 28 }} onClick={confirmAddHead}>Save</button>
                <button className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', height: 28 }} onClick={() => { setShowAddHead(false); setNewHeadName(''); }}>Cancel</button>
              </div>
            )}

            <div className="table-container">
              <table className="data-table summary-table">
                <thead>
                  <tr>
                    <th>HEAD CATEGORY</th>
                    <th style={{ width: 90 }}>TOTAL</th>
                    <th style={{ width: 90 }}>ABSENT</th>
                    <th style={{ width: 90 }}>LEAVE</th>
                    <th style={{ width: 90 }}>PRESENT</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {headSummary.map((head) => (
                    <tr key={head.id}>
                      <td>
                        <input type="text" className="inline-input bold" value={head.headName}
                          onChange={(e) => setHeadSummary(prev => prev.map(h => h.id === head.id ? { ...h, headName: e.target.value } : h))} />
                      </td>
                      <td><input type="number" className="inline-input center" value={head.total} onChange={(e) => handleHeadChange(head.id, 'total', e.target.value)} /></td>
                      <td><input type="number" className="inline-input center" value={head.absent} onChange={(e) => handleHeadChange(head.id, 'absent', e.target.value)} /></td>
                      <td><input type="number" className="inline-input center" value={head.leave} onChange={(e) => handleHeadChange(head.id, 'leave', e.target.value)} /></td>
                      <td className="present-cell">{head.present}</td>
                      <td>
                        <button className="btn-icon-text delete" title="Delete entry" onClick={() => deleteHeadRow(head.id, head.headName)}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Duty Sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sections.map(section => (
              <div key={section.id} className="panel duty-section">
                <div className="compact-section-header">
                  <input
                    type="text"
                    className="section-title-input"
                    style={{ textAlign: 'left', width: '100%', padding: 0 }}
                    value={section.title}
                    onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                  />
                  {/* Don't allow deleting the default fixed sections */}
                  {!DEFAULT_SECTIONS.some(d => d.id === section.id) && (
                    <button
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
                      onClick={() => deleteSection(section.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>SN</th>
                        <th style={{ width: 80 }}>Rank</th>
                        <th style={{ width: 160 }}>Name</th>
                        <th style={{ width: 90 }}>Belt No.</th>
                        <th>Duty Point</th>
                        <th>Remarks</th>
                        <th style={{ width: 110 }}>Mobile</th>
                        <th style={{ width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.officers.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', color: '#aaa', padding: '12px', fontSize: '0.75rem' }}>
                            {section.id === 'sec_unallocated' ? 'Select a unit to auto-populate officers.' : 'No officers assigned — use picker below.'}
                          </td>
                        </tr>
                      ) : section.officers.map((off, idx) => (
                        <tr key={off.personnelId}>
                          <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ textAlign: 'center' }}><span className="badge-compact">{off.personnelRank}</span></td>
                          <td style={{ fontWeight: 600 }}>{off.personnelName}</td>
                          <td style={{ textAlign: 'center' }}>{off.personnelBelt}</td>
                          <td>
                            <input className="inline-input" style={{ height: 24 }} placeholder="Duty point..."
                              value={off.dutyPoint || ''}
                              onChange={(e) => updateOfficerField(section.id, off.personnelId, 'dutyPoint', e.target.value)} />
                          </td>
                          <td>
                            <input className="inline-input" style={{ height: 24 }} placeholder="Remarks..."
                              value={off.remarks || ''}
                              onChange={(e) => updateOfficerField(section.id, off.personnelId, 'remarks', e.target.value)} />
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.75rem' }}>{off.personnelMobile || '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button style={{ color: 'var(--danger-500)', background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() => removeOfficer(section.id, off.personnelId)}>
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Inline Officer Picker (not shown for unallocated) */}
                {section.id !== 'sec_unallocated' && (
                  <div className="panel-footer" style={{ background: 'var(--gray-50)', padding: '4px 8px', justifyContent: 'flex-start' }}>
                    {pickerSectionId === section.id ? (
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Search size={14} style={{ color: '#888', flexShrink: 0 }} />
                          <input
                            autoFocus
                            className="form-input"
                            style={{ height: 28, fontSize: '0.8rem', flex: 1 }}
                            placeholder="Search officer by name, belt, rank..."
                            value={pickerSearch}
                            onChange={e => setPickerSearch(e.target.value)}
                          />
                          <button className="btn btn-ghost btn-sm" onClick={() => { setPickerSectionId(null); setPickerSearch(''); }}>
                            <X size={14} />
                          </button>
                        </div>
                        {filteredPickerOfficers.length === 0 ? (
                          <div style={{ fontSize: '0.75rem', color: '#aaa', padding: '4px 8px' }}>
                            {allUnitPersonnel.length === 0 ? 'No unit selected or no personnel found.' : 'All officers are already assigned.'}
                          </div>
                        ) : (
                          <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 4, background: 'white' }}>
                            {filteredPickerOfficers.map(p => (
                              <div
                                key={p.id}
                                onClick={() => handleAddOfficerToSection(section.id, p)}
                                style={{ padding: '5px 10px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8rem', borderBottom: '1px solid var(--gray-100)' }}
                                onMouseOver={e => e.currentTarget.style.background = 'var(--gray-50)'}
                                onMouseOut={e => e.currentTarget.style.background = 'white'}
                              >
                                <span className="badge-compact" style={{ fontSize: '0.65rem' }}>{p.rank}</span>
                                <strong>{p.fullName}</strong>
                                {p.beltNumber && <span style={{ color: '#888' }}>({p.beltNumber})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.7rem' }}
                        onClick={() => { setPickerSectionId(section.id); setPickerSearch(''); }}>
                        <Plus size={12} /> Add Officer
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add Custom Section */}
          <div style={{ background: 'white', padding: '10px 16px', borderRadius: 8, border: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={addSection}>
              <Plus size={14} /> Add Custom Section
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 768px) { .grid-3 { grid-template-columns: 1fr; } }
        .summary-table th { background: var(--navy); color: white; border: none; }
        .inline-input { width: 100%; border: 1px solid transparent; background: none; padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; transition: border-color 0.2s; }
        .inline-input:focus { background: white; border-color: var(--blue-active); outline: none; }
        .inline-input.bold { font-weight: 600; color: var(--navy); }
        .inline-input.center { text-align: center; }
        .present-cell { font-weight: 700; text-align: center; color: var(--success-600); background: var(--success-50); }
        .section-title-input { background: none; border: 1px solid transparent; color: white; font-size: 0.85rem; font-weight: 700; border-radius: 4px; flex: 1; }
        .section-title-input:focus { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); outline: none; }
        .btn-icon-text.delete { color: var(--danger-600); background: none; border: none; cursor: pointer; }
        .badge-compact { display: inline-block; font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; background: var(--navy); color: white; white-space: nowrap; }
      `}</style>
    </div>
  );
}
