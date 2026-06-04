import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Paperclip, X, FileText, Image } from 'lucide-react';

export default function GrievanceApply() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting]  = useState(false);
  const [personnelInfo, setPersonnelInfo] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);  // attached files
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    subject: '',
    description: '',
  });

  useEffect(() => {
    loadPersonnelInfo();
  }, [user]);

  // Load personnel info representing the currently logged in user
  // Since we don't have a linked 'personnelId' on the basic user auth right now,
  // we'll try to match by BeltNumber or Mobile.
  async function loadPersonnelInfo() {
    try {
      setLoading(true);
      // Personnel record dhundo — optional hai, user se fallback milega
      const data = await api.personnel.list();
      const myRecord = (data||[]).find(p => p.belt_number === user.beltNumber && !p.is_deleted);
      if (myRecord) {
        setPersonnelInfo({
          id: myRecord.id, fullName: myRecord.full_name, rank: myRecord.rank,
          beltNumber: myRecord.belt_number, mobileNumber: myRecord.mobile_number,
          stateId: myRecord.state_id, rangeId: myRecord.range_id,
          districtId: myRecord.district_id, currentUnitId: myRecord.current_unit_id,
        });
      }
      // Personnel record na mile toh bhi chalega — user info se submit hoga
    } catch (err) {
      // Silent fail — user info se kaam chalega
    } finally { setLoading(false); }
  }

  function handleInputChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  function handleFileChange(e) {
    const newFiles = Array.from(e.target.files);
    const combined = [...selectedFiles, ...newFiles].slice(0, 3); // max 3
    setSelectedFiles(combined);
    e.target.value = ''; // reset input
  }

  function removeFile(idx) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  }

  function fileIcon(file) {
    if (file.type.startsWith('image/')) return <Image size={16} color="var(--primary-600)" />;
    return <FileText size={16} color="var(--gray-500)" />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.subject || !formData.description) { toast.warning('Please fill all required fields.'); return; }
    setSubmitting(true);
    try {
      await api.grievances.create({
        // personnelInfo mile toh use karo, warna user object se fallback
        applicant_name:   personnelInfo?.fullName   || user.name        || '',
        applicant_mobile: personnelInfo?.mobileNumber || '',
        grievance_type:   formData.subject,
        description:      formData.description,
        node_id:          user.nodeId || null,
      }, selectedFiles);  // ← files pass karo
      toast.success('Grievance submitted successfully.');
      navigate('/grievances');
    } catch (err) {
      toast.error('Failed to submit grievance.');
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
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/grievances')}>
            <ArrowLeft size={20} />
          </button>
          <h2>File a Grievance</h2>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 700, margin: '0 auto' }}>
        <form onSubmit={handleSubmit} className="panel-body">
          
          <div className="form-section">
            <h3 className="form-section-title">Complainant Information</h3>
            <div style={{ 
              padding: '16px', 
              backgroundColor: 'var(--gray-50)', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '24px'
            }}>
               <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  backgroundColor: 'var(--primary-100)', color: 'var(--primary-700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, fontSize: '1.2rem'
               }}>
                  {(personnelInfo?.fullName || user.name)?.[0]?.toUpperCase() || 'U'}
               </div>
               <div>
                  <h4 style={{ margin: 0 }}>{personnelInfo?.fullName || user.name || 'User'}</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                     {personnelInfo?.rank || user.roleLabel || 'Staff'} • {personnelInfo?.beltNumber || user.beltNumber}
                  </p>
               </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Subject</label>
              <input
                type="text"
                className="form-input"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                placeholder="Brief summary of your grievance..."
                required
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label className="form-label required">Description</label>
              <textarea
                className="form-input"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Provide detailed information about your issue..."
                required
                rows={6}
              />
            </div>
            
            {/* File Attachments — Improved UI */}
            <div className="form-group">
              <label className="form-label">
                Attachments
                <span style={{ fontWeight: 400, color: 'var(--gray-400)', marginLeft: 8 }}>
                  Optional · Max 3 files · 5MB each · Photo / PDF / Word / Excel
                </span>
              </label>

              {/* Drop Zone */}
              {selectedFiles.length < 3 && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--primary-500)'; e.currentTarget.style.backgroundColor = 'var(--primary-50)'; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-300)'; e.currentTarget.style.backgroundColor = 'var(--gray-50)'; }}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = 'var(--gray-300)';
                    e.currentTarget.style.backgroundColor = 'var(--gray-50)';
                    const dropped = Array.from(e.dataTransfer.files);
                    const combined = [...selectedFiles, ...dropped].slice(0, 3);
                    setSelectedFiles(combined);
                  }}
                  style={{
                    border: '2px dashed var(--gray-300)',
                    borderRadius: 10,
                    padding: '24px 16px',
                    backgroundColor: 'var(--gray-50)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s',
                    marginBottom: selectedFiles.length > 0 ? 12 : 0,
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📎</div>
                  <div style={{ fontWeight: 600, color: 'var(--gray-700)', marginBottom: 4 }}>
                    Click to attach or drag & drop
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>
                    🖼️ Image &nbsp;·&nbsp; 📄 PDF &nbsp;·&nbsp; 📝 Word &nbsp;·&nbsp; 📊 Excel
                    &nbsp;&nbsp;({selectedFiles.length}/3 attached)
                  </div>
                </div>
              )}

              {/* Attached File Chips */}
              {selectedFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedFiles.map((f, i) => {
                    const isImg  = f.type.startsWith('image/');
                    const isPdf  = f.type === 'application/pdf';
                    const isXls  = f.type.includes('sheet') || f.type.includes('excel');
                    const emoji  = isImg ? '🖼️' : isPdf ? '📄' : isXls ? '📊' : '📝';
                    const sizeKB = (f.size / 1024).toFixed(0);
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 8,
                        backgroundColor: 'var(--white)',
                        border: '1px solid var(--primary-200)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}>
                        <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray-800)' }}>
                            {f.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 2 }}>
                            {sizeKB} KB
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          title="Remove"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 4, borderRadius: 4, flexShrink: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--danger-500)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-400)'}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                  {selectedFiles.length < 3 && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)', textAlign: 'center' }}>
                      ↑ Drop zone above mein aur files add kar sakte hain ({3 - selectedFiles.length} remaining)
                    </div>
                  )}
                </div>
              )}
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: 8 }}>
               Note: Once submitted, your grievance will be routed to your Unit or District Administrator for review.
               You can track the status from the Grievance Register.
            </p>
          </div>

          <div className="panel-footer" style={{ marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/grievances')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : <><Send size={18} /> Submit Grievance</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
