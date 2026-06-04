import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Calendar, FileType } from 'lucide-react';

export default function FIRForm() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    quarter: 'Q1',
    year: new Date().getFullYear().toString(),
    policeStation: '',
    firCount: '',
    chargeSheetFiled: '',
    conviction: '',
    pending: '',
    cognizable: '',
    nonCognizable: ''
  });

  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
  const YEARS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!formData.policeStation || !formData.firCount) {
      toast.warning('Please fill the required fields.');
      return;
    }

    setLoading(true);
    try {
      // Check if entry already exists for this PS + Quarter + Year
      const existing = await api.reports.firList({
        police_station: formData.policeStation,
        quarter: formData.quarter,
        year: formData.year
      });

      if (existing && existing.length > 0) {
        toast.warning(`Report for ${formData.policeStation} in ${formData.quarter} ${formData.year} already exists.`);
        setLoading(false);
        return;
      }

      const payload = {
        state_id: user.stateId || '',
        range_id: user.rangeId || '',
        district_id: user.districtId || '',
        unit_id: user.unitId || '',
        
        quarter: formData.quarter,
        year: formData.year,
        police_station: formData.policeStation,
        
        fir_count: parseInt(formData.firCount) || 0,
        charge_sheet_filed: parseInt(formData.chargeSheetFiled) || 0,
        conviction: parseInt(formData.conviction) || 0,
        pending: parseInt(formData.pending) || 0,
        cognizable: parseInt(formData.cognizable) || 0,
        non_cognizable: parseInt(formData.non_cognizable) || 0,
      };

      await api.reports.firCreate(payload);

      toast.success('FIR data submitted successfully.');
      navigate('/reports/fir');
    } catch (err) {
      if (import.meta.env.DEV) console.error('FIR submit error:', err);
      toast.error('Failed to submit FIR data.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/reports/fir')}>
            <ArrowLeft size={20} />
          </button>
          <h2>Add FIR Data</h2>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 800, margin: '0 auto' }}>
        <form onSubmit={handleSubmit} className="panel-body">
          <div className="form-section">
            <h3 className="form-section-title">Period & Location</h3>
            
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label required">Quarter</label>
                <select className="form-select" name="quarter" value={formData.quarter} onChange={handleInputChange}>
                  {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label required">Year</label>
                <select className="form-select" name="year" value={formData.year} onChange={handleInputChange}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label required">Police Station</label>
                <input
                  type="text"
                  className="form-input"
                  name="policeStation"
                  value={formData.policeStation}
                  onChange={handleInputChange}
                  placeholder="e.g. PS City, PS Sadar"
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Crime Statistics</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Total FIRs Registered</label>
                <input type="number" className="form-input" name="firCount" value={formData.firCount} onChange={handleInputChange} min="0" required />
              </div>
              <div className="form-group">
                <label className="form-label">Charge Sheets Filed</label>
                <input type="number" className="form-input" name="chargeSheetFiled" value={formData.chargeSheetFiled} onChange={handleInputChange} min="0" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Convictions</label>
                <input type="number" className="form-input" name="conviction" value={formData.conviction} onChange={handleInputChange} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Pending Investigation</label>
                <input type="number" className="form-input" name="pending" value={formData.pending} onChange={handleInputChange} min="0" />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Cognizable</label>
                <input type="number" className="form-input" name="cognizable" value={formData.cognizable} onChange={handleInputChange} min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Non-Cognizable</label>
                <input type="number" className="form-input" name="nonCognizable" value={formData.nonCognizable} onChange={handleInputChange} min="0" />
              </div>
            </div>
          </div>

          <div className="panel-footer" style={{ marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/reports/fir')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : <><Send size={18} /> Save Data</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
