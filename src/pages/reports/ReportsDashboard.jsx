import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { FileText, FileDown, Plus, Search, Filter, BarChart3, Clock } from 'lucide-react';

// For Exporting
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ReportsDashboard() {
  const { user, isRangeAdmin, isDistrictAdmin, isUnitAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterQuarter, setFilterQuarter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
  const YEARS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

  useEffect(() => {
    loadReports();
  }, [user]);

  async function loadReports() {
    try {
      setLoading(true);
      
      const params = {};
      // Role-based filtering
      if (isUnitAdmin && user.unitId) {
        params.unit_id = user.unitId;
      } else if (isDistrictAdmin && user.districtId) {
        params.district_id = user.districtId;
      } else if (isRangeAdmin && user.rangeId) {
        params.range_id = user.rangeId;
      }

      const data = await api.reports.firList(params);

      setReports((data||[]).map(r => ({
        id: r.id,
        year: r.year,
        quarter: r.quarter,
        policeStation: r.police_station,
        firCount: r.fir_count,
        chargeSheetFiled: r.charge_sheet_filed,
        conviction: r.conviction,
        pending: r.pending,
        cognizable: r.cognizable,
        nonCognizable: r.non_cognizable,
        ...r
      })));
    } catch (err) {
      if (import.meta.env.DEV) console.error('Load reports error:', err);
      toast.error('Failed to load FIR reports.');
    } finally {
      setLoading(false);
    }
  }

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (filterYear && r.year !== filterYear) return false;
      if (filterQuarter && r.quarter !== filterQuarter) return false;
      if (searchTerm && !r.policeStation.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [reports, filterYear, filterQuarter, searchTerm]);

  // Aggregated Stats
  const stats = useMemo(() => {
    return filteredReports.reduce((acc, curr) => ({
      totalFIR: acc.totalFIR + (curr.firCount || 0),
      totalChargeSheets: acc.totalChargeSheets + (curr.chargeSheetFiled || 0),
      totalConvictions: acc.totalConvictions + (curr.conviction || 0),
      totalPending: acc.totalPending + (curr.pending || 0),
    }), { totalFIR: 0, totalChargeSheets: 0, totalConvictions: 0, totalPending: 0 });
  }, [filteredReports]);

  // --- EXPORT TO EXCEL ---
  function exportToExcel() {
    if (filteredReports.length === 0) {
      toast.warning('No data to export.');
      return;
    }
    
    const exportData = filteredReports.map(r => ({
      'Year': r.year,
      'Quarter': r.quarter,
      'Police Station': r.policeStation,
      'Total FIRs': r.firCount,
      'Charge Sheets': r.chargeSheetFiled,
      'Convictions': r.conviction,
      'Pending': r.pending,
      'Cognizable': r.cognizable,
      'Non-Cognizable': r.nonCognizable,
    }));

    // Add totals row
    exportData.push({
      'Year': 'TOTAL',
      'Quarter': '-',
      'Police Station': '-',
      'Total FIRs': stats.totalFIR,
      'Charge Sheets': stats.totalChargeSheets,
      'Convictions': stats.totalConvictions,
      'Pending': stats.totalPending,
      'Cognizable': filteredReports.reduce((sum, r) => sum + (r.cognizable || 0), 0),
      'Non-Cognizable': filteredReports.reduce((sum, r) => sum + (r.nonCognizable || 0), 0),
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'FIR Reports');
    
    // Auto-size columns
    const maxWidths = exportData.reduce((acc, row) => {
      Object.keys(row).forEach(key => {
        const val = row[key] ? row[key].toString() : '';
        acc[key] = Math.max(acc[key] || 10, val.length + 2, key.length + 2);
      });
      return acc;
    }, {});
    worksheet['!cols'] = Object.keys(exportData[0]).map(key => ({ wch: maxWidths[key] }));

    XLSX.writeFile(workbook, `FIR_Report_${filterYear}${filterQuarter ? `_${filterQuarter}` : ''}.xlsx`);
    toast.success('Excel report generated.');
  }

  // --- EXPORT TO PDF ---
  function exportToPDF() {
    if (filteredReports.length === 0) {
      toast.warning('No data to export.');
      return;
    }

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text('Duty Management System (DMS) - Crime/FIR Report', 14, 20);
    doc.setFontSize(11);
    doc.text(`Period: ${filterYear} ${filterQuarter ? `- ${filterQuarter}` : '(Full Year)'}`, 14, 28);
    doc.text(`Generated by: ${user.name} (${user.beltNumber})`, 14, 34);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 40);

    // Summary Table
    doc.autoTable({
      startY: 48,
      head: [['Total FIRs', 'Charge Sheets', 'Convictions', 'Pending']],
      body: [[stats.totalFIR, stats.totalChargeSheets, stats.totalConvictions, stats.totalPending]],
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138] }, // var(--primary-800)
    });

    // Detailed Data Table
    const tableData = filteredReports.map(r => [
      r.policeStation,
      `${r.quarter} ${r.year}`,
      r.firCount,
      r.chargeSheetFiled,
      r.conviction,
      r.pending
    ]);

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 15,
      head: [['Police Station', 'Period', 'FIRs', 'Charge Sheets', 'Convictions', 'Pending']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105] }, // var(--gray-600)
    });

    doc.save(`FIR_Report_${filterYear}${filterQuarter ? `_${filterQuarter}` : ''}.pdf`);
    toast.success('PDF report generated.');
  }

  return (
    <div>
      <div className="page-header">
        <h2>Reports & Analytics</h2>
        <div className="page-header-actions">
          {user.role !== 'staff' && (
            <button className="btn btn-primary" onClick={() => navigate('/reports/fir/add')}>
              <Plus size={18} /> Add FIR Data
            </button>
          )}
        </div>
      </div>

      <div className="stats-bar" style={{ marginBottom: 16 }}>
        <div className="stat-widget">
          <div className="stat-widget-icon red"><BarChart3 size={18} /></div>
          <div className="stat-widget-data">
            <h3>{stats.totalFIR}</h3>
            <p>Total FIRs</p>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon info"><FileText size={18} /></div>
          <div className="stat-widget-data">
            <h3>{stats.totalChargeSheets}</h3>
            <p>Charge Sheets</p>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon green"><BarChart3 size={18} /></div>
          <div className="stat-widget-data">
            <h3>{stats.totalConvictions}</h3>
            <p>Convictions</p>
          </div>
        </div>
        <div className="stat-widget">
          <div className="stat-widget-icon amber"><Clock size={18} /></div>
          <div className="stat-widget-data">
            <h3>{stats.totalPending}</h3>
            <p>Pending Inv.</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="search-filter-bar">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Search Police Station..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select className="filter-select" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
               {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="filter-select" value={filterQuarter} onChange={(e) => setFilterQuarter(e.target.value)}>
              <option value="">All Quarters</option>
              {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={exportToExcel} disabled={loading || filteredReports.length === 0}>
                <FileDown size={14} /> Excel
              </button>
              <button className="btn btn-outline btn-sm" onClick={exportToPDF} disabled={loading || filteredReports.length === 0} style={{ color: 'var(--danger-600)', borderColor: 'var(--danger-600)' }}>
                <FileDown size={14} /> PDF
              </button>
            </div>
          </div>
        </div>

        <div className="table-container">
          {loading ? (
            <div className="empty-state">
              <div className="spinner spinner-lg"></div>
              <p>Loading reports...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="empty-state">
              <FileText className="icon" />
              <h4>No FIR data found</h4>
              <p>No reports match your filters for {filterYear}.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Police Station</th>
                  <th>Period</th>
                  <th style={{ textAlign: 'right' }}>Total FIRs</th>
                  <th style={{ textAlign: 'right' }}>Charge Sheets</th>
                  <th style={{ textAlign: 'right' }}>Convictions</th>
                  <th style={{ textAlign: 'right' }}>Pending</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.policeStation}</td>
                    <td><span className="badge badge-neutral">{r.quarter} {r.year}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger-600)' }}>{r.firCount}</td>
                    <td style={{ textAlign: 'right' }}>{r.chargeSheetFiled}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success-600)' }}>{r.conviction}</td>
                    <td style={{ textAlign: 'right', color: 'var(--warning-600)' }}>{r.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
