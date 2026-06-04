import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, ArrowLeft, ArrowRight, Check,
  AlertTriangle, Download, X, ChevronRight
} from 'lucide-react';

// System fields that can be mapped
const SYSTEM_FIELDS = [
  { key: 'beltNumber', label: 'Belt Number', required: false },
  { key: 'payCode', label: 'Pay Code', required: false },
  { key: 'fullName', label: 'Full Name', required: true },
  { key: 'fatherName', label: "Father's Name", required: false },
  { key: 'rank', label: 'Rank', required: true },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'dateOfBirth', label: 'Date of Birth', required: false },
  { key: 'religion', label: 'Religion', required: false },
  { key: 'caste', label: 'Caste', required: false },
  { key: 'category', label: 'Category (Gen/OBC/SC/ST)', required: false },
  { key: 'cadre', label: 'Cadre', required: false },
  { key: 'serviceType', label: 'Service Type', required: false },
  { key: 'serviceBookNumber', label: 'Service Book Number', required: false },
  { key: 'dateOfEnlistment', label: 'Date of Enlistment', required: false },
  { key: 'dateOfLastPromotion', label: 'Date of Last Promotion', required: false },
  { key: 'retirementDate', label: 'Retirement Date', required: false },
  { key: 'village', label: 'Village / Town', required: false },
  { key: 'policeStation', label: 'Police Station (Home / Native)', required: false },
  { key: 'homeDistrict', label: 'Home District', required: false },
  { key: 'bloodGroup', label: 'Blood Group', required: false },
  { key: 'mobileNumber', label: 'Mobile Number', required: true },
  { key: 'alternateContact', label: 'Alternate Contact', required: false },
  { key: 'aadharNumber', label: 'Aadhar Number', required: false },
  { key: 'pan', label: 'PAN', required: false },
  { key: 'serviceStatus', label: 'Service Status', required: false },
  { key: 'ioStatus', label: 'IO Status', required: false },
  { key: 'ioCategory', label: 'IO Category', required: false },
  { key: 'paradeGroup', label: 'Parade Group', required: false },
  { key: 'spoTrade', label: 'SPO Trade', required: false },
  { key: 'psDutyType', label: 'PS Duty Type (Role 2)', required: false },
  { key: 'homeDistrictPS', label: 'Home District PS', required: false },
  { key: 'promotionType', label: 'Promotion Type', required: false },
  { key: 'specialCourse', label: 'Special Course', required: false },
  { key: 'company', label: 'Company', required: false },
  { key: 'stateId', label: 'State Name', required: false },
  { key: 'rangeId', label: 'Range Name', required: false },
  { key: 'districtId', label: 'District Name', required: false },
  { key: 'unitType', label: 'Unit Category', required: false },
  { key: 'currentUnitId', label: 'Unit Name', required: false },
  { key: 'currentSubUnitId', label: 'Sub-Unit Name', required: false },
  { key: 'graduationDegree', label: 'Graduation Degree or Below', required: false },
  { key: 'subjectGraduation', label: 'Subject (Graduation)', required: false },
  { key: 'pgDegree', label: 'Post Graduation Degree or Above', required: false },
  { key: 'subjectPostGraduation', label: 'Subject (Post Graduation)', required: false },
  { key: 'swatAwtCourse', label: 'SWAT/AWT Course', required: false },
  { key: 'rBatch', label: 'R/BATCH', required: false },
  { key: 'tDutyOrder', label: 'T/DUTY ORDER', required: false },
  { key: 'dateOfPosting', label: 'Date of Posting', required: false },
  { key: 'remarks', label: 'Remarks', required: false },
];

const STEPS = ['Upload File', 'Map Fields', 'Validate', 'Import'];

// Date fields that need format conversion
const DATE_FIELDS = ['dateOfBirth', 'dateOfEnlistment', 'dateOfLastPromotion', 'retirementDate', 'dateOfPosting'];

/**
 * Converts various date formats to yyyy-mm-dd for DB storage.
 * Handles: DD.MM.YY, DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY, Excel serial numbers, ISO strings.
 */
function parseExcelDate(value) {
  if (!value) return null;
  const str = String(value).trim();

  // ISO datetime with timezone e.g. "1984-05-12T00:00:00.000Z" (XLSX cellDates:true output)
  const isoFull = str.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoFull) return isoFull[1];

  // Already ISO date yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Excel serial number (numeric, 4-5 digits)
  if (/^\d{4,5}$/.test(str)) {
    const d = new Date((parseInt(str) - 25569) * 86400 * 1000);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }

  // DD.MM.YY or DD.MM.YYYY
  const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (dotMatch) {
    let [, dd, mm, yy] = dotMatch;
    if (yy.length === 2) yy = parseInt(yy) <= 30 ? '20' + yy : '19' + yy;
    return `${yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dashMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2}|\d{4})$/);
  if (dashMatch) {
    let [, dd, mm, yy] = dashMatch;
    if (yy.length === 2) yy = parseInt(yy) <= 30 ? '20' + yy : '19' + yy;
    return `${yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
  }

  // Try native Date parse as last resort
  const d = new Date(str);
  if (!isNaN(d)) return d.toISOString().split('T')[0];

  return null; // unparseable
}

// Smart auto-mapping of columns to system fields
function autoMap(fileColumns) {
  const mapping = {};
  const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const ALIASES = {
    fullName: ['name', 'fullname', 'personnelname', 'employeename', 'officername'],
    fatherName: ['fathername', 'father', 'fathersname'],
    beltNumber: ['beltnumber', 'beltno', 'belt', 'no'],
    payCode: ['paycode', 'payid', 'employeeid', 'empid', 'empcode'],
    rank: ['rank', 'designation', 'post'],
    mobileNumber: ['mobile', 'mobilenumber', 'phone', 'phonenumber', 'contact', 'mobileno'],
    gender: ['gender', 'sex'],
    dateOfBirth: ['dob', 'd.o.b', 'dateofbirth', 'birthdate', 'dateofbirth', 'birth'],
    religion: ['religion'],
    caste: ['caste'],
    category: ['category', 'reservation', 'cat'],
    cadre: ['cadre'],
    serviceType: ['servicetype', 'type', 'permanenttemporary', 'permanenttemporarywithorwithoutorder', 'permanent', 'temporary', 'appointmenttype'],
    dateOfEnlistment: ['doe', 'd.o.e', 'dateofenlistment', 'joiningdate', 'doj', 'enlistment'],
    dateOfLastPromotion: ['lastpromotion', 'promotiondate', 'dateoflastpromotion', 'dolp'],
    retirementDate: ['retirementdate', 'dor', 'retirement', 'dateofretirement'],
    village: ['village', 'town', 'address'],
    policeStation: ['policestation', 'ps', 'thana', 'homeps', 'nativeps', 'homepolicestation'],
    homeDistrict: ['homedistrict', 'district'],
    bloodGroup: ['bloodgroup', 'blood'],
    alternateContact: ['alternatecontact', 'altcontact'],
    aadharNumber: ['aadhar', 'aadharnumber', 'uid'],
    ioStatus: ['iostatus', 'io'],
    psDutyType: ['psdutytype', 'role2', 'dutytype'],
    homeDistrictPS: ['homedistrictps', 'pshomedistrict'],
    company: ['company', 'coy'],
    remarks: ['remarks', 'remark', 'note', 'notes'],
    stateId: ['state', 'statename'],
    rangeId: ['range', 'rangename'],
    districtId: ['district', 'districtname', 'currentdistrict'],
    unitType: ['unittype', 'unitcategory'],
    currentUnitId: ['unit', 'unitname', 'currentunit'],
    currentSubUnitId: ['subunit', 'subunitname', 'currentsubunit'],
    graduationDegree: ['graduationorbelow', 'graduationbelow', 'graduation', 'degree', 'educationlevel', 'qualificationlevel'],
    subjectGraduation: ['gradsubject', 'subjectgraduation', 'subject'],
    pgDegree: ['postgraduationandabove', 'postgraduationabove', 'postgrad', 'pgdegree', 'pgqualification'],
    subjectPostGraduation: ['pgsubject', 'subjectpostgraduation', 'subject2subjects', 'subject2'],
    swatAwtCourse: ['swat', 'awt', 'swatawtcourse'],
    rBatch: ['rbatch', 'batch'],
    tDutyOrder: ['tdutyorder', 'dutyorder'],
    dateOfPosting: ['postingdate', 'dateofposting'],
  };

  fileColumns.forEach(col => {
    const norm = normalise(col);
    for (const [sysKey, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(norm) || norm.includes(aliases[0])) {
        if (!Object.values(mapping).includes(sysKey)) {
          mapping[col] = sysKey;
          break;
        }
      }
    }
  });

  return mapping;
}

export default function ExcelImport() {
  const navigate = useNavigate();
  const { user, isSuperAdmin, isStateAdmin, isRangeAdmin, isDistrictAdmin } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [fileColumns, setFileColumns] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [mapping, setMapping] = useState({});
  const [validationResults, setValidationResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [customMasterFields, setCustomMasterFields] = useState([]);
  const [hierarchyMaps, setHierarchyMaps] = useState({
    states: {}, ranges: {}, districts: {}, categories: [], units: {}, subUnits: {}
  });

  const normalizeName = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');

  // Fetch all hierarchy data for mapping names to IDs
  useEffect(() => {
    async function fetchHierarchy() {
      try {
        const [sRes, rRes, dRes, cRes, uRes, suRes] = await Promise.all([
          api.hierarchy.states(),
          api.hierarchy.ranges(),
          api.hierarchy.districts(),
          api.hierarchy.unitCategories(),
          api.hierarchy.units(),
          api.hierarchy.subUnits()
        ]);

        const maps = {
          states: {}, ranges: {}, districts: {}, categories: [], units: {}, subUnits: {}
        };

        (sRes || []).forEach(d => { maps.states[normalizeName(d.name)] = d.id; });
        (rRes || []).forEach(d => { maps.ranges[normalizeName(d.name)] = d.id; });
        (dRes || []).forEach(d => { maps.districts[normalizeName(d.name)] = d.id; });
        maps.categories = (cRes || []).map(d => normalizeName(d.name || d));
        (uRes || []).forEach(d => { maps.units[normalizeName(d.name)] = d.id; });
        (suRes || []).forEach(d => { maps.subUnits[normalizeName(d.name)] = d.id; });

        setHierarchyMaps(maps);
      } catch (err) {
        if (import.meta.env.DEV) console.error('Failed to fetch hierarchy for mapping:', err);
      }
    }
    fetchHierarchy();
  }, []);

  // Load custom master data fields to extend the importable field list
  useEffect(() => {
    if (!user?.stateId) return;
    async function loadMasterFields() {
      try {
        const fields = await api.admin.fieldTypes(user.stateId);
        
        const personnelFields = (fields || []).filter(f => f.personnel_field_name);
        setCustomMasterFields(personnelFields.map(f => ({
          ...f,
          personnelFieldName: f.personnel_field_name,
          displayName: f.display_name
        })));
      } catch (err) {
        if (import.meta.env.DEV) console.error('Failed to load dropdown master fields for import:', err);
      }
    }
    loadMasterFields();
  }, [user]);

  // Effective fields = standard system fields + any custom master data fields not already listed
  const effectiveFields = useMemo(() => {
    const standardKeys = new Set(SYSTEM_FIELDS.map(f => f.key));
    const dynamicExtras = customMasterFields
      .filter(mf => !standardKeys.has(mf.personnelFieldName))
      .map(mf => ({ key: mf.personnelFieldName, label: mf.displayName, required: false, isDynamic: true }));
    return [...SYSTEM_FIELDS, ...dynamicExtras];
  }, [customMasterFields]);

  // Step 1: File Upload
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(file.type) && !['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        
        // Convert to JSON, but ensure dates from cells are usable
        // raw: false will use the dateNF format specified above for date cells
        const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

        if (json.length === 0) {
          toast.error('The file is empty or has no data rows.');
          return;
        }

        const cols = Object.keys(json[0]);
        setFileColumns(cols);
        setRawData(json);

        // Auto-map columns
        const autoMapping = autoMap(cols);
        setMapping(autoMapping);

        setStep(1);
        toast.success(`File loaded: ${json.length} rows, ${cols.length} columns detected.`);
      } catch (err) {
        console.error('Parse error:', err);
        toast.error('Failed to parse the file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const input = fileInputRef.current;
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      handleFileUpload({ target: { files: dt.files } });
    }
  }, [handleFileUpload]);

  // Step 2: Mapping change
  function handleMappingChange(fileCol, sysField) {
    setMapping(prev => {
      const next = { ...prev };
      // Remove previous mapping for this system field (prevent duplicates)
      for (const key of Object.keys(next)) {
        if (next[key] === sysField && key !== fileCol) {
          delete next[key];
        }
      }
      if (sysField === '') {
        delete next[fileCol];
      } else {
        next[fileCol] = sysField;
      }
      return next;
    });
  }

  // Step 3: Validate
  function runValidation() {
    const errors = [];
    const warnings = [];
    const validRows = [];

    const requiredFields = effectiveFields.filter(f => f.required).map(f => f.key);
    const mappedFields = Object.entries(mapping);

    rawData.forEach((row, idx) => {
      const rowNum = idx + 2; // Excel row (1-indexed header)
      const mapped = {};
      let rowErrors = [];

      mappedFields.forEach(([fileCol, sysKey]) => {
        const value = String(row[fileCol] || '').trim();
        
        // Date field conversion — handles DD.MM.YY, DD.MM.YYYY, DD/MM/YYYY etc.
        if (DATE_FIELDS.includes(sysKey)) {
          const parsed = parseExcelDate(value);
          if (value && !parsed) {
            rowErrors.push(`Row ${rowNum}: Invalid date format "${value}" in field "${sysKey}" (use DD.MM.YYYY)`);
          } else {
            mapped[sysKey] = parsed;
          }
          return;
        }

        // Hierarchy Mapping Logic
        const hKey = normalizeName(value);
        if (sysKey === 'stateId' && value) {
          const id = hierarchyMaps.states[hKey];
          if (id) mapped[sysKey] = id;
          else rowErrors.push(`Row ${rowNum}: State '${value}' not found`);
        } else if (sysKey === 'rangeId' && value) {
          const id = hierarchyMaps.ranges[hKey];
          if (id) mapped[sysKey] = id;
          else rowErrors.push(`Row ${rowNum}: Range '${value}' not found`);
        } else if (sysKey === 'districtId' && value) {
          const id = hierarchyMaps.districts[hKey];
          if (id) mapped[sysKey] = id;
          else rowErrors.push(`Row ${rowNum}: District '${value}' not found`);
        } else if (sysKey === 'unitType' && value) {
          if (hierarchyMaps.categories.includes(hKey)) mapped[sysKey] = value; // Store the name for unitType
          else rowErrors.push(`Row ${rowNum}: Unit Category '${value}' not found`);
        } else if (sysKey === 'currentUnitId' && value) {
          const id = hierarchyMaps.units[hKey];
          if (id) mapped[sysKey] = id;
          else rowErrors.push(`Row ${rowNum}: Unit '${value}' not found`);
        } else if (sysKey === 'currentSubUnitId' && value) {
          const id = hierarchyMaps.subUnits[hKey];
          if (id) mapped[sysKey] = id;
          else rowErrors.push(`Row ${rowNum}: Sub-Unit '${value}' not found`);
        } else {
          mapped[sysKey] = value;
        }
      });

      // Check required fields
      requiredFields.forEach(reqKey => {
        if (!mapped[reqKey]) {
          rowErrors.push(`Row ${rowNum}: Missing required field "${effectiveFields.find(f => f.key === reqKey)?.label}"`);
        }
      });

      // Auto-fill payCode from mobileNumber if not mapped
      if (!mapped.payCode && mapped.mobileNumber) {
        mapped.payCode = mapped.mobileNumber;
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        validRows.push(mapped);
      }
    });

    // Check for duplicate mobile numbers
    const mobiles = validRows.map(r => r.mobileNumber).filter(Boolean);
    const duplicates = mobiles.filter((m, i) => mobiles.indexOf(m) !== i);
    if (duplicates.length > 0) {
      warnings.push(`${duplicates.length} duplicate mobile numbers found. They will still be imported.`);
    }

    // Create a display-friendly version of valid rows for the preview table
    const displayRows = validRows.slice(0, 10).map(row => {
      const display = { ...row };
      // Helper to find name by ID (reverse lookup for display)
      const findName = (map, id) => Object.entries(map).find(([name, mid]) => mid === id)?.[0] || id;
      
      if (row.stateId) display.stateId = findName(hierarchyMaps.states, row.stateId);
      if (row.rangeId) display.rangeId = findName(hierarchyMaps.ranges, row.rangeId);
      if (row.districtId) display.districtId = findName(hierarchyMaps.districts, row.districtId);
      if (row.currentUnitId) display.currentUnitId = findName(hierarchyMaps.units, row.currentUnitId);
      if (row.currentSubUnitId) display.currentSubUnitId = findName(hierarchyMaps.subUnits, row.currentSubUnitId);
      
      return display;
    });

    setValidationResults({ errors, warnings, validRows, displayRows, totalRows: rawData.length });
    setStep(2);
  }

  // Step 4: Import to Supabase using bulk insert
  async function startImport() {
    if (!validationResults?.validRows?.length) return;

    setImporting(true);
    setStep(3);

    let successCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errorRows = [];
    const BATCH_LIMIT = 500;
    const rows = validationResults.validRows;

    // Helper to map UI camelCase to DB snake_case
    const mapToPayload = (row) => ({
      belt_number: row.beltNumber || '',
      pay_code: row.payCode || '',
      full_name: row.fullName || '',
      father_name: row.fatherName || '',
      rank: row.rank || '',
      gender: row.gender || '',
      date_of_birth: row.dateOfBirth || null,
      religion: row.religion || '',
      caste: row.caste || '',
      category: row.category || '',
      cadre: row.cadre || '',
      service_type: row.serviceType || '',
      service_book_number: row.serviceBookNumber || '',
      date_of_enlistment: row.dateOfEnlistment || null,
      date_of_last_promotion: row.dateOfLastPromotion || null,
      retirement_date: row.retirementDate || null,
      village: row.village || '',
      police_station: row.policeStation || '',
      home_district: row.homeDistrict || '',
      blood_group: row.bloodGroup || '',
      mobile_number: row.mobileNumber || '',
      alternate_contact: row.alternateContact || '',
      aadhar_number: row.aadharNumber || '',
      pan: row.pan || '',
      service_status: row.serviceStatus || 'Active',
      io_status: row.ioStatus || '',
      io_category: row.ioCategory || '',
      parade_group: row.paradeGroup || '',
      spo_trade: row.spoTrade || '',
      ps_duty_type: row.psDutyType || '',
      home_district_ps: row.homeDistrictPS || '',
      promotion_type: row.promotionType || '',
      special_course: row.specialCourse || '',
      company: row.company || '',
      
      // node_id resolution — mirrors PersonnelForm submit logic exactly
      // Priority: subUnit > unit > district > range > state (most specific wins)
      node_id: (
        row.currentSubUnitId ||
        ((!isSuperAdmin && !isStateAdmin && !isRangeAdmin && !isDistrictAdmin)
          ? (user.unitId || null)
          : (row.currentUnitId || user.unitId || null)) ||
        ((!isSuperAdmin && !isStateAdmin && !isRangeAdmin)
          ? user.districtId
          : (row.districtId || user.districtId || null)) ||
        ((!isSuperAdmin && !isStateAdmin)
          ? user.rangeId
          : (row.rangeId || user.rangeId || null)) ||
        (!isSuperAdmin ? user.stateId : (row.stateId || null)) ||
        null
      ),
      
      subject_graduation: row.subjectGraduation || '',
      graduation_degree: row.graduationDegree || '',
      subject_post_graduation: row.subjectPostGraduation || '',
      pg_degree: row.pgDegree || '',
      swat_awt_course: row.swatAwtCourse || '',
      r_batch: row.rBatch || '',
      t_duty_order: row.tDutyOrder || '',
      date_of_posting: row.dateOfPosting || null,
      remarks: row.remarks || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by_user_id: user.id || null
    });

    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_LIMIT) {
      const chunk = rows.slice(batchStart, batchStart + BATCH_LIMIT).map(mapToPayload);
      
      try {
        const results = await Promise.all(chunk.map(c => api.personnel.upsert(c)));
        results.forEach(r => {
          if (r?._action === 'updated') updatedCount++;
          else successCount++;
        });
      } catch (err) {
        errorCount += chunk.length;
        errorRows.push({ row: batchStart + 1, error: `Batch import failed: ${err.message}` });
        if (import.meta.env.DEV) console.error('Bulk import error:', err);
      }
    }

    setImportResults({ successCount, updatedCount, errorCount, errorRows });
    setImporting(false);
    toast.success(`Import complete: ${successCount} new, ${updatedCount} updated.`);
  }

  function resetImport() {
    setStep(0);
    setFileName('');
    setFileColumns([]);
    setRawData([]);
    setMapping({});
    setValidationResults(null);
    setImportResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/personnel')}>
            <ArrowLeft size={20} />
          </button>
          <h2>Import Personnel from Excel / CSV</h2>
        </div>
      </div>

      {/* Step Progress */}
      <div className="step-progress">
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
            <div className={`step-item ${step === i ? 'active' : step > i ? 'completed' : ''}`}>
              <div className="step-circle">
                {step > i ? <Check size={14} /> : i + 1}
              </div>
              <span style={{ display: 'inline-block', minWidth: 70 }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`step-connector ${step > i ? 'completed' : ''}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Upload */}
      {step === 0 && (
        <div className="panel">
          <div className="panel-body" style={{ padding: 40 }}>
            <div
              className="file-upload-area"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <FileSpreadsheet className="icon" size={40} />
              <h4>Drop your Excel or CSV file here</h4>
              <p>or click to browse — Supports .xlsx, .xls, .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Mapping */}
      {step === 1 && (
        <div className="panel">
          <div className="panel-header">
            <h3>Map File Columns to System Fields</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
              {rawData.length} rows • {fileColumns.length} columns • File: {fileName}
            </span>
          </div>
          <div className="panel-body">
            <p style={{ marginBottom: 16, color: 'var(--gray-500)', fontSize: '0.85rem' }}>
              We've auto-detected some mappings. Review and adjust as needed. Fields marked <span style={{ color: 'var(--danger-500)' }}>*</span> are required.
            </p>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Your File Column</th>
                    <th style={{ textAlign: 'center' }}>→</th>
                    <th>System Field</th>
                    <th>Sample Data</th>
                  </tr>
                </thead>
                <tbody>
                  {fileColumns.map(col => {
                    const mapped = mapping[col] || '';
                    const sampleVal = rawData[0]?.[col] || '';
                    return (
                      <tr key={col}>
                        <td style={{ fontWeight: 600 }}>{col}</td>
                        <td style={{ textAlign: 'center', color: 'var(--gray-400)' }}>
                          <ChevronRight size={16} />
                        </td>
                        <td>
                          <select
                            className="form-select"
                            value={mapped}
                            onChange={(e) => handleMappingChange(col, e.target.value)}
                            style={{ minWidth: 200 }}
                          >
                            <option value="">— Skip this column —</option>
                            {effectiveFields.map(sf => {
                              const alreadyMapped = Object.values(mapping).includes(sf.key) && mapping[col] !== sf.key;
                              return (
                                <option key={sf.key} value={sf.key} disabled={alreadyMapped}>
                                  {sf.label} {sf.required ? '*' : ''} {alreadyMapped ? '(mapped)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td style={{ color: 'var(--gray-400)', fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {String(sampleVal).substring(0, 60)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel-footer" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={resetImport}>Cancel</button>
            <button className="btn btn-primary" onClick={runValidation}>
              <ArrowRight size={16} /> Validate Data
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Validation results */}
      {step === 2 && validationResults && (
        <div className="panel">
          <div className="panel-header">
            <h3>Validation Results</h3>
          </div>
          <div className="panel-body">
            <div className="stats-bar" style={{ marginBottom: 20 }}>
              <div className="stat-widget">
                <div className="stat-widget-icon blue"><FileSpreadsheet size={20} /></div>
                <div className="stat-widget-data">
                  <h3>{validationResults.totalRows}</h3>
                  <p>Total Rows</p>
                </div>
              </div>
              <div className="stat-widget">
                <div className="stat-widget-icon green"><Check size={20} /></div>
                <div className="stat-widget-data">
                  <h3>{validationResults.validRows.length}</h3>
                  <p>Ready to Import</p>
                </div>
              </div>
              <div className="stat-widget">
                <div className="stat-widget-icon red"><AlertTriangle size={20} /></div>
                <div className="stat-widget-data">
                  <h3>{validationResults.errors.length}</h3>
                  <p>Errors</p>
                </div>
              </div>
            </div>

            {validationResults.warnings.length > 0 && (
              <div style={{ background: 'var(--warning-50)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.85rem', color: 'var(--warning-600)' }}>
                {validationResults.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
              </div>
            )}

            {/* NEW: Data Preview Table */}
            {validationResults.displayRows?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ marginBottom: 12, fontSize: '0.9rem', color: 'var(--gray-700)' }}>Data Preview (First 10 Rows)</h4>
                <div className="table-container" style={{ maxHeight: 300, border: '1px solid var(--gray-200)', borderRadius: 8 }}>
                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--gray-50)', zIndex: 1 }}>
                      <tr>
                        <th>#</th>
                        <th>Full Name</th>
                        <th>Rank</th>
                        <th>District</th>
                        <th>Unit</th>
                        <th>Sub-Unit</th>
                        <th>Pay Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationResults.displayRows.map((row, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td style={{ fontWeight: 600 }}>{row.fullName}</td>
                          <td>{row.rank}</td>
                          <td>{row.districtId || '-'}</td>
                          <td>{row.currentUnitId || '-'}</td>
                          <td>{row.currentSubUnitId || '-'}</td>
                          <td>{row.payCode}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {validationResults.errors.length > 0 && (
              <div style={{ maxHeight: 200, overflow: 'auto', background: 'var(--danger-50)', padding: 12, borderRadius: 8, fontSize: '0.8rem', color: 'var(--danger-700)' }}>
                {validationResults.errors.slice(0, 20).map((e, i) => <p key={i}>❌ {e}</p>)}
                {validationResults.errors.length > 20 && <p>...and {validationResults.errors.length - 20} more errors</p>}
              </div>
            )}
          </div>
          <div className="panel-footer" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Back to Mapping
            </button>
            <button
              className="btn btn-success"
              disabled={validationResults.validRows.length === 0}
              onClick={startImport}
            >
              <Upload size={16} /> Import {validationResults.validRows.length} Records
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Import progress / results */}
      {step === 3 && (
        <div className="panel">
          <div className="panel-header"><h3>Import Results</h3></div>
          <div className="panel-body" style={{ textAlign: 'center', padding: 40 }}>
            {importing ? (
              <>
                <div className="spinner spinner-lg" style={{ margin: '0 auto 16px' }}></div>
                <p style={{ color: 'var(--gray-500)' }}>Importing records... Please wait.</p>
              </>
            ) : importResults ? (
              <>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Check size={32} color="var(--success-600)" />
                </div>
                <h3 style={{ marginBottom: 8 }}>Import Complete!</h3>
                <p style={{ color: 'var(--gray-500)', marginBottom: 20 }}>
                  <strong>{importResults.successCount}</strong> new records created.
                  {importResults.updatedCount > 0 && <><br /><span style={{ color: 'var(--primary-600)' }}><strong>{importResults.updatedCount}</strong> existing records updated.</span></>}
                  {importResults.errorCount > 0 && <><br /><span style={{ color: 'var(--danger-500)' }}>{importResults.errorCount} records failed.</span></>}
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button className="btn btn-secondary" onClick={resetImport}>Import More</button>
                  <button className="btn btn-primary" onClick={() => navigate('/personnel')}>View Personnel</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
