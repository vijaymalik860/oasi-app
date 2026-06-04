import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, Edit2, ClipboardList, Clock, MapPin } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../contexts/ToastContext';

const CHITTHA_SECTIONS = [
  { id: 'sec_sho', title: '1. SHO', mandatory: true },
  { id: 'sec_investigation', title: '2. Investigation Staff', mandatory: true },
  { id: 'sec_mhc', title: '3. MHC Staff', mandatory: true },
  { id: 'sec_mm', title: '4. MM Staff', mandatory: true },
  { id: 'sec_sho_mobile', title: '5. SHO Mobile', mandatory: true },
  { id: 'sec_erv', title: '6. ERV (Emergency Response)', mandatory: false },
  { id: 'sec_rider', title: '7. Rider / Patrol', mandatory: false },
  { id: 'sec_general_duty', title: '8. General Duty', mandatory: true },
  { id: 'sec_groupd_staff', title: '9. Group-D Staff', mandatory: true },
  { id: 'sec_leave_rest', title: '10. Leave / Weekly Rest', mandatory: true },
  { id: 'sec_unallocated', title: '11. Unallocated', mandatory: true }
];

export default function ChitthaPrintView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [chittha, setChittha] = useState(null);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    try {
      setLoading(true);
      
      const chData = await api.chitthas.get(id);

      if (chData) {
        // Compute assignments
        const mappedAssignments = (chData.assignments || []).map(a => ({
          personnelName: a.full_name || a.personnel_name,
          personnelRank: a.rank || a.personnel_rank,
          personnelBelt: a.belt_number || a.personnel_belt,
          personnelMobile: a.personnel_mobile || '—',
          sectionId: a.section_name || a.section_id,
          dutyPoint: a.duty_location || a.duty_point,
          remarks: a.remark_text || a.remarks,
          ...a
        }));

        // Compute Head Summary
        const headSummary = [
          { headName: 'Inspector', total: 0, absent: 0, leave: 0, present: 0 },
          { headName: 'Sub-Inspector', total: 0, absent: 0, leave: 0, present: 0 },
          { headName: 'ASI', total: 0, absent: 0, leave: 0, present: 0 },
          { headName: 'Head Constable', total: 0, absent: 0, leave: 0, present: 0 },
          { headName: 'Constable', total: 0, absent: 0, leave: 0, present: 0 },
          { headName: 'SPO / Volunteer', total: 0, absent: 0, leave: 0, present: 0 },
          { headName: 'Group-D', total: 0, absent: 0, leave: 0, present: 0 },
          { headName: 'Other / Unspecified', total: 0, absent: 0, leave: 0, present: 0 },
        ];

        // Basic calculation based on mapped assignments
        mappedAssignments.forEach(a => {
          let hIndex = -1;
          const r = (a.personnelRank || '').toLowerCase();
          
          if (r.includes('insp') && !r.includes('sub')) hIndex = 0;
          else if (r.includes('sub-insp') || r === 'si') hIndex = 1;
          else if (r.includes('asi')) hIndex = 2;
          else if (r.includes('head const') || r === 'hc' || r === 'ehc') hIndex = 3;
          else if (r.includes('constable') || r === 'ct' || r === 'epc') hIndex = 4;
          else if (r.includes('spo') || r.includes('vol')) hIndex = 5;
          else if (r.includes('group') || r.includes('sweeper') || r.includes('peon') || r.includes('cook')) hIndex = 6;
          else hIndex = 7; // Other / Unspecified
          
          if (hIndex > -1) {
             headSummary[hIndex].total += 1;
             if (a.sectionId === 'sec_leave_rest') headSummary[hIndex].leave += 1;
             else headSummary[hIndex].present += 1; // Assuming others are present for now
          }
        });

        setChittha({
          id: chData.id,
          chitthaDate: chData.chittha_date,
          dateLabel: chData.date_label || 'Final Roster',
          headSummary: headSummary,
          sectionConfigs: CHITTHA_SECTIONS,
          unitName: chData.unit_name || 'Unknown Unit',
          districtName: chData.district_name || 'Rohtak', // Fallback since it's Rohtak range
          ...chData
        });

        setAssignments(mappedAssignments);
      } else {
        toast.error('Roster not found');
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      toast.error('Failed to load roster data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="spinner-container"><div className="spinner"></div></div>;
  if (!chittha) return <div className="empty-state">Roster not found</div>;

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="chittha-print-page">
      {/* Top Bar (Hidden in Print) */}
      <div className="no-print print-header-actions">
        <button className="btn btn-secondary" onClick={() => navigate('/chitthas')}>
          <ArrowLeft size={18} /> Back Dashboard
        </button>
        <div style={{ display: 'flex', gap: 12 }}>
           <button className="btn btn-primary" onClick={() => navigate(`/chitthas/edit/${id}`)}>
             <Edit2 size={18} /> Edit Roster
           </button>
           <button className="btn btn-gold" onClick={() => window.print()}>
             <Printer size={18} /> Print Now
           </button>
        </div>
      </div>
      
      {/* Actual Print Document */}
      <div className="print-container">
        <div className="document-header">
          <div className="header-top">
            <h1 className="district-name">HARYANA POLICE — {chittha.districtName || 'HISAR'}</h1>
            <h2 className="unit-title">{chittha.unitName}</h2>
          </div>
          <div className="roster-meta">
            <div className="meta-item">
              <ClipboardList size={16} />
              <span><strong>DAILY DUTY ROSTER (NAUKARI CHITTHA)</strong></span>
            </div>
            <div className="meta-item">
              <Clock size={16} />
              <span><strong>DATE:</strong> {formatDate(chittha.chitthaDate)} {chittha.dateLabel && `(${chittha.dateLabel})`}</span>
            </div>
          </div>
        </div>

        {/* Head-wise Summary */}
        <section className="print-section">
          <div className="compact-section-header summary-header">Head-wise Summary</div>
          <table className="print-table summary-table" style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th>Head Category</th>
                <th style={{ width: 80 }}>Total</th>
                <th style={{ width: 80 }}>Absent</th>
                <th style={{ width: 80 }}>Leave</th>
                <th style={{ width: 80 }}>Present</th>
              </tr>
            </thead>
            <tbody>
              {chittha.headSummary?.map((head, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{head.headName}</td>
                  <td className="text-center">{head.total}</td>
                  <td className="text-center">{head.absent}</td>
                  <td className="text-center">{head.leave}</td>
                  <td className="present-val text-center">{head.present}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Duty Detail Sections */}
        {chittha.sectionConfigs?.map(sec => (
          <section key={sec.id} className="print-section duty-detail">
            <div className="compact-section-header">{sec.title}</div>
            <table className="print-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>SN</th>
                  <th style={{ width: 70 }}>Rank</th>
                  <th style={{ width: 160 }}>Name</th>
                  <th style={{ width: 85 }}>Belt No.</th>
                  <th>Duty Point</th>
                  <th>Remarks</th>
                  <th style={{ width: 100 }}>Mobile</th>
                </tr>
              </thead>
              <tbody>
                 {assignments.filter(a => a.sectionId === sec.id).length === 0 ? (
                   <tr><td colSpan={7} className="text-center empty-td" style={{ color: '#999', fontSize: '0.75rem', padding: '12px' }}>No personnel assigned</td></tr>
                 ) : assignments.filter(a => a.sectionId === sec.id).map((off, idx) => (
                   <tr key={idx}>
                     <td className="text-center">{idx+1}</td>
                     <td className="text-center">{off.personnelRank}</td>
                     <td><strong>{off.personnelName}</strong></td>
                     <td className="text-center">{off.personnelBelt}</td>
                     <td>{off.dutyPoint || '—'}</td>
                     <td>{off.remarks || '—'}</td>
                     <td className="text-center">{off.personnelMobile}</td>
                   </tr>
                 ))}
              </tbody>
            </table>
          </section>
        ))}

        {/* Footer / Signatures */}
        <div className="print-signatures">
          <div className="sig-box">
             <div className="sig-line"></div>
             <p>Munshi / Prepared By</p>
          </div>
          <div className="sig-box">
             <div className="sig-line"></div>
             <p>Verified By (MHC)</p>
          </div>
          <div className="sig-box">
             <div className="sig-line"></div>
             <p>SHO / In-Charge</p>
          </div>
        </div>
        
        <div className="print-footer">
          <p>Generated via OASI (Online Administrative System for Investigation)</p>
          <p>Page 1 of 1</p>
        </div>
      </div>

      <style jsx>{`
        .print-header-actions { background: #f8fafc; padding: 12px 24px; display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; margin-bottom: 10px; }
        
        .print-container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; box-shadow: 0 0 20px rgba(0,0,0,0.05); min-height: 29.7cm; font-family: 'Inter', sans-serif; }
        
        .document-header { text-align: center; border-bottom: 2px solid var(--navy); padding-bottom: 15px; margin-bottom: 20px; }
        .district-name { font-size: 1.25rem; font-weight: 800; color: var(--navy); margin: 0; }
        .unit-title { font-size: 1rem; font-weight: 700; color: var(--navy); margin: 2px 0 0; }
        .roster-meta { display: flex; justify-content: center; gap: 30px; margin-top: 10px; }
        .meta-item { display: flex; align-items: center; gap: 6px; font-size: 0.8rem; }
        
        .print-section { margin-bottom: 15px; }

        .compact-section-header { 
          background: var(--navy); 
          color: white; 
          text-align: left; 
          padding: 4px 16px; 
          font-size: 0.8rem; 
          font-weight: 700; 
          text-transform: uppercase; 
          letter-spacing: 0.5px; 
          -webkit-print-color-adjust: exact;
        }
        
        .print-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
        .print-table th { background: #f1f5f9 !important; border: 1px solid #cbd5e1; padding: 4px 8px; text-align: center; font-weight: 700; color: var(--navy); -webkit-print-color-adjust: exact; }
        .print-table td { border: 1px solid #cbd5e1; padding: 3px 8px; vertical-align: middle; height: 26px; }
        
        .summary-table { width: 70%; }
        .present-val { font-weight: 700; color: #059669; }
        .text-center { text-align: center; }
        
        .print-signatures { display: flex; justify-content: space-between; margin-top: 60px; padding: 0 20px; }
        .sig-box { text-align: center; width: 160px; }
        .sig-line { border-bottom: 1px solid #333; margin-bottom: 6px; height: 30px; }
        .sig-box p { font-size: 0.75rem; font-weight: 700; color: #333; margin: 0; }
        
        .print-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; display: flex; justify-content: space-between; font-size: 0.7rem; color: #94a3b8; }
        
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .print-container { box-shadow: none !important; margin: 0 !important; width: 100% !important; padding: 0 !important; }
          .chittha-print-page { padding: 0 !important; }
          .compact-section-header { background: black !important; color: white !important; }
          .print-table th { background: #eee !important; color: black !important; }
          .district-name, .unit-title { color: black !important; }
          @page { margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
