import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { Send, UploadCloud, ArrowLeft, Calendar, UserCheck } from 'lucide-react';

export default function TransferApply() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [personnel, setPersonnel] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    personnelId: '',
    toUnitId: '',
    toSubUnitId: '',
    transferDate: '',
    effectiveDate: '',
    orderNumber: '',
  });
  const [documentFile, setDocumentFile] = useState(null);

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      // Load personnel
      const pData = await api.personnel.list();
      setPersonnel((pData||[]).filter(p => p.service_status === 'Active' && !p.is_deleted).map(p => ({
        id: p.id,
        fullName: p.full_name,
        rank: p.rank,
        beltNumber: p.belt_number,
        currentUnitId: p.current_unit_id,
        currentSubUnitId: p.current_sub_unit_id,
        stateId: p.state_id,
        rangeId: p.range_id,
        districtId: p.district_id
      })));

      // Load all destination units
      const uData = await api.hierarchy.units();
      setUnits((uData||[]).map(u => ({
        id: u.id,
        unitName: u.name,
        districtId: u.district_id,
        rangeId: u.range_id,
        stateId: u.state_id
      })));
    } catch (err) {
      toast.error('Failed to load required data.');
    } finally { setLoading(false); }
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!formData.personnelId || !formData.toUnitId || !formData.transferDate) {
      toast.warning('Please fill all required fields.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedPerson = personnel.find(p => p.id === formData.personnelId);
      const destUnit = units.find(u => u.id === formData.toUnitId);
      
      let documentUrl = '';
      if (documentFile) {
        // NOTE: File upload requires Cloudinary/AWS backend setup now.
        // For now, we will skip uploading the actual file.
        toast.info('File upload is temporarily disabled pending cloud storage setup.');
      }

      await api.transfers.create({
        personnel_id: selectedPerson.id,
        from_unit_id: selectedPerson.currentUnitId || '',
        to_unit_id: destUnit.id,
        order_number: formData.orderNumber,
        order_date: formData.transferDate,
        status: 'Ordered',
        remarks: documentUrl ? `Order Link: ${documentUrl}` : '',
      });

      toast.success('Transfer order initiated.');
      navigate('/transfer');
    } catch (err) {
      toast.error('Failed to initiate transfer.');
    } finally { setLoading(false); }
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
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/transfer')}>
            <ArrowLeft size={20} />
          </button>
          <h2>Initiate Transfer</h2>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 800, margin: '0 auto' }}>
        <form onSubmit={handleSubmit} className="panel-body">
          <div className="form-section">
            <h3 className="form-section-title">Transfer Details</h3>
            
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label required">Select Personnel</label>
                <div className="search-input-wrapper">
                  <UserCheck className="search-icon" size={16} />
                  <select
                    className="form-select"
                    name="personnelId"
                    value={formData.personnelId}
                    onChange={handleInputChange}
                    required
                    style={{ paddingLeft: 36 }}
                  >
                    <option value="">— Select Personnel —</option>
                    {personnel.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.beltNumber ? `${p.beltNumber} - ` : ''}{p.fullName} ({p.rank || 'No Rank'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label required">Destination Unit</label>
                <select
                  className="form-select"
                  name="toUnitId"
                  value={formData.toUnitId}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">— Select Unit —</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.unitName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Transfer Date</label>
                <div className="search-input-wrapper">
                  <Calendar className="search-icon" size={16} />
                  <input
                    type="date"
                    className="form-input"
                    name="transferDate"
                    value={formData.transferDate}
                    onChange={handleInputChange}
                    required
                    style={{ paddingLeft: 36 }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Order / Memo Number</label>
                <input
                  type="text"
                  className="form-input"
                  name="orderNumber"
                  value={formData.orderNumber}
                  onChange={handleInputChange}
                  placeholder="e.g. TR-2026/089"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Transfer Order Document (Optional)</label>
              <div style={{
                border: '1px dashed var(--gray-300)',
                borderRadius: 8,
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--gray-50)'
              }}>
                <UploadCloud size={24} style={{ color: 'var(--gray-400)', marginBottom: 8 }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--gray-600)', marginBottom: 8 }}>
                  Attach official transfer order (PDF/Image)
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
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/transfer')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Initiating...' : <><Send size={18} /> Initiate Transfer</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
