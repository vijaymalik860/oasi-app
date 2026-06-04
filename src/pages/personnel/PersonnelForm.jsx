import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import { Save, ArrowLeft, Camera, X, Edit } from 'lucide-react';
import { validateMobile, validateAadhar, validatePAN, validateDateOfBirth, validateDateOrder, maskAadhar, maskPAN } from '../../utils/validators';
import { useLocation } from 'react-router-dom';

// Extracts yyyy-mm-dd from ISO datetime or date string
const toDateStr = (val) => {
  if (!val) return '';
  const s = String(val);
  // ISO datetime: "1977-07-23T00:00:00.000Z"
  if (s.includes('T')) return s.split('T')[0];
  // Already date: "1977-07-23"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '';
};

// Maps raw imported values to dropdown options (case-insensitive)
const GRAD_OPTIONS  = ['8th or Below', '10th / Matric', '12th / Inter', 'BA', 'BSc', 'BCom', 'BCA', 'BTech / BE', 'BBA', 'Other Graduation'];
const PG_OPTIONS    = ['MA', 'MSc', 'MCom', 'MCA', 'MTech / ME', 'MBA', 'LLB / LLM', 'PhD', 'Other PG'];
const normalizeDegree = (val, options) => {
  if (!val) return '';
  const up = val.toString().toUpperCase().trim();
  // Exact match first
  const exact = options.find(o => o.toUpperCase() === up);
  if (exact) return exact;
  // Partial match
  const partial = options.find(o => up.includes(o.toUpperCase().split(' ')[0]) || o.toUpperCase().includes(up));
  return partial || val; // return raw value if no match (stored as-is)
};

const EMPTY_FORM = {
  beltNumber: '', payCode: '', rank: '', fullName: '', fatherName: '',
  gender: '', dateOfBirth: '', religion: '', caste: '', category: '',
  cadre: '', serviceType: '', serviceBookNumber: '', dateOfEnlistment: '',
  dateOfLastPromotion: '', retirementDate: '', village: '', policeStation: '',
  homeDistrict: '', bloodGroup: '', mobileNumber: '', alternateContact: '',
  aadharNumber: '', pan: '', serviceStatus: 'Active',
  psDutyType: '', ioStatus: '', ioCategory: '',
  paradeGroup: '', spoTrade: '', promotionType: '', specialCourse: '',
  company: '', remarks: '',
  graduationDegree: '', subjectGraduation: '',
  pgDegree: '', subjectPostGraduation: '',
  swatAwtCourse: '', rBatch: '', tDutyOrder: '', dateOfPosting: '',
  stateId: '', rangeId: '', districtId: '', unitType: '', currentUnitId: '', currentSubUnitId: '',
};

const DEFAULT_LAYOUT = [
  {
    id: 'personal',
    title: '1. Personal Details',
    fields: [ 'photo_and_name_block', 'dateOfBirth', 'gender', 'bloodGroup', 'mobileNumber', 'alternateContact', 'payCode', 'religion', 'caste', 'category', 'aadharNumber', 'pan', 'village', 'policeStation', 'homeDistrict' ]
  },
  {
    id: 'education',
    title: '2. Education & Training',
    fields: [ 'graduationDegree', 'subjectGraduation', 'pgDegree', 'subjectPostGraduation', 'swatAwtCourse', 'specialCourse', 'promotionType' ]
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

export default function PersonnelForm() {
  const { id } = useParams();
  const location = useLocation();
  const isEdit = !!id && id !== 'add' && location.pathname.endsWith('/edit');
  const isView = !!id && id !== 'add' && !location.pathname.endsWith('/edit');
  
  const navigate = useNavigate();
  const { user, isSuperAdmin, isStateAdmin, isRangeAdmin, isDistrictAdmin, isUnitAdmin } = useAuth();
  const toast = useToast();

  const [rawLayout, setRawLayout] = useState(DEFAULT_LAYOUT);
  const [masterFields, setMasterFields] = useState([]);
  const [allMasterData, setAllMasterData] = useState([]);

  // Memoized Layout Merging: Automatically adds unplaced master fields to a virtual section
  const layout = useMemo(() => {
    const sections = JSON.parse(JSON.stringify(rawLayout));
    const placedFields = new Set(sections.flatMap(s => s.fields));
    
    // Ensure core text fields are present even if removed from DB layout previously
    const dutySection = sections.find(s => s.id === 'duty');
    if (dutySection) {
      if (!placedFields.has('psDutyType')) {
        dutySection.fields.push('psDutyType');
        placedFields.add('psDutyType');
      }
    }

    // Identify fields defined in Dropdown Master that are NOT in the layout and NOT hardcoded system fields
    const unplacedMasterFields = masterFields.filter(f => {
      const fid = f.personnelFieldName || f.fieldName;
      return !placedFields.has(fid) && !['rank', 'gender', 'serviceType', 'serviceStatus', 'cadre', 'religion', 'caste', 'category'].includes(fid);
    });

    if (unplacedMasterFields.length > 0) {
      sections.push({
        id: 'additional_auto',
        title: '6. Additional Information (Auto-Sync)',
        fields: unplacedMasterFields.map(f => f.personnelFieldName || f.fieldName)
      });
    }
    return sections;
  }, [rawLayout, masterFields]);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPosting, setShowPosting] = useState(false);
  
  const [states, setStates] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [unitCategories, setUnitCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [subUnits, setSubUnits] = useState([]);
  
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    loadStates();
    loadCategories();
    if (isEdit || isView) {
      loadPersonnel();
      setShowPosting(true);
    } else {
      // Auto-fill scope based on role for NEW personnel
      if (user) {
        setForm(prev => ({
          ...prev,
          stateId: user.stateId || '',
          rangeId: user.rangeId || '',
          districtId: user.districtId || '',
          currentUnitId: user.unitId || '',
        }));
      }
      setShowPosting(true);
    }
  }, [id, user, isEdit]);

  async function loadStates() {
    if (!isSuperAdmin) return;
    const data = await api.hierarchy.states();
    if (data) setStates((data||[]).map(d => ({ id: d.id, stateName: d.name, ...d })));
  }

  async function loadCategories() {
    try {
      const data = await api.hierarchy.unitCategories();
      setUnitCategories((data||[]).map(d => d.name || d));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to load categories:', err);
    }
  }

  // Added Real-time Master Data Listeners
  useEffect(() => {
    if (!user?.stateId) return;

    async function loadMasterConfig() {
      try {
        // 1. Fetch Field Definitions
        const fields = await api.admin.fieldTypes(user.stateId);

        const mappedFields = (fields||[]).map(f => ({
          id: f.id,
          fieldName: f.field_name,
          displayName: f.display_name,
          personnelFieldName: f.personnel_field_name,
          isActive: f.is_active
        }));
        setMasterFields(mappedFields);

        // 2. Fetch Dropdown Values
        const values = await api.admin.dropdownValues({ stateId: user.stateId });

        const mappedValues = (values||[]).map(v => {
          const field = fields.find(f => f.id === v.field_type_id);
          return {
            id: v.id,
            value: v.value,
            fieldType: field ? field.field_name : 'unknown',
            displayOrder: v.display_order,
            accessLevel: v.access_level
          };
        });
        setAllMasterData(mappedValues);

      } catch (err) {
        if (import.meta.env.DEV) console.error('Master config load error:', err);
      }
    }

    loadMasterConfig();
  }, [user]);

  // Load override layout if exists (M11)
  useEffect(() => {
    // personnel_layouts table does not exist in local DB, so fallback to DEFAULT_LAYOUT
    setRawLayout(DEFAULT_LAYOUT);
  }, [user]);

  // Access Level Checker
  const hasAccess = (record) => {
    const level = record.accessLevel || 'all';
    if (level === 'all') return true;

    // "Only" - Exact Match
    if (level === 'super_admin_only') return isSuperAdmin;
    if (level === 'state_admin_only') return isStateAdmin;
    if (level === 'range_admin_only') return isRangeAdmin;
    if (level === 'district_admin_only') return isDistrictAdmin;
    if (level === 'unit_admin_only') return isUnitAdmin;

    // "Plus" - Hierarchical
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

  useEffect(() => {
    if (form.stateId) {
      loadRanges(form.stateId);
      if (!isEdit && !isView && isStateAdmin) {
        setForm(prev => ({ ...prev, rangeId: '', districtId: '', unitType: '', currentUnitId: '', currentSubUnitId: '' }));
      }
    }
  }, [form.stateId]);

  async function loadRanges(stateId) {
    if (!isSuperAdmin && !isStateAdmin) return;
    const data = await api.hierarchy.ranges(stateId);
    if (data) {
      setRanges(data.map(d => ({ id: d.id, rangeName: d.name, ...d })));
    }
  }

  useEffect(() => {
    if (form.rangeId || form.stateId) {
      loadDistricts();
      if (!isEdit && !isView && isStateAdmin) {
        setForm(prev => ({ ...prev, districtId: '', unitType: '', currentUnitId: '', currentSubUnitId: '' }));
      }
    } else {
      setDistricts([]);
    }
  }, [form.rangeId, form.stateId]);

  async function loadDistricts() {
    if (!isSuperAdmin && !isStateAdmin && !isRangeAdmin) return;
    const params = {};
    if (form.rangeId) params.rangeId = form.rangeId;
    else if (form.stateId) params.stateId = form.stateId;
    
    if (!params.rangeId && !params.stateId) return;

    const data = await api.hierarchy.districts(params);
    if (data) {
      setDistricts(data.map(d => ({ id: d.id, districtName: d.name, ...d })));
    }
  }

  useEffect(() => {
    // Dynamic fetch completes on mount, no need to overwrite category state here
  }, [form.districtId]);

  useEffect(() => {
    if (form.districtId && form.unitType) {
      loadUnits(form.districtId, form.unitType);
    } else {
      setUnits([]);
    }
  }, [form.districtId, form.unitType]);

  async function loadUnits(districtId, unitType) {
    if (!districtId || !unitType) return;
    if (!isSuperAdmin && !isStateAdmin && !isRangeAdmin && !isDistrictAdmin) return;
    try {
      const data = await api.hierarchy.units({ districtId, unitType });
      setUnits((data||[]).map(d => ({ id: d.id, unitName: d.name, ...d })));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to load units:', err);
    }
  }

  useEffect(() => {
    if (form.currentUnitId && form.districtId) {
      loadSubUnits(form.currentUnitId, form.districtId);
      if (!loading) setForm(prev => ({ ...prev, currentSubUnitId: '' }));
    } else {
      setSubUnits([]);
    }
  }, [form.currentUnitId, form.districtId]);

  async function loadSubUnits(unitId, districtId) {
    if (!unitId || !districtId) return;
    try {
      const data = await api.hierarchy.subUnits({ unitId, districtId });
      setSubUnits((data||[]).map(d => ({ id: d.id, subUnitName: d.name, ...d })));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to load sub-units:', err);
    }
  }

  async function loadPersonnel() {
    try {
      setLoading(true);
      const data = await api.personnel.get(id);

      if (data) {
        // Map snake_case from DB to camelCase for form state
        const mappedData = {
          beltNumber: data.belt_number,
          payCode: data.pay_code,
          rank: data.rank,
          fullName: data.full_name,
          fatherName: data.father_name,
          gender: data.gender,
          dateOfBirth:          toDateStr(data.date_of_birth),
          religion: data.religion,
          caste: data.caste,
          category: data.category,
          cadre: data.cadre,
          serviceType: data.service_type,
          serviceBookNumber: data.service_book_number,
          dateOfEnlistment:      toDateStr(data.date_of_enlistment),
          dateOfLastPromotion:   toDateStr(data.date_of_last_promotion),
          retirementDate:        toDateStr(data.retirement_date),
          village: data.village,
          policeStation: data.police_station,
          homeDistrict: data.home_district,
          bloodGroup: data.blood_group,
          mobileNumber: data.mobile_number,
          alternateContact: data.alternate_contact,
          aadharNumber: data.aadhar_number,
          pan: data.pan,
          serviceStatus: data.service_status,
          psDutyType: data.ps_duty_type,
          ioStatus: data.io_status,
          ioCategory: data.io_category,
          paradeGroup: data.parade_group,
          spoTrade: data.spo_trade,
          promotionType: data.promotion_type,
          specialCourse: data.special_course,
          company: data.company,
          remarks: data.remarks,
          graduationDegree:       normalizeDegree(data.graduation_degree, GRAD_OPTIONS),
          subjectGraduation:      data.subject_graduation,
          pgDegree:               normalizeDegree(data.pg_degree, PG_OPTIONS),
          subjectPostGraduation:  data.subject_post_graduation,
          swatAwtCourse:          data.swat_awt_course,
          rBatch:                 data.r_batch,
          tDutyOrder:             data.t_duty_order,
          dateOfPosting:          toDateStr(data.date_of_posting),
          stateId: data.state_id,
          rangeId: data.range_id,
          districtId: data.district_id,
          unitType: data.unit_type,
          currentUnitId: data.current_unit_id,
          currentSubUnitId: data.current_sub_unit_id,
          photoURL: data.photo_url
        };
        setForm(mappedData);
      } else {
        toast.error('Personnel record not found.');
        navigate('/personnel');
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('Personnel load error:', e);
      toast.error('Failed to load personnel details.');
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    
    setForm(prev => {
      let updated = { ...prev, [name]: value };
      
      // Hierarchy dependency cleaning
      if (name === 'stateId') {
        updated.rangeId = '';
        updated.districtId = '';
        updated.unitType = '';
        updated.currentUnitId = '';
        updated.currentSubUnitId = '';
      }
      if (name === 'rangeId') {
        updated.districtId = '';
        updated.unitType = '';
        updated.currentUnitId = '';
        updated.currentSubUnitId = '';
      }
      if (name === 'districtId') {
        updated.unitType = '';
        updated.currentUnitId = '';
        updated.currentSubUnitId = '';
      }
      if (name === 'unitType') {
        updated.currentUnitId = '';
        updated.currentSubUnitId = '';
      }
      if (name === 'currentUnitId') {
        updated.currentSubUnitId = '';
      }
      
      // Auto-fill PayCode from MobileNumber if PayCode is empty
      if (name === 'mobileNumber' && !prev.payCode) {
        updated.payCode = value;
      }

      return updated;
    });
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size should be less than 2MB');
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  }

  function removePhoto() {
    setPhotoFile(null);
    setPhotoPreview(null);
    setForm(prev => ({ ...prev, photoURL: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    // Required fields
    if (!form.fullName.trim()) { toast.warning('Full Name is required.'); return; }
    if (!form.mobileNumber.trim()) { toast.warning('Mobile Number is required.'); return; }
    
    // Rank validation (Dynamic)
    const rankMeta = masterFields.find(f => f.fieldName === 'rank' || f.personnelFieldName === 'rank');
    if (rankMeta) {
      if (!form.rank) { toast.warning('Rank is required.'); return; }
      const allowedRanks = getDropdownValues(rankMeta.fieldName);
      const isRankAllowed = allowedRanks.some(r => r.value === form.rank);
      if (!isRankAllowed) {
        toast.error('This rank is not permitted for your role.');
        return;
      }
    }

    // Mobile validation
    const mobileCheck = validateMobile(form.mobileNumber.trim());
    if (!mobileCheck.valid) { toast.error(mobileCheck.message); return; }

    // Aadhar validation (optional field)
    if (form.aadharNumber) {
      const aadharCheck = validateAadhar(form.aadharNumber);
      if (!aadharCheck.valid) { toast.error(aadharCheck.message); return; }
    }

    // PAN validation (optional field)
    if (form.pan) {
      const panCheck = validatePAN(form.pan);
      if (!panCheck.valid) { toast.error(panCheck.message); return; }
    }

    // Date of birth validation
    if (form.dateOfBirth) {
      const dobCheck = validateDateOfBirth(form.dateOfBirth);
      if (!dobCheck.valid) { toast.error(dobCheck.message); return; }
    }

    // Date logic validations
    if (form.dateOfBirth && form.dateOfEnlistment) {
      const order = validateDateOrder(form.dateOfBirth, form.dateOfEnlistment, 'Date of Birth', 'Date of Enlistment');
      if (!order.valid) { toast.error(order.message); return; }
    }
    if (form.dateOfEnlistment && form.retirementDate) {
      const order = validateDateOrder(form.dateOfEnlistment, form.retirementDate, 'Date of Enlistment', 'Retirement Date');
      if (!order.valid) { toast.error(order.message); return; }
    }

    const payCode = form.payCode.trim() || form.mobileNumber.trim();

    setSaving(true);
    try {
      let photoURL = form.photoURL || '';

      const baseData = {
        belt_number: form.beltNumber,
        pay_code: payCode,
        rank: form.rank,
        full_name: form.fullName.trim(),
        father_name: form.fatherName,
        gender: form.gender,
        date_of_birth: form.dateOfBirth || null,
        religion: form.religion,
        caste: form.caste,
        category: form.category,
        cadre: form.cadre,
        service_type: form.serviceType,
        service_book_number: form.serviceBookNumber,
        date_of_enlistment: form.dateOfEnlistment || null,
        date_of_last_promotion: form.dateOfLastPromotion || null,
        retirement_date: form.retirementDate || null,
        village: form.village,
        police_station: form.police_station,
        home_district: form.homeDistrict,
        blood_group: form.bloodGroup,
        mobile_number: form.mobileNumber.trim(),
        alternate_contact: form.alternateContact,
        aadhar_number: form.aadharNumber,
        pan: form.pan,
        service_status: form.serviceStatus,
        ps_duty_type: form.psDutyType,
        io_status: form.ioStatus,
        io_category: form.ioCategory,
        parade_group: form.paradeGroup,
        spo_trade: form.spoTrade,
        promotion_type: form.promotionType,
        special_course: form.specialCourse,
        company: form.company,
        remarks: form.remarks,
        graduation_degree: form.graduationDegree,
        subject_graduation: form.subjectGraduation,
        pg_degree: form.pgDegree,
        subject_post_graduation: form.subjectPostGraduation,
        swat_awt_course: form.swatAwtCourse,
        r_batch: form.rBatch,
        t_duty_order: form.tDutyOrder,
        date_of_posting: form.dateOfPosting || null,
        node_id: form.currentSubUnitId || 
                 ((!isSuperAdmin && !isStateAdmin && !isRangeAdmin && !isDistrictAdmin) ? (user.unitId || null) : (form.currentUnitId || null)) || 
                 ((!isSuperAdmin && !isStateAdmin && !isRangeAdmin) ? user.districtId : form.districtId) || 
                 ((!isSuperAdmin && !isStateAdmin) ? user.rangeId : form.rangeId) || 
                 (!isSuperAdmin ? user.stateId : form.stateId) || null,
        photo_url: photoURL,
        updated_at: new Date().toISOString(),
        updated_by_user_id: user.id,
      };

      const payload = new FormData();
      Object.entries(baseData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          payload.append(key, value);
        }
      });

      if (photoFile) {
        payload.append('photo', photoFile);
      }

      if (isEdit) {
        await api.personnel.update(id, payload);
        toast.success('Personnel record updated successfully.');
      } else {
        payload.append('is_deleted', false);
        payload.append('created_at', new Date().toISOString());
        payload.append('created_by_user_id', user.id);

        await api.personnel.create(payload);
        toast.success('Personnel record created successfully.');
      }
      navigate('/personnel');
    } catch (err) {
      if (import.meta.env.DEV) console.error('Save error:', err);
      toast.error('Failed to save personnel record.');
    } finally {
      setSaving(false);
    }
  }

  // Dynamic Component Helper
  const DynamicDropdown = ({ fieldName, label, required = false, className = "form-group" }) => {
    const fieldMeta = masterFields.find(f => f.personnelFieldName === fieldName || f.fieldName === fieldName);
    if (!fieldMeta) return null;

    const values = getDropdownValues(fieldMeta.fieldName);

    return (
      <div className={className}>
        <label className="form-label">{label || fieldMeta.displayName} {required && <span className="required">*</span>}</label>
        <select 
          className="form-select" 
          name={fieldMeta.personnelFieldName || fieldMeta.fieldName} 
          value={form[fieldMeta.personnelFieldName || fieldMeta.fieldName] || ''} 
          onChange={handleChange}
          required={required}
        >
          <option value="">Select</option>
          {values.map(v => (
            <option key={v.id} value={v.value}>{v.value}</option>
          ))}
        </select>
      </div>
    );
  };

  // Identify fields that are already rendered in specific sections
  const standardFields = [
    'rank', 'gender', 'serviceType', 'serviceStatus', 'cadre', 'religion', 'caste', 'category'
  ];
  
  const customMasterFields = masterFields.filter(f => 
    !standardFields.includes(f.fieldName) && !standardFields.includes(f.personnelFieldName)
  );

  // Field Renderer Logic
  const renderField = (fieldId) => {
    // Special Photo + Name Block
    if (fieldId === 'photo_and_name_block') {
      return (
        <div key="photo_block" style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem', alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0 }}>
            <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>Personnel Photo</label>
            <div className="photo-upload-container">
              {photoPreview || form.photoURL ? (
                <div style={{ position: 'relative' }}>
                  <img src={photoPreview || form.photoURL} alt="Preview" className="photo-preview-large" />
                  {!isView && <button type="button" className="photo-remove-btn" onClick={removePhoto}><X size={14} /></button>}
                </div>
              ) : (
                <label className={`photo-placeholder-large ${isView ? '' : 'cursor-pointer'}`}>
                  {!isView && <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />}
                  <Camera size={32} />
                  <span>{isView ? 'No Photo' : 'Upload Photo'}</span>
                </label>
              )}
            </div>
          </div>
          <div style={{ flexGrow: 1 }}>
            <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group">
                <label className="form-label">Full Name <span className="required">*</span></label>
                <input className="form-input" name="fullName" value={form.fullName} onChange={handleChange} placeholder="Enter full name" readOnly={isView} />
              </div>
              <div className="form-group">
                <label className="form-label">Father's Name</label>
                <input className="form-input" name="fatherName" value={form.fatherName} onChange={handleChange} placeholder="Enter father's name" readOnly={isView} />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Standard Fields
    switch (fieldId) {
      case 'dateOfBirth': return <div key={fieldId} className="form-group"><label className="form-label">Date of Birth</label><input className="form-input" type="date" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;
      case 'gender': return <DynamicDropdown key={fieldId} fieldName="gender" label="Gender" />;
      case 'bloodGroup': return (
        <div key={fieldId} className="form-group">
          <label className="form-label">Blood Group</label>
          <select className="form-select" name={fieldId} value={form[fieldId]} onChange={handleChange} disabled={isView}>
            <option value="">Select</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
          </select>
        </div>
      );
      case 'mobileNumber': return <div key={fieldId} className="form-group"><label className="form-label">Mobile Number <span className="required">*</span></label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} placeholder="10-digit mobile" type="tel" readOnly={isView} /></div>;
      case 'alternateContact': return <div key={fieldId} className="form-group"><label className="form-label">Alternate Contact</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} type="tel" readOnly={isView} /></div>;
      case 'payCode': return <div key={fieldId} className="form-group"><label className="form-label">Pay Code <span className="form-hint">(Auto-fills from Mobile)</span></label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} placeholder="Pay Code" readOnly={isView} /></div>;
      case 'religion': return <DynamicDropdown key={fieldId} fieldName="religion" label="Religion" />;
      case 'caste': return <DynamicDropdown key={fieldId} fieldName="caste" label="Caste" />;
      case 'category': return <DynamicDropdown key={fieldId} fieldName="category" label="Category" />;
      case 'aadharNumber': return <div key={fieldId} className="form-group"><label className="form-label">Aadhar Number</label><input className="form-input" name={fieldId} value={isView ? maskAadhar(form[fieldId]) : form[fieldId]} onChange={handleChange} placeholder="XXXX-XXXX-XXXX" disabled={isView} /></div>;
      case 'pan': return <div key={fieldId} className="form-group"><label className="form-label">PAN</label><input className="form-input" name={fieldId} value={isView ? maskPAN(form[fieldId]) : form[fieldId]} onChange={handleChange} disabled={isView} /></div>;
      case 'village': return <div key={fieldId} className="form-group"><label className="form-label">Village / Town</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} placeholder="e.g. Village Name" readOnly={isView} /></div>;
      case 'policeStation': return <div key={fieldId} className="form-group"><label className="form-label">Police Station (Home / Native)</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} placeholder="e.g. PS Sadar RTK" readOnly={isView} /></div>;
      case 'homeDistrict': return <div key={fieldId} className="form-group"><label className="form-label">Home District (Origin)</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} placeholder="e.g. Hisar" readOnly={isView} /></div>;
      
      case 'graduationDegree': return (
        <div key={fieldId} className="form-group">
          <label className="form-label">Graduation Degree or Below</label>
          <select className="form-select" name={fieldId} value={form[fieldId]} onChange={handleChange} disabled={isView}>
            <option value="">Select</option>
            {['8th or Below', '10th / Matric', '12th / Inter', 'BA', 'BSc', 'BCom', 'BCA', 'BTech / BE', 'BBA', 'Other Graduation'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      );
      case 'subjectGraduation': return <div key={fieldId} className="form-group"><label className="form-label">Subject (Graduation)</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} placeholder="e.g. Physics, Hindi" readOnly={isView} /><small style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>Comma separated</small></div>;
      case 'pgDegree': return (
        <div key={fieldId} className="form-group">
          <label className="form-label">Post Graduation Degree or Above</label>
          <select className="form-select" name={fieldId} value={form[fieldId]} onChange={handleChange} disabled={isView}>
            <option value="">Select</option>
            {['MA', 'MSc', 'MCom', 'MCA', 'MTech / ME', 'MBA', 'LLB / LLM', 'PhD', 'Other PG'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      );
      case 'subjectPostGraduation': return <div key={fieldId} className="form-group"><label className="form-label">Subject (Post Graduation)</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} placeholder="e.g. Economics, IT" readOnly={isView} /><small style={{ color: 'var(--gray-500)', fontSize: '0.75rem' }}>Comma separated</small></div>;
      case 'swatAwtCourse': return <div key={fieldId} className="form-group"><label className="form-label">SWAT/AWT Course</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;
      case 'specialCourse': return <div key={fieldId} className="form-group"><label className="form-label">Special Course</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;
      case 'promotionType': return <div key={fieldId} className="form-group"><label className="form-label">Promotion Type</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;

      case 'rank': return <DynamicDropdown key={fieldId} fieldName="rank" label="Rank" required />;
      case 'beltNumber': return <div key={fieldId} className="form-group"><label className="form-label">Belt Number</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} placeholder="e.g. 1234" readOnly={isView} /></div>;
      case 'cadre': return <DynamicDropdown key={fieldId} fieldName="cadre" label="Cadre" />;
      case 'serviceType': return <DynamicDropdown key={fieldId} fieldName="serviceType" label="Service Type" />;
      case 'serviceStatus': return <DynamicDropdown key={fieldId} fieldName="serviceStatus" label="Service Status" />;
      case 'serviceBookNumber': return <div key={fieldId} className="form-group"><label className="form-label">Service Book Number</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;
      case 'dateOfEnlistment': return <div key={fieldId} className="form-group"><label className="form-label">Date of Enlistment</label><input className="form-input" type="date" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;
      case 'dateOfLastPromotion': return <div key={fieldId} className="form-group"><label className="form-label">Date of Last Promotion</label><input className="form-input" type="date" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;
      case 'retirementDate': return <div key={fieldId} className="form-group"><label className="form-label">Retirement Date</label><input className="form-input" type="date" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;

      case 'stateId': return (
        <div key={fieldId} className="form-group">
          <label className="form-label">State</label>
          {!isSuperAdmin ? (
            <input className="form-input" disabled value={user?.stateName || ''} title="Auto-filled from your hierarchy" />
          ) : (
            <select className="form-select" name="stateId" value={form.stateId} onChange={handleChange} disabled={isView}>
              <option value="">Select State</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.stateName}</option>)}
            </select>
          )}
        </div>
      );
      case 'rangeId': return (
        <div key={fieldId} className="form-group">
          <label className="form-label">Range</label>
          {(!isSuperAdmin && !isStateAdmin) ? (
            <input className="form-input" disabled value={user?.rangeName || ''} title="Auto-filled from your hierarchy" />
          ) : (
            <select className="form-select" name="rangeId" value={form.rangeId} onChange={handleChange} disabled={isView || !form.stateId}>
              <option value="">Select Range</option>
              {ranges.map(r => <option key={r.id} value={r.id}>{r.rangeName}</option>)}
            </select>
          )}
        </div>
      );
      case 'districtId': return (
        <div key={fieldId} className="form-group">
          <label className="form-label">District</label>
          {(!isSuperAdmin && !isStateAdmin && !isRangeAdmin) ? (
            <input className="form-input" disabled value={user?.districtName || ''} title="Auto-filled from your hierarchy" />
          ) : (
            <select className="form-select" name="districtId" value={form.districtId} onChange={handleChange} disabled={isView || (!form.rangeId && !form.stateId)}>
              <option value="">Select District</option>
              {districts.map(d => <option key={d.id} value={d.id}>{d.districtName}</option>)}
            </select>
          )}
        </div>
      );
      case 'unitType': return (
        <div key={fieldId} className="form-group">
          <label className="form-label">Unit Category</label>
          {(!isSuperAdmin && !isStateAdmin && !isRangeAdmin && !isDistrictAdmin) ? (
             <input className="form-input" disabled value={form.unitType || 'Fixed Category'} title="Auto-filled from your hierarchy" />
          ) : (
            <select className="form-select" name="unitType" value={form.unitType} onChange={handleChange} disabled={isView || !form.districtId}>
              <option value="">Select Category</option>
              {unitCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
      );
      case 'currentUnitId': return (
        <div key={fieldId} className="form-group">
          <label className="form-label">Unit</label>
          {(!isSuperAdmin && !isStateAdmin && !isRangeAdmin && !isDistrictAdmin) ? (
            <input className="form-input" disabled value={user?.unitName || ''} title="Auto-filled from your hierarchy" />
          ) : (
            <select className="form-select" name="currentUnitId" value={form.currentUnitId} onChange={handleChange} disabled={isView || !form.districtId || !form.unitType}>
              <option value="">{units.length === 0 && form.unitType ? 'No units found' : 'Select Unit'}</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.unitName}</option>)}
            </select>
          )}
        </div>
      );
      case 'currentSubUnitId': return (
        <div key={fieldId} className="form-group">
          <label className="form-label">Sub-Unit</label>
          <select className="form-select" name="currentSubUnitId" value={form.currentSubUnitId} onChange={handleChange} disabled={isView}>
            <option value="">{subUnits.length === 0 ? 'No sub-units found' : 'Select Sub-Unit'}</option>
            {subUnits.map(su => <option key={su.id} value={su.id}>{su.subUnitName}</option>)}
          </select>
        </div>
      );

      case 'psDutyType': return <div key={fieldId} className="form-group"><label className="form-label">PS Duty Type (Role 2)</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;
      case 'ioStatus': return <DynamicDropdown key={fieldId} fieldName="ioStatus" label="IO Status" />;
      case 'ioCategory': return <DynamicDropdown key={fieldId} fieldName="ioCategory" label="IO Category" />;
      case 'paradeGroup': return <DynamicDropdown key={fieldId} fieldName="paradeGroup" label="Parade Group" />;
      case 'spoTrade': return <DynamicDropdown key={fieldId} fieldName="spoTrade" label="SPO Trade" />;
      case 'company': return <div key={fieldId} className="form-group"><label className="form-label">Company</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;
      case 'dateOfPosting': return <div key={fieldId} className="form-group"><label className="form-label">Date of Posting</label><input className="form-input" type="date" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;
      case 'rBatch': return <div key={fieldId} className="form-group"><label className="form-label">R/BATCH</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;
      case 'tDutyOrder': return <div key={fieldId} className="form-group"><label className="form-label">T/DUTY ORDER</label><input className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} /></div>;
      case 'remarks': return <div key={fieldId} className="form-group"><label className="form-label">Remarks</label><textarea className="form-input" name={fieldId} value={form[fieldId]} onChange={handleChange} readOnly={isView} style={{ minHeight: '80px' }} /></div>;

      default:
        // Try looking up in customMasterFields
        const customField = customMasterFields.find(f => f.personnelFieldName === fieldId || f.fieldName === fieldId);
        if (customField) return <DynamicDropdown key={fieldId} fieldName={customField.fieldName} />;
        return null;
    }
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner spinner-lg" style={{ margin: '0 auto' }}></div>
        <p>Loading personnel data...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/personnel')}>
            <ArrowLeft size={20} />
          </button>
          <h2>{isEdit ? 'Edit Personnel' : (isView ? 'Personnel Details' : 'Add New Personnel')}</h2>
        </div>
        {isView && (
          <button className="btn btn-secondary" onClick={() => navigate(`/personnel/${id}/edit`)}>
            <Edit size={16} /> Edit Record
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {layout.map((section) => (
          <div key={section.id} className="panel" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="panel-header"><h3>{section.title}</h3></div>
            <div className="panel-body">
              {/* Special Handling for Sections that don't use standard grid */}
              {section.id === 'personal' ? (
                <>
                  {renderField('photo_and_name_block')}
                  <div className="form-row">
                    {section.fields.filter(fid => fid !== 'photo_and_name_block').map(fid => renderField(fid))}
                  </div>
                </>
              ) : (
                <div className="form-row">
                  {section.fields.map(fid => renderField(fid))}
                </div>
              )}
            </div>
          </div>
        ))}


        {/* Submit */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginBottom: 40 }}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/personnel')}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? <><span className="spinner" style={{ width: 16, height: 16 }}></span> Saving...</> : <><Save size={18} /> {isEdit ? 'Update' : 'Save'} Personnel</>}
          </button>
        </div>
      </form>
    </div>
  );
}

