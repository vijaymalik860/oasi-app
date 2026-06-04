import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import {
  Database, Plus, Edit, Trash2, Check, X, Search,
  ChevronDown, Tag, ToggleLeft, ToggleRight, MoreVertical,
  Layout, ChevronUp
} from 'lucide-react';

const ACCESS_LEVEL_LABELS = {
  all: 'All Roles',
  super_admin_only: 'Super Admin (Only)',
  state_admin_only: 'State Admin (Only)',
  range_admin_only: 'Range Admin (Only)',
  district_admin_only: 'District Admin (Only)',
  unit_admin_only: 'Unit Admin (Only)',
  state_admin_plus: 'State Admin & Above',
  range_admin_plus: 'Range Admin & Above',
  district_admin_plus: 'District Admin & Above',
  unit_admin_plus: 'Unit Admin & Above',
};

export default function DropdownMaster() {
  const { user, isStateAdmin, isSuperAdmin } = useAuth();
  const toast = useToast();
  const canEdit = isStateAdmin || isSuperAdmin;

  const [activeTab, setActiveTab] = useState('');
  const [masterFields, setMasterFields] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true); // Overall initial loading
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Field Type Management
  const [showFieldTypeModal, setShowFieldTypeModal] = useState(false);
  const [editingFieldType, setEditingFieldType] = useState(null); // When editing a meta-field
  const [newFieldType, setNewFieldType] = useState({ 
    displayName: '', 
    fieldName: '', 
    personnelFieldName: '', 
    helperExample: 'Value1, Value2, Value3',
    description: '' 
  });
  const [activeMenu, setActiveMenu] = useState(null); // { id: string, top: number, left: number, openUp: boolean }


  // Comma-based multi-entry
  const [bulkInput, setBulkInput] = useState('');
  const [previewTags, setPreviewTags] = useState([]);
  const [showBulkEntry, setShowBulkEntry] = useState(false);

  // Edit modal
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({ value: '', displayOrder: 0, accessLevel: 'all' });

  // Personnel Layout State
  const [personnelLayout, setPersonnelLayout] = useState([]);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutSaving, setLayoutSaving] = useState(false);

  // Default Layout Constant (Keep in sync with PersonnelForm)
  const DEFAULT_LAYOUT_MAP = [
    {
      id: 'personal',
      title: '1. Personal Details',
      fields: [ 'photo_and_name_block', 'dateOfBirth', 'gender', 'bloodGroup', 'mobileNumber', 'alternateContact', 'payCode', 'religion', 'caste', 'category', 'aadharNumber', 'pan', 'homeDistrict' ]
    },
    {
      id: 'education',
      title: '2. Education & Training',
      fields: [ 'subjectGraduation', 'subjectPostGraduation', 'swatAwtCourse', 'specialCourse', 'promotionType' ]
    },
    {
      id: 'service',
      title: '3. Service Details',
      fields: [ 'rank', 'beltNumber', 'cadre', 'serviceType', 'serviceStatus', 'serviceBookNumber', 'dateOfEnlistment', 'dateOfLastPromotion', 'retirementDate' ]
    },
    {
      id: 'posting',
      title: '4. Posting & Location (STRICT)',
      fields: [ 'stateId', 'rangeId', 'districtId', 'unitType', 'currentUnitId', 'currentSubUnitId' ]
    },
    {
      id: 'duty',
      title: '5. Duty & Role',
      fields: [ 'psDutyType', 'ioStatus', 'ioCategory', 'paradeGroup', 'spoTrade', 'company', 'dateOfPosting', 'rBatch', 'tDutyOrder', 'remarks' ]
    }
  ];

  // Confirmation/Usage Modals
  const [confirmModal, setConfirmModal] = useState(null); // { title: '', message: '', onConfirm: fn, type: 'delete|save|deactivate' }

  useEffect(() => {
    loadFields();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'PERSONNEL_LAYOUT') {
      loadPersonnelLayout();
    } else if (activeTab) {
      loadRecords();
      setSearchTerm('');
      setBulkInput('');
      setPreviewTags([]);
      setShowBulkEntry(false);
    }
  }, [activeTab, user]);

  async function loadPersonnelLayout() {
    setPersonnelLayout(DEFAULT_LAYOUT_MAP);
    setLayoutLoading(false);
  }



  async function savePersonnelLayout() {
    toast.warning('Layout saving is unsupported locally.');
  }

  const moveSection = (index, direction) => {
    const newLayout = [...personnelLayout];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newLayout.length) return;
    [newLayout[index], newLayout[targetIndex]] = [newLayout[targetIndex], newLayout[index]];
    setPersonnelLayout(newLayout);
  };

  const moveField = (sectionIndex, fieldIndex, direction) => {
    const newLayout = [...personnelLayout];
    const section = { ...newLayout[sectionIndex] };
    const fields = [...section.fields];
    const targetIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    [fields[fieldIndex], fields[targetIndex]] = [fields[targetIndex], fields[fieldIndex]];
    section.fields = fields;
    newLayout[sectionIndex] = section;
    setPersonnelLayout(newLayout);
  };

  const shiftFieldToSection = (fromSectionIndex, fieldIndex, toSectionId) => {
    const newLayout = personnelLayout.map(s => ({ ...s, fields: [...s.fields] }));
    const fieldId = newLayout[fromSectionIndex].fields[fieldIndex];
    
    // Remove from old
    newLayout[fromSectionIndex].fields.splice(fieldIndex, 1);
    
    // Add to new
    const toSection = newLayout.find(s => s.id === toSectionId);
    if (toSection) toSection.fields.push(fieldId);
    
    setPersonnelLayout(newLayout);
  };

  async function loadFields() {
    if (!user?.stateId) return;
    try {
      setLoading(true);
      const data = await api.admin.fieldTypes(user.stateId);

      const mapped = (data||[]).map(d => ({
        id: d.id,
        fieldName: d.field_name,
        displayName: d.display_name,
        personnelFieldName: d.personnel_field_name,
        helperExample: d.helper_example,
        description: d.description,
        isActive: d.is_active,
        stateId: d.state_id
      }));

      setMasterFields(mapped);
      if (mapped.length > 0) {
        if (!activeTab) setActiveTab(mapped[0].fieldName);
      } else {
        setLoading(false); 
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load field types.');
      setLoading(false);
    }
  }

  async function loadRecords() {
    if (!user?.stateId || !activeTab) {
      setRecordsLoading(false);
      return;
    }

    const fieldConfig = masterFields.find(f => f.fieldName === activeTab);
    if (!fieldConfig) {
      setRecordsLoading(false);
      return;
    }

    try {
      setRecordsLoading(true);
      const data = await api.admin.dropdownValues({ 
        stateId: user.stateId, 
        fieldTypeId: fieldConfig.id 
      });
      
      const mapped = (data||[]).map(d => ({
        id: d.id,
        value: d.value,
        displayOrder: d.display_order,
        accessLevel: d.access_level,
        isActive: d.is_active,
        fieldTypeId: d.field_type_id,
        fieldType: activeTab // Keep for UI logic
      }));

      setRecords(mapped);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load dropdown data.');
    } finally {
      setRecordsLoading(false);
      setLoading(false); 
    }
  }

  // --- Comma-Based Multi-Entry ---
  function processBulkInput(input) {
    const raw = input.split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);
    // Remove duplicates within input itself
    const unique = [...new Set(raw.map(v => v.toLowerCase()))].map(lower => {
      return raw.find(v => v.toLowerCase() === lower);
    });
    // Check against existing records
    const existingLower = records.filter(r => r.isActive).map(r => r.value.toLowerCase());
    const tags = unique.map(v => ({
      value: v,
      isDuplicate: existingLower.includes(v.toLowerCase())
    }));
    setPreviewTags(tags);
  }

  function handleBulkInputChange(e) {
    const val = e.target.value;
    setBulkInput(val);
    if (val.trim()) {
      processBulkInput(val);
    } else {
      setPreviewTags([]);
    }
  }

  async function saveBulkEntries() {
    const validTags = previewTags.filter(t => !t.isDuplicate);
    if (validTags.length === 0) {
      toast.warning('No new values to add. All entries already exist.');
      return;
    }

    const fieldConfig = masterFields.find(f => f.fieldName === activeTab);
    if (!fieldConfig) return;

    setConfirmModal({
      title: 'Confirm Add Values',
      message: `Are you sure you want to add ${validTags.length} new value(s) to "${fieldConfig.displayName}"?`,
      onConfirm: async () => {
        try {
          setSaving(true);
          const maxOrder = records.reduce((max, r) => Math.max(max, r.displayOrder || 0), 0);

          const newEntries = validTags.map((tag, i) => ({
            field_type_id: fieldConfig.id,
            state_id: user.stateId,
            value: tag.value,
            display_order: maxOrder + i + 1,
            access_level: 'all',
            is_active: true,
          }));

          await Promise.all(newEntries.map(e => api.admin.createValue(e)));

          toast.success(`${validTags.length} value(s) added successfully.`);
          setBulkInput('');
          setPreviewTags([]);
          setShowBulkEntry(false);
          loadRecords();
        } catch (err) {
          toast.error('Failed to save entries.');
        } finally {
          setSaving(false);
          setConfirmModal(null);
        }
      }
    });
  }

  // --- Single Record Edit ---
  function openEdit(record) {
    setEditingRecord(record);
    setEditForm({
      value: record.value,
      displayOrder: record.displayOrder || 0,
      accessLevel: record.accessLevel || 'all'
    });
  }

  async function saveEdit() {
    if (!editForm.value.trim()) {
      toast.warning('Value cannot be empty.'); return;
    }
    // Check duplicate (excluding self)
    const isDup = records.some(r =>
      r.id !== editingRecord.id &&
      r.value.toLowerCase() === editForm.value.trim().toLowerCase()
    );
    if (isDup) {
      toast.warning('This value already exists.'); return;
    }
    try {
      setSaving(true);
      await api.admin.updateValue(editingRecord.id, {
        value: editForm.value.trim(),
        display_order: parseInt(editForm.displayOrder) || 0,
        access_level: editForm.accessLevel,
      });

      toast.success('Record updated.');
      setEditingRecord(null);
      loadRecords();
    } catch (err) {
      toast.error('Failed to update record.');
    } finally {
      setSaving(false);
    }
  }

  // --- Soft Delete (Toggle Active) ---
  async function toggleActive(record) {
    const action = record.isActive ? 'deactivate' : 'activate';
    setConfirmModal({
      title: `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      message: `Are you sure you want to ${action} "${record.value}"?`,
      onConfirm: async () => {
        try {
          setSaving(true);
          await api.admin.updateValue(record.id, {
            is_active: !record.isActive,
          });

          toast.success(`${record.value} ${record.isActive ? 'deactivated' : 'activated'}.`);
          loadRecords();
        } catch (err) {
          toast.error('Failed to update status.');
        } finally {
          setSaving(false);
          setConfirmModal(null);
        }
      }
    });
  }

  // --- SAFE DELETION LOGIC ---
  async function checkValueUsage(record) {
    const fieldType = record.fieldType;
    const value = record.value;
    const masterField = masterFields.find(f => f.fieldName === fieldType);
    
    if (!masterField?.personnelFieldName) return false;

    try {
      const data = await api.personnel.list();
      return data.some(p => p[masterField.personnelFieldName] === value);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Usage check failed:', err);
      return true; // Fail safe
    }
  }

  async function handleDeleteValue(record) {
    const isUsed = await checkValueUsage(record);
    if (isUsed) {
      setConfirmModal({
        title: 'Cannot Delete Value',
        message: `"${record.value}" is already in use in Personnel records and cannot be deleted. You may deactivate it instead.`,
        type: 'info',
        onConfirm: () => setConfirmModal(null)
      });
      return;
    }

    setConfirmModal({
      title: 'Confirm Permanent Delete',
      message: `Are you sure you want to permanently delete "${record.value}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          setSaving(true);
          await api.admin.deleteValue(record.id);

          toast.success('Record deleted.');
          loadRecords();
        } catch (err) {
          toast.error('Failed to delete record.');
        } finally {
          setSaving(false);
          setConfirmModal(null);
        }
      }
    });
  }

  // --- FIELD TYPE MANAGEMENT ---
  function openEditFieldType(field) {
    setEditingFieldType(field);
    setNewFieldType({
      displayName: field.displayName,
      fieldName: field.fieldName, // Keys shouldn't normally change, but we allow display name edit
      personnelFieldName: field.personnelFieldName || '',
      helperExample: field.helperExample || 'Value1, Value2, Value3',
      isActive: field.isActive !== false
    });
    setShowFieldTypeModal(true);
    setActiveMenu(null);
  }

  async function saveFieldType() {
    if (!newFieldType.displayName || !newFieldType.fieldName) {
      toast.warning('Name and Key are required.'); return;
    }
    const isEdit = !!editingFieldType;
    setConfirmModal({
      title: isEdit ? 'Update Category' : 'Add Field Type',
      message: `${isEdit ? 'Update' : 'Add'} "${newFieldType.displayName}" as a dropdown master category?`,
      onConfirm: async () => {
        try {
          setSaving(true);
          
          const payload = {
            state_id: user.stateId,
            field_name: newFieldType.fieldName,
            display_name: newFieldType.displayName,
            personnel_field_name: newFieldType.personnelFieldName || null,
            helper_example: newFieldType.helperExample || 'Value1, Value2, Value3',
            description: newFieldType.description || '',
            is_active: newFieldType.isActive !== false,
          };

          if (isEdit) {
            await api.admin.updateField(editingFieldType.id, payload);
          } else {
            await api.admin.createField(payload);
          }

          toast.success(isEdit ? 'Category updated.' : 'Field type added.');
          setShowFieldTypeModal(false);
          setEditingFieldType(null);
          loadFields();
        } catch (err) {
          toast.error('Failed to save category.');
        } finally {
          setSaving(false);
          setConfirmModal(null);
        }
      }
    });
  }

  async function toggleFieldTypeActive(field) {
     const nextState = field.isActive === false; 
     setConfirmModal({
        title: nextState ? 'Activate Category' : 'Deactivate Category',
        message: `Are you sure you want to ${nextState ? 'activate' : 'deactivate'} the "${field.displayName}" category?`,
        onConfirm: async () => {
          try {
            setSaving(true);
            await api.admin.updateField(field.id, { is_active: nextState });

            toast.success('Category updated.');
            loadFields();
          } catch (err) {
            toast.error('Failed to update category.');
          } finally {
            setSaving(false);
            setConfirmModal(null);
            setActiveMenu(null);
          }
        }
     });
  }

  function handleMenuClick(e, field) {
    e.stopPropagation();
    if (activeMenu?.id === field.id) {
      setActiveMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 160; // Approximate
    const openUp = spaceBelow < menuHeight;
    
    setActiveMenu({
      id: field.id,
      top: openUp ? rect.top - 8 : rect.bottom + 8,
      left: rect.left,
      openUp
    });
  }

  async function deleteFieldType(field) {
    const data = await api.admin.dropdownValues({ fieldTypeId: field.id, stateId: user.stateId });
    const count = (data||[]).length;

    if (count > 0) {
      setConfirmModal({
        title: 'Cannot Delete Tab',
        message: `The "${field.displayName}" category contains ${count} values and cannot be deleted. Remove all values first.`,
        type: 'error',
        onConfirm: () => setConfirmModal(null)
      });
      return;
    }

    setConfirmModal({
      title: 'Confirm Delete Tab',
      message: `Are you sure you want to remove the "${field.displayName}" category?`,
      onConfirm: async () => {
        try {
          setSaving(true);
          await api.admin.deleteField(field.id);

          toast.success('Tab removed.');
          setActiveTab(masterFields[0]?.fieldName || '');
          loadFields();
        } catch (err) {
          toast.error('Failed to remove tab.');
        } finally {
          setSaving(false);
          setConfirmModal(null);
        }
      }
    });
  }

  // --- Filtered Records ---
  const filteredRecords = useMemo(() => {
    if (!searchTerm) return records;
    return records.filter(r => r.value.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [records, searchTerm]);

  const activeCount = records.filter(r => r.isActive).length;
  const inactiveCount = records.filter(r => !r.isActive).length;

  return (
    <div className="master-data-module">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Database size={24} className="text-primary" />
          <h2>Dropdown Master Management</h2>
        </div>
        <p className="text-sm text-gray-500" style={{margin: 0}}>
          Centralized dropdown values for the entire portal
        </p>
      </div>

      {/* Tab Selector */}
      <div className="panel mb-4">
        <div className="panel-body" style={{ padding: '12px 16px' }}>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center'
          }}>
            {masterFields.map(ft => (
              <div key={ft.fieldName} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  className={`btn btn-sm ${activeTab === ft.fieldName ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setActiveTab(ft.fieldName)}
                  style={{ 
                    borderRadius: '20px', padding: '6px 16px', 
                    fontWeight: activeTab === ft.fieldName ? 700 : 400,
                    opacity: ft.isActive === false ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  {ft.displayName}
                  {ft.isActive === false && <span style={{fontSize: '0.7rem'}}>(Inactive)</span>}
                  
                  {canEdit && activeTab === ft.fieldName && (
                    <div 
                      onClick={(e) => handleMenuClick(e, ft)}
                      style={{ 
                        padding: '4px 6px', marginLeft: '8px', marginRight: '-10px',
                        display: 'flex', alignItems: 'center', 
                        backgroundColor: '#e6f0ff', color: '#0b3d91',
                        borderRadius: '4px', borderLeft: '1px solid rgba(0,0,0,0.05)',
                        transition: 'all 0.2s'
                      }}
                      className="tab-action-btn"
                    >
                      <MoreVertical size={16} />
                    </div>
                  )}
                </button>

                {/* Tab Menu Dropdown (Smart Positioned) */}
                {activeMenu?.id === ft.id && (
                  <>
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,0.02)' }} 
                      onClick={() => setActiveMenu(null)}
                    />
                    <div style={{ 
                      position: 'fixed', 
                      top: window.innerWidth < 768 ? 'auto' : activeMenu.top,
                      bottom: window.innerWidth < 768 ? 0 : (activeMenu.openUp ? (window.innerHeight - activeMenu.top) : 'auto'),
                      left: window.innerWidth < 768 ? 0 : activeMenu.left,
                      width: window.innerWidth < 768 ? '100%' : '180px',
                      zIndex: 999, 
                      backgroundColor: '#0b3d91', color: 'white',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                      borderRadius: window.innerWidth < 768 ? '16px 16px 0 0' : '8px', 
                      overflow: 'hidden', padding: '8px 0',
                      animation: window.innerWidth < 768 ? 'slideUp 0.3s ease-out' : 'fadeIn 0.2s ease-out',
                      transform: (!activeMenu.openUp || window.innerWidth < 768) ? 'none' : 'translateY(-100%)'
                    }}>
                      <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px', display: window.innerWidth < 768 ? 'block' : 'none' }}>
                         <p style={{ fontWeight: 700, margin: 0 }}>{ft.displayName} Options</p>
                      </div>
                      <button className="dropdown-item-gov" onClick={() => openEditFieldType(ft)}>
                        <Edit size={16} className="mr-3" /> Edit Meta
                      </button>
                      <button className="dropdown-item-gov" onClick={() => toggleFieldTypeActive(ft)}>
                        {ft.isActive === false ? <Check size={16} className="mr-3" /> : <X size={16} className="mr-3" />}
                        {ft.isActive === false ? 'Activate' : 'Deactivate'}
                      </button>
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />
                      <button className="dropdown-item-gov text-danger-light" onClick={() => { deleteFieldType(ft); setActiveMenu(null); }}>
                        <Trash2 size={16} className="mr-3" /> Delete Tab
                      </button>
                      {window.innerWidth < 768 && (
                        <button className="dropdown-item-gov" style={{textAlign: 'center', marginTop: 8, opacity: 0.8}} onClick={() => setActiveMenu(null)}>
                          Close
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
            {canEdit && (
              <button
                className={`btn btn-sm ${activeTab === 'PERSONNEL_LAYOUT' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('PERSONNEL_LAYOUT')}
                style={{ 
                  borderRadius: '20px', padding: '6px 16px', 
                  fontWeight: activeTab === 'PERSONNEL_LAYOUT' ? 700 : 400,
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                <Layout size={14} /> Personnel Layout
              </button>
            )}

            {canEdit && (
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => setShowFieldTypeModal(true)}
                style={{ borderRadius: '20px', border: '1px dashed var(--gray-300)' }}
              >
                <Plus size={14} className="mr-1" /> Add Tab
              </button>
            )}
          </div>
        </div>
      </div>
      {activeTab === 'PERSONNEL_LAYOUT' ? (
        <div className="layout-manager-container">
          <div className="panel mb-4" style={{ borderLeft: '4px solid var(--primary-500)' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-50)' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--primary-700)' }}>
                  <Layout size={18} style={{ display: 'inline', marginRight: 8 }} />
                  Personnel Form Layout
                </h3>
                <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  Manage sections and shuffle fields to customize the Personnel Add/View screens.
                </p>
              </div>
              <button className="btn btn-primary" onClick={savePersonnelLayout} disabled={layoutSaving}>
                {layoutSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>

            <div className="panel-body" style={{ background: 'var(--gray-50)', padding: 'var(--space-4)' }}>
              {layoutLoading ? (
                <div className="empty-state"><div className="spinner"></div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {personnelLayout.map((section, sIdx) => (
                    <div key={section.id} className="panel" style={{ boxShadow: 'var(--shadow-sm)' }}>
                      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'white' }}>
                        <h4 style={{ margin: 0, color: 'var(--gray-700)' }}>{section.title}</h4>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => moveSection(sIdx, 'up')} disabled={sIdx === 0}><ChevronUp size={14} /></button>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => moveSection(sIdx, 'down')} disabled={sIdx === personnelLayout.length - 1}><ChevronDown size={14} /></button>
                        </div>
                      </div>
                      <div className="panel-body" style={{ padding: '16px', background: 'white' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                          {section.fields.map((fid, fIdx) => (
                            <div key={fid} style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              padding: '10px 14px', 
                              background: 'var(--gray-50)', 
                              border: '1px solid var(--gray-200)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.85rem'
                            }}>
                              <span style={{ fontWeight: 600, color: 'var(--gray-600)' }}>{fid}</span>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button className="btn btn-ghost btn-xs btn-icon" onClick={() => moveField(sIdx, fIdx, 'up')} disabled={fIdx === 0}><ChevronUp size={12} /></button>
                                <button className="btn btn-ghost btn-xs btn-icon" onClick={() => moveField(sIdx, fIdx, 'down')} disabled={fIdx === section.fields.length - 1}><ChevronDown size={12} /></button>
                                
                                {/* Section Shifter (Except for core posting fields) */}
                                {!['stateId', 'rangeId', 'districtId', 'unitType', 'currentUnitId', 'currentSubUnitId'].includes(fid) && (
                                  <select 
                                    className="form-select"
                                    style={{ fontSize: '0.7rem', padding: '2px 4px', width: 'auto', height: 'auto', border: '1px solid var(--gray-300)' }}
                                    onChange={(e) => shiftFieldToSection(sIdx, fIdx, e.target.value)}
                                    value={section.id}
                                  >
                                    {personnelLayout.map(target => (
                                      <option key={target.id} value={target.id}>{target.id === section.id ? 'Move To...' : target.title}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Stats + Actions Bar */}
          <div className="panel mb-4">
        <div className="panel-body" style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px'
        }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span className="badge badge-success">{activeCount} Active</span>
            {inactiveCount > 0 && <span className="badge badge-warning">{inactiveCount} Inactive</span>}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                className="form-input"
                placeholder="Search values..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: 34, minWidth: 180 }}
              />
            </div>
            {canEdit && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowBulkEntry(!showBulkEntry)}>
                <Plus size={16} className="mr-1" style={{display:'inline'}} />
                Add Values
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comma-Based Bulk Entry */}
      {showBulkEntry && canEdit && (
        <div className="panel mb-4" style={{ borderLeft: '4px solid var(--primary-500)' }}>
          <div className="panel-header" style={{ background: 'var(--primary-50)' }}>
            <h3 style={{ color: 'var(--primary-700)', fontSize: '0.95rem' }}>
              <Tag size={16} style={{ display: 'inline', marginRight: 8 }} />
              Add New {masterFields.find(f => f.fieldName === activeTab)?.displayName} Values
            </h3>
          </div>
          <div className="panel-body">
            <p className="text-sm text-gray-500 mb-3">
              Enter a single value or multiple values separated by commas (e.g., <strong>{masterFields.find(f => f.fieldName === activeTab)?.helperExample || 'Value1, Value2, Value3'}</strong>).
            </p>
            <input
              className="form-input"
              placeholder={`Enter values (e.g., ${masterFields.find(f => f.fieldName === activeTab)?.helperExample || 'Value1, Value2, Value3'})`}
              value={bulkInput}
              onChange={handleBulkInputChange}
              style={{ fontSize: '1rem', padding: '10px 14px' }}
              autoFocus
            />

            {/* Tag Preview */}
            {previewTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                {previewTags.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 12px', borderRadius: 16, fontSize: '0.85rem', fontWeight: 500,
                      background: tag.isDuplicate ? 'var(--warning-100)' : 'var(--success-100)',
                      color: tag.isDuplicate ? 'var(--warning-700)' : 'var(--success-700)',
                      border: `1px solid ${tag.isDuplicate ? 'var(--warning-300)' : 'var(--success-300)'}`,
                      textDecoration: tag.isDuplicate ? 'line-through' : 'none'
                    }}
                  >
                    {tag.value}
                    {tag.isDuplicate && <span style={{ fontSize: '0.75rem' }}>(exists)</span>}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowBulkEntry(false); setBulkInput(''); setPreviewTags([]); }}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={saveBulkEntries}
                disabled={saving || previewTags.filter(t => !t.isDuplicate).length === 0}
              >
                {saving ? 'Saving...' : `Save ${previewTags.filter(t => !t.isDuplicate).length} Value(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="panel">
        <div className="table-container">
          {recordsLoading ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="spinner spinner-lg"></div>
              <p>Loading {masterFields.find(f => f.fieldName === activeTab)?.displayName || '...'} data...</p>
            </div>
          ) : masterFields.length === 0 && !loading ? (
             <div className="empty-state" style={{ padding: 40 }}>
              <Database size={40} style={{ color: 'var(--gray-300)' }} />
              <p>No dropdown master categories configured for your state.</p>
              {canEdit && (
                <button className="btn btn-primary btn-sm mt-3" onClick={() => setShowFieldTypeModal(true)}>
                  Create First Category
                </button>
              )}
            </div>
          ) : filteredRecords.length === 0 && !loading ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <Database size={40} style={{ color: 'var(--gray-300)' }} />
              <p>{searchTerm ? 'No matching records found.' : 'No values configured yet.'}</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>#</th>
                  <th>Value</th>
                  <th>Access Level</th>
                  <th style={{ width: 80 }}>Order</th>
                  <th style={{ width: 100 }}>Status</th>
                  {canEdit && <th style={{ width: 120, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, idx) => (
                  <tr key={record.id} style={{ opacity: record.isActive ? 1 : 0.5 }}>
                    <td style={{ color: 'var(--gray-400)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{record.value}</td>
                    <td>
                      <span className={`badge ${
                        record.accessLevel?.includes('only') ? 'badge-danger' : 
                        record.accessLevel?.includes('plus') ? 'badge-warning' : 
                        'badge-info'
                      }`} style={{ fontSize: '0.75rem' }}>
                        {ACCESS_LEVEL_LABELS[record.accessLevel] || 'All Roles'}
                      </span>
                    </td>
                    <td>{record.displayOrder || '—'}</td>
                    <td>
                      <span className={`badge ${record.isActive ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                        {record.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEdit && (
                      <td>
                        <div className="actions">
                          <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => openEdit(record)}>
                            <Edit size={15} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            title={record.isActive ? 'Deactivate' : 'Activate'}
                            onClick={() => toggleActive(record)}
                            style={{ color: record.isActive ? 'var(--warning-500)' : 'var(--success-500)' }}
                          >
                            {record.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          <button className="btn btn-ghost btn-icon btn-sm" title="Delete" onClick={() => handleDeleteValue(record)} style={{ color: 'var(--danger-500)' }}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

        </>
      )}

      {/* Edit Modal */}
      {editingRecord && (
        <div className="modal-overlay" onClick={() => setEditingRecord(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>Edit {masterFields.find(f => f.fieldName === activeTab)?.displayName}</h3>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Value <span className="required">*</span></label>
                <input className="form-input" value={editForm.value}
                  onChange={e => setEditForm(prev => ({ ...prev, value: e.target.value }))}
                  autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Display Order</label>
                  <input className="form-input" type="number" value={editForm.displayOrder}
                    onChange={e => setEditForm(prev => ({ ...prev, displayOrder: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Access Level</label>
                  <select className="form-select" value={editForm.accessLevel}
                    onChange={e => setEditForm(prev => ({ ...prev, accessLevel: e.target.value }))}>
                    {Object.entries(ACCESS_LEVEL_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingRecord(null)} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Field Type Modal */}
      {showFieldTypeModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>{editingFieldType ? `Edit Category: ${editingFieldType.displayName}` : 'Add New Field Category'}</h3>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Display Name <span className="required">*</span></label>
                <input className="form-input" placeholder="e.g. Nationality" 
                  value={newFieldType.displayName}
                  onChange={e => setNewFieldType(prev => ({ ...prev, displayName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Internal Field Key <span className="required">*</span></label>
                <input className="form-input" placeholder="e.g. nationality (lowercase, no spaces)"
                  value={newFieldType.fieldName}
                  onChange={e => setNewFieldType(prev => ({ ...prev, fieldName: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                  disabled={!!editingFieldType} />
                <p className="form-hint">{editingFieldType ? 'Database key cannot be changed after creation.' : 'Used for database filtering. Use only lowercase and underscores.'}</p>
              </div>
              <div className="form-group">
                <label className="form-label">Personnel Mapper Key <span className="form-hint">(Optional)</span></label>
                <input className="form-input" placeholder="e.g. nationality"
                  value={newFieldType.personnelFieldName}
                  onChange={e => setNewFieldType(prev => ({ ...prev, personnelFieldName: e.target.value }))} />
                <p className="form-hint">The exact key name in the Personnel record to check for usage.</p>
              </div>
              <div className="form-group">
                <label className="form-label">Bulk Input Examples <span className="form-hint">(Optional)</span></label>
                <input className="form-input" placeholder="e.g. SC, ST, OBC"
                  value={newFieldType.helperExample}
                  onChange={e => setNewFieldType(prev => ({ ...prev, helperExample: e.target.value }))} />
                <p className="form-hint">These examples will be shown to users when adding values in bulk.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowFieldTypeModal(false); setEditingFieldType(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveFieldType} disabled={saving}>
                {editingFieldType ? 'Update Category' : 'Add Field Type'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal - Rendered last with high z-index to stay on top */}
      {confirmModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 style={{ color: confirmModal.type === 'error' ? 'var(--danger-600)' : 'inherit' }}>
                {confirmModal.title}
              </h3>
            </div>
            <div className="modal-body">
              <p>{confirmModal.message}</p>
            </div>
            <div className="modal-footer">
              {confirmModal.type === 'info' || confirmModal.type === 'error' ? (
                <button className="btn btn-primary" onClick={confirmModal.onConfirm || (() => setConfirmModal(null))}>Close</button>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
                  <button className={`btn ${confirmModal.title.includes('Delete') ? 'btn-danger' : 'btn-primary'}`} 
                    onClick={confirmModal.onConfirm} disabled={saving}>
                    {saving ? 'Processing...' : 'Confirm'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
