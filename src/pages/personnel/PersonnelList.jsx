import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import { Search, Plus, Eye, Edit, Trash2, Copy, Download,
  Filter, ChevronLeft, ChevronRight, Users
} from 'lucide-react';

const PAGE_SIZE = 25;

export default function PersonnelList() {
  const { user, isSuperAdmin, isStateAdmin, isRangeAdmin, isDistrictAdmin, isUnitAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dynamicFilters, setDynamicFilters] = useState({});
  // statusFilter is special as it's a core field but usually mapped to a master field too.
  // We'll keep it as is if it matches a hardcoded status, but eventually it should be dynamic too.
  const [statusFilter, setStatusFilter] = useState('');
  
  // Hierarchy Filters
  const [hierFilters, setHierFilters] = useState({
    stateId: '', rangeId: '', districtId: '', unitType: '', unitId: '', subUnitId: ''
  });
  const [states, setStates] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [unitCategories, setUnitCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [subUnits, setSubUnits] = useState([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteModal, setDeleteModal] = useState(null);
  const [masterFields, setMasterFields] = useState([]);
  const [allMasterData, setAllMasterData] = useState([]);

  useEffect(() => {
    loadCategories();
    loadHierarchyCounts();
    loadPersonnel();
  }, [user]);

  useEffect(() => {
    if (!user?.stateId) return;
    async function loadMasterConfig() {
      try {
        const fields = await api.admin.fieldTypes(user.stateId);
        setMasterFields((fields||[]).map(f => ({
          id: f.id, fieldName: f.field_name,
          displayName: f.display_name, personnelFieldName: f.personnel_field_name,
        })));
        const values = await api.admin.dropdownValues({ stateId: user.stateId });
        setAllMasterData((values||[]).map(v => ({
          id: v.id, value: v.value,
          fieldType: v.field_name || 'unknown',
          displayOrder: v.display_order, accessLevel: v.access_level,
        })));
      } catch (err) {
        if (import.meta.env.DEV) console.error('Filter master config error:', err);
      }
    }
    loadMasterConfig();
  }, [user]);

  const hasAccess = (record) => {
    const level = record.accessLevel || 'all';
    if (level === 'all') return true;
    if (level === 'super_admin_only') return isSuperAdmin;
    if (level === 'state_admin_only') return isStateAdmin;
    if (level === 'range_admin_only') return isRangeAdmin;
    if (level === 'district_admin_only') return isDistrictAdmin;
    if (level === 'unit_admin_only') return isUnitAdmin;
    if (level === 'state_admin_plus') return isStateAdmin || isSuperAdmin;
    if (level === 'range_admin_plus') return isRangeAdmin || isStateAdmin || isSuperAdmin;
    if (level === 'district_admin_plus') return isDistrictAdmin || isRangeAdmin || isStateAdmin || isSuperAdmin;
    if (level === 'unit_admin_plus') return isUnitAdmin || isDistrictAdmin || isRangeAdmin || isStateAdmin || isSuperAdmin;
    return true;
  };

  const getDropdownValues = (fieldType) => {
    return allMasterData
      .filter(r => r.fieldType === fieldType && hasAccess(r))
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
  };

  async function handleResetPersonnel() {
    if (!isSuperAdmin) return;
    const confirm = window.confirm('DANGER: This will delete ALL personnel records. Proceed?');
    if (!confirm) return;
    try {
      setLoading(true);
      // Soft delete all via API (loop — no bulk delete endpoint needed)
      const all = await api.personnel.list();
      for (const p of (all||[])) { await api.personnel.remove(p.id); }
      toast.success('Records reset initiated.');
      loadPersonnel();
    } catch (err) {
      toast.error('Failed to reset personnel data.');
    } finally { setLoading(false); }
  }

  async function loadCategories() {
    try {
      const data = await api.hierarchy.unitCategories();
      if (data) setUnitCategories(data.map(d => d.name));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to load categories:', err);
    }
  }

  async function loadHierarchyCounts() {
    if (isSuperAdmin) {
      const data = await api.hierarchy.states();
      if (data) setStates(data.map(d => ({ id: d.id, stateName: d.name })));
    } else {
      if (user?.stateId) {
        setHierFilters(p => ({ ...p, stateId: user.stateId }));
        const sData = await api.hierarchy.states();
        const myState = (sData||[]).find(s => s.id === user.stateId);
        if (myState) setStates([{ id: myState.id, stateName: myState.name }]);
        if (isStateAdmin) loadRanges(user.stateId);
        if (user?.rangeId) {
          setHierFilters(p => ({ ...p, rangeId: user.rangeId }));
          if (isRangeAdmin) loadDistricts(user.rangeId);
        }
        if (user?.districtId) setHierFilters(p => ({ ...p, districtId: user.districtId }));
        if (user?.unitId) {
          setHierFilters(p => ({ ...p, unitId: user.unitId }));
          if (isUnitAdmin) loadSubUnits(user.unitId, user.districtId);
        }
      }
    }
  }

  // Consolidation of hierarchy loading logic to avoid cascading effects (M10)
  async function handleHierChange(field, value) {
    const nextFilters = { ...hierFilters, [field]: value };
    
    // Clear downstream filters
    if (field === 'stateId') {
      nextFilters.rangeId = ''; nextFilters.districtId = ''; nextFilters.unitType = ''; nextFilters.unitId = ''; nextFilters.subUnitId = '';
      if (value) {
        loadRanges(value);
        loadDistricts(null, value); // Fallback: load districts by stateId immediately
      } else {
        setRanges([]);
        setDistricts([]);
      }
      setUnits([]); setSubUnits([]);
    } else if (field === 'rangeId') {
      nextFilters.districtId = ''; nextFilters.unitType = ''; nextFilters.unitId = ''; nextFilters.subUnitId = '';
      if (value) {
        loadDistricts(value, null);
      } else if (nextFilters.stateId) {
        loadDistricts(null, nextFilters.stateId); // Fallback if range is cleared
      } else {
        setDistricts([]);
      }
      setUnits([]); setSubUnits([]);
    } else if (field === 'districtId') {
      nextFilters.unitType = ''; nextFilters.unitId = ''; nextFilters.subUnitId = '';
      setUnits([]);
      setSubUnits([]);
    } else if (field === 'unitType') {
      nextFilters.unitId = ''; nextFilters.subUnitId = '';
      if (nextFilters.districtId && value) {
        loadUnits(nextFilters.districtId, value);
      } else {
        setUnits([]);
      }
      setSubUnits([]);
    } else if (field === 'unitId') {
      nextFilters.subUnitId = '';
      if (value && nextFilters.districtId) {
        loadSubUnits(value, nextFilters.districtId);
      } else {
        setSubUnits([]);
      }
    }
    
    setHierFilters(nextFilters);
  }

  async function loadRanges(stateId) {
    const data = await api.hierarchy.ranges(stateId);
    if (data) setRanges(data.map(d => ({ id: d.id, rangeName: d.name })));
  }

  async function loadDistricts(rangeId, stateId) {
    const params = {};
    if (rangeId) params.rangeId = rangeId;
    else if (stateId) params.stateId = stateId;
    
    if (!params.rangeId && !params.stateId) return;

    const data = await api.hierarchy.districts(params);
    if (data) setDistricts(data.map(d => ({ id: d.id, districtName: d.name })));
  }

  async function loadUnits(districtId, unitType) {
    if (!districtId || !unitType) return;
    const data = await api.hierarchy.units({ districtId, unitType });
    if (data) setUnits(data.map(d => ({ id: d.id, unitName: d.name })));
  }

  async function loadSubUnits(unitId, districtId) {
    if (!unitId || !districtId) return;
    const data = await api.hierarchy.subUnits({ unitId, districtId });
    if (data) setSubUnits(data.map(d => ({ id: d.id, subUnitName: d.name })));
  }

  async function loadPersonnel() {
    try {
      setLoading(true);
      const data = await api.personnel.list();
      const mappedData = (data||[]).map(d => ({
        id: d.id,
        beltNumber: d.belt_number,
        payCode: d.pay_code,
        fullName: d.full_name,
        fatherName: d.father_name,
        rank: d.rank,
        mobileNumber: d.mobile_number,
        psDutyType: d.ps_duty_type,
        homeDistrictPS: d.home_district_ps,
        serviceStatus: d.service_status,
        stateId: d.state_id,
        rangeId: d.range_id,
        districtId: d.district_id,
        unitType: d.unit_type,
        currentUnitId: d.current_unit_id,
        currentSubUnitId: d.current_sub_unit_id,
        isDeleted: d.is_deleted,
      }));
      setPersonnel(mappedData);
    } catch (e) {
      if (import.meta.env.DEV) console.error('Personnel load error:', e);
      toast.error('Failed to load personnel records.');
    } finally { setLoading(false); }
  }

  // Client-side search and filter
  const filteredPersonnel = useMemo(() => {
    return personnel.filter(p => {
      // Status filter
      if (statusFilter && p.serviceStatus !== statusFilter) return false;

      // Dynamic Master Filters
      for (const field of masterFields) {
        const key = field.personnelFieldName || field.fieldName;
        const filterVal = dynamicFilters[key];
        if (filterVal && p[key] !== filterVal) return false;
      }

      // Hierarchy Filters
      if (hierFilters.stateId && p.stateId !== hierFilters.stateId) return false;
      if (hierFilters.rangeId && p.rangeId !== hierFilters.rangeId) return false;
      if (hierFilters.districtId && p.districtId !== hierFilters.districtId) return false;
      if (hierFilters.unitType && p.unitType !== hierFilters.unitType) return false;
      if (hierFilters.unitId && (p.currentUnitId !== hierFilters.unitId)) return false;
      if (hierFilters.subUnitId && p.currentSubUnitId !== hierFilters.subUnitId) return false;

      // Soft-Delete Filter (Client-side secondary safety)
      if (p.isDeleted === true) return false;

      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match =
          (p.fullName || '').toLowerCase().includes(term) ||
          (p.beltNumber || '').toLowerCase().includes(term) ||
          (p.payCode || '').toLowerCase().includes(term) ||
          (p.mobileNumber || '').toLowerCase().includes(term) ||
          (p.rank || '').toLowerCase().includes(term);
        if (!match) return false;
      }

      return true;
    });
  }, [personnel, searchTerm, dynamicFilters, statusFilter, hierFilters, masterFields]);

  // Pagination
  const totalPages = Math.ceil(filteredPersonnel.length / PAGE_SIZE);
  const paginatedData = filteredPersonnel.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => { setCurrentPage(1); }, [searchTerm, dynamicFilters, statusFilter]);

  // Soft-delete: mark record as deleted instead of removing
  const canDelete = isSuperAdmin || isStateAdmin || isDistrictAdmin;

  async function handleDelete(person) {
    if (!canDelete) {
      toast.error('You do not have permission to delete records.');
      return;
    }
    try {
      await api.personnel.remove(person.id);
      toast.success(`${person.fullName} has been removed.`);
      setPersonnel(prev => prev.filter(p => p.id !== person.id));
      setDeleteModal(null);
    } catch (err) {
      toast.error('Failed to delete personnel record.');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Personnel Records</h2>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/personnel/import')}>
            <Download size={16} /> Import
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/personnel/add')}>
            <Plus size={16} /> Add Personnel
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="panel" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="panel-body">
          <div className="search-filter-bar" style={{ marginBottom: '1rem' }}>
            <div className="search-input-wrapper" style={{ flexGrow: 1 }}>
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Search by Name, Belt No, Pay Code, Mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              {getDropdownValues('serviceStatus').length > 0
                ? getDropdownValues('serviceStatus').map(v => (
                    <option key={v.id} value={v.value}>{v.value}</option>
                  ))
                : ['Active', 'Retired', 'Suspended', 'Deceased'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))
              }
            </select>

            {/* Dynamic Dropdown Filters */}
            {masterFields.filter(f => f.fieldName !== 'serviceStatus').map(field => (
              <select
                key={field.id}
                className="filter-select"
                value={dynamicFilters[field.personnelFieldName || field.fieldName] || ''}
                onChange={(e) => setDynamicFilters(prev => ({
                  ...prev,
                  [field.personnelFieldName || field.fieldName]: e.target.value
                }))}
              >
                <option value="">All {field.displayName}</option>
                {getDropdownValues(field.fieldName).map(v => (
                  <option key={v.id} value={v.value}>{v.value}</option>
                ))}
              </select>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
            {/* State Selection */}
            {!isSuperAdmin ? (
              <input className="form-input form-input-sm" disabled value={user?.stateName || 'Haryana'} title="Auto-filled from your hierarchy" />
            ) : (
              <select className="form-select form-select-sm" 
                value={hierFilters.stateId} 
                onChange={e => handleHierChange('stateId', e.target.value)}>
                <option value="">All States</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.stateName}</option>)}
              </select>
            )}

            {/* Range Selection */}
            {!isSuperAdmin && !isStateAdmin ? (
              <input className="form-input form-input-sm" disabled value={user?.rangeName || 'Locked Range'} title="Auto-filled from your hierarchy" />
            ) : (
              <select className="form-select form-select-sm" 
                value={hierFilters.rangeId} disabled={!hierFilters.stateId}
                onChange={e => handleHierChange('rangeId', e.target.value)}>
                <option value="">All Ranges</option>
                {ranges.map(r => <option key={r.id} value={r.id}>{r.rangeName}</option>)}
              </select>
            )}

            {/* District Selection */}
            {!isSuperAdmin && !isStateAdmin && !isRangeAdmin ? (
              <input className="form-input form-input-sm" disabled value={user?.districtName || 'Locked District'} title="Auto-filled from your hierarchy" />
            ) : (
              <select className="form-select form-select-sm" 
                value={hierFilters.districtId} disabled={!hierFilters.rangeId && !hierFilters.stateId}
                onChange={e => handleHierChange('districtId', e.target.value)}>
                <option value="">All Districts</option>
                {districts.map(d => <option key={d.id} value={d.id}>{d.districtName}</option>)}
              </select>
            )}

            {/* Unit Category Selection */}
            {!isSuperAdmin && !isStateAdmin && !isRangeAdmin && !isDistrictAdmin ? (
              <input className="form-input form-input-sm" disabled value="Fixed Category" title="Auto-filled from your hierarchy" />
            ) : (
              <select className="form-select form-select-sm" 
                value={hierFilters.unitType} disabled={!hierFilters.districtId}
                onChange={e => handleHierChange('unitType', e.target.value)}>
                <option value="">All Categories</option>
                {unitCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}

            {/* Unit Selection */}
            {!isSuperAdmin && !isStateAdmin && !isRangeAdmin && !isDistrictAdmin ? (
              <input className="form-input form-input-sm" disabled value={user?.unitName || 'Locked Unit'} title="Auto-filled from your hierarchy" />
            ) : (
              <select className="form-select form-select-sm" 
                value={hierFilters.unitId} disabled={!hierFilters.districtId || !hierFilters.unitType}
                onChange={e => handleHierChange('unitId', e.target.value)}>
                <option value="">{units.length === 0 && hierFilters.unitType ? 'No units available' : 'All Units'}</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.unitName}</option>)}
              </select>
            )}

            {/* Sub-Unit Selection - Visible for all */}
            <select className="form-select form-select-sm" 
              value={hierFilters.subUnitId} disabled={!hierFilters.unitId}
              onChange={e => handleHierChange('subUnitId', e.target.value)}>
              <option value="">All Sub-Units</option>
              {subUnits.map(su => <option key={su.id} value={su.id}>{su.subUnitName}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="panel">

        <div className="table-container">
          {loading ? (
            <div className="empty-state">
              <div className="spinner spinner-lg" style={{ margin: '0 auto' }}></div>
              <p>Loading personnel records...</p>
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="empty-state">
              <Users className="icon" />
              <h4>No records found</h4>
              <p>{searchTerm ? 'Try adjusting your search or filters.' : 'Add personnel or import data to get started.'}</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Belt No.</th>
                  <th>Pay Code</th>
                  <th>Name</th>
                  <th>Father's Name</th>
                  <th>Rank</th>
                  <th>Mobile</th>
                  <th>PS Duty Type (Role 2)</th>
                  <th>Home Dist. PS</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((p, idx) => (
                  <tr key={p.id}>
                    <td>{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{p.beltNumber || '—'}</td>
                    <td>{p.payCode || '—'}</td>
                    <td>{p.fullName || '—'}</td>
                    <td>{p.fatherName || '—'}</td>
                    <td><span className="badge badge-primary">{p.rank || '—'}</span></td>
                    <td>{p.mobileNumber || '—'}</td>
                    <td>{p.psDutyType || '—'}</td>
                    <td>{p.homeDistrictPS || '—'}</td>
                    <td>
                      <span className={`badge ${
                        p.serviceStatus === 'Active' ? 'badge-success' :
                        p.serviceStatus === 'Suspended' ? 'badge-danger' :
                        'badge-neutral'
                      }`}>
                        {p.serviceStatus || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button className="btn btn-ghost btn-icon btn-sm" title="View"
                          onClick={() => navigate(`/personnel/${p.id}`)}>
                          <Eye size={15} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Edit"
                          onClick={() => navigate(`/personnel/${p.id}/edit`)}>
                          <Edit size={15} />
                        </button>
                        {canDelete && (
                          <button className="btn btn-ghost btn-icon btn-sm" title="Delete"
                            onClick={() => setDeleteModal(p)}
                            style={{ color: 'var(--danger-500)' }}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="panel-footer">
            <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredPersonnel.length)} of {filteredPersonnel.length}
            </span>
            <div className="pagination">
              <button className="pagination-btn" disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft size={16} />
              </button>
              {(() => {
                // Sliding window pagination
                let startPage = Math.max(1, currentPage - 2);
                let endPage = Math.min(totalPages, startPage + 4);
                if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
                const pages = [];
                for (let p = startPage; p <= endPage; p++) pages.push(p);
                return pages.map(page => (
                  <button key={page}
                    className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}>
                    {page}
                  </button>
                ));
              })()}
              <button className="pagination-btn" disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="modal-overlay" onClick={() => setDeleteModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteModal(null)}>
                <span style={{ fontSize: 20 }}>×</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="confirm-dialog">
                <div className="icon danger"><Trash2 size={24} /></div>
                <h4>Delete Personnel Record?</h4>
                <p>
                  Are you sure you want to delete <strong>{deleteModal.fullName}</strong> (Belt No: {deleteModal.beltNumber})?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteModal)}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
