import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { Send, UploadCloud, ArrowLeft, Calendar } from 'lucide-react';

const LEAVE_TYPES = [
  'Casual Leave (CL)',
  'Earned Leave (EL)',
  'Medical Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Station Leave',
  'Other'
];

export default function LeaveApply() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    personnelId: '',
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [documentFile, setDocumentFile] = useState(null);

  useEffect(() => {
    loadPersonnel();
  }, [user]);

  async function loadPersonnel() {
    try {
      const data = await api.personnel.list();
      setPersonnel((data||[]).filter(p => p.service_status === 'Active' && !p.is_deleted)
        .map(p => ({
          id: p.id, fullName: p.full_name, rank: p.rank,
          beltNumber: p.belt_number, stateId: p.state_id,
          rangeId: p.range_id, districtId: p.district_id,
          currentUnitId: p.current_unit_id, currentSubUnitId: p.current_sub_unit_id
        })));
    } catch (err) {
      toast.error('Failed to load personnel list.');
    } finally { setLoading(false); }
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.personnelId || !formData.leaveType || !formData.startDate || !formData.endDate) {
      toast.warning('Please fill all required fields.'); return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.warning('End date cannot be before start date.'); return;
    }
    setSubmitting(true);
    try {
      const selectedPerson = personnel.find(p => p.id === formData.personnelId);
      await api.leaves.apply({
        personnel_id: selectedPerson.id,
        leave_type: formData.leaveType,
        start_date: formData.startDate,
        end_date: formData.endDate,
        reason: formData.reason,
        node_id: null,
      });
      toast.success('Leave application submitted successfully.');
      navigate('/leave');
    } catch (err) {
      toast.error('Failed to submit leave application.');
    } finally { setSubmitting(false); }
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner spinner-lg"></div>
        <p>Loading form...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/leave')}>
            <ArrowLeft size={20} />
          </button>
          <h2>Apply for Leave</h2>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 800, margin: '0 auto' }}>
        <form onSubmit={handleSubmit} className="panel-body">
          <div className="form-section">
            <h3 className="form-section-title">Leave Details</h3>
            
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label className="form-label required">Select Personnel</label>
                <select
                  className="form-select"
                  name="personnelId"
                  value={formData.personnelId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">— Select Personnel —</option>
                  {personnel.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.beltNumber ? `${p.beltNumber} - ` : ''}{p.fullName} ({p.rank || 'No Rank'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label required">Leave Type</label>
                <select
                  className="form-select"
                  name="leaveType"
                  value={formData.leaveType}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">— Select Type —</option>
                  {LEAVE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Start Date</label>
                <div className="search-input-wrapper">
                  <Calendar className="search-icon" size={16} />
                  <input
                    type="date"
                    className="form-input"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                    style={{ paddingLeft: 36 }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label required">End Date</label>
                <div className="search-input-wrapper">
                  <Calendar className="search-icon" size={16} />
                  <input
                    type="date"
                    className="form-input"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                    style={{ paddingLeft: 36 }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Total Days</label>
                <input
                  type="text"
                  className="form-input"
                  value={calculateDays() || 0}
                  disabled
                  style={{ background: 'var(--gray-50)', fontWeight: 600 }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Reason / Remarks</label>
              <textarea
                className="form-input"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                rows={3}
                placeholder="Brief reason for leave..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Supporting Document (Optional)</label>
              <div style={{
                border: '1px dashed var(--gray-300)',
                borderRadius: 8,
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--gray-50)'
              }}>
                <UploadCloud size={24} style={{ color: 'var(--gray-400)', marginBottom: 8 }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: 8 }}>
                  Attach application or medical certificate
                </p>
                <input
                  type="file"
                  onChange={(e) => setDocumentFile(e.target.files[0])}
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>

          <div className="panel-footer" style={{ marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/leave')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : <><Send size={18} /> Submit Application</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
