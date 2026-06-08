import React, { useState, useEffect, useRef } from 'react';
import { 
  Rocket, GitBranch, CheckCircle, XCircle, AlertTriangle, 
  Clock, RefreshCw, Terminal, ChevronDown, ChevronUp, 
  Shield, History, Play, Check, Server
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function DeployManager() {
  const { isSuperAdmin } = useAuth();
  const toast = useToast();
  
  const [logs, setLogs] = useState([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [history, setHistory] = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    
    checkStatus();
    loadHistory();
    
    const token = localStorage.getItem('oasi_token');
    const API_BASE = import.meta.env.VITE_API_URL || '';
    
    const eventSource = new EventSource(`${API_BASE}/api/deploy/logs?token=${token}`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'init') {
        setLogs(data.logs);
      } else if (data.type === 'logs') {
        setLogs(prev => [...prev, ...data.logs]);
      }
    };
    
    return () => eventSource.close();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  async function checkStatus() {
    try {
      const token = localStorage.getItem('oasi_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/deploy/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setIsDeploying(data.isDeploying);
    } catch (err) {}
  }

  async function loadHistory() {
    try {
      const token = localStorage.getItem('oasi_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/deploy/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(data);
    } catch (err) {}
  }

  async function triggerDeploy() {
    if (!window.confirm('⚠️ WARNING: Deployment trigger kar rahe hain. Isse system 1-2 minute ke liye restart ho sakta hai. Proceed?')) {
      return;
    }
    
    try {
      setIsDeploying(true);
      const token = localStorage.getItem('oasi_token');
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/deploy/trigger`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Deploy failed');
      }
      
      toast.success('🚀 Deployment Initiated!');
      loadHistory();
    } catch (err) {
      toast.error(err.message);
      setIsDeploying(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Shield size={48} style={{ color: 'var(--danger-500)', margin: '0 auto 16px' }} />
        <h3 style={{ color: 'var(--danger-500)' }}>Access Denied</h3>
      </div>
    );
  }

  return (
    <div className="deploy-manager" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* HEADER SECTION */}
      <div className="panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: 'var(--primary-50)', padding: 12, borderRadius: 12 }}>
            <Server size={32} style={{ color: 'var(--primary-600)' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              OASI Deployment Center
              {isDeploying && <span className="badge badge-warning" style={{ fontSize: '0.75rem', animation: 'pulse 2s infinite' }}>● Deploying</span>}
            </h2>
            <div style={{ display: 'flex', gap: 16, fontSize: '0.85rem', color: 'var(--gray-600)', marginTop: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><GitBranch size={14} /> Branch: <strong>master</strong></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={14} style={{ color: 'var(--success-500)' }}/> System: <strong>Secure</strong></span>
            </div>
          </div>
        </div>
        <button 
          className="desktop-only"
          onClick={triggerDeploy}
          disabled={isDeploying}
          style={{
            background: isDeploying ? 'var(--gray-300)' : 'linear-gradient(135deg, var(--primary-600), var(--primary-800))',
            color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px',
            fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10,
            cursor: isDeploying ? 'not-allowed' : 'pointer',
            boxShadow: isDeploying ? 'none' : '0 4px 12px rgba(22, 22, 84, 0.2)',
            transition: 'all 0.2s ease'
          }}
        >
          {isDeploying ? (
            <><RefreshCw size={18} className="spin" /> Updating...</>
          ) : (
            <><Rocket size={18} /> Trigger Deployment</>
          )}
        </button>
      </div>

      <div className="deploy-panels">
        
        {/* TERMINAL SECTION */}
        <div className="panel" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '600px' }}>
          <div style={{ 
            background: '#1a1b26', padding: '12px 20px', 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid #24283b'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#a9b1d6' }}>
              <Terminal size={16} /> <span style={{ fontSize: '0.9rem', fontWeight: 500, fontFamily: 'monospace' }}>server-logs ~ bash</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
            </div>
          </div>
          
          <div style={{ 
            flex: 1, background: '#1a1b26', color: '#c0caf5', 
            padding: 20, overflowY: 'auto', fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: '0.85rem', lineHeight: 1.6
          }}>
            <div style={{ color: '#7dcfff', marginBottom: 16 }}>
              Welcome to OASI Deployment Terminal.<br/>
              Awaiting commands...
            </div>
            
            {logs.length === 0 && !isDeploying && (
              <div style={{ color: '#565f89', fontStyle: 'italic' }}>System idle. No recent deployments.</div>
            )}
            
            {logs.map((log, i) => (
              <div key={i} style={{ 
                color: log.type === 'error' ? '#f7768e' : 
                       log.type === 'warning' ? '#e0af68' : 
                       log.type === 'success' ? '#9ece6a' : 
                       log.message.startsWith('>') ? '#bb9af7' : '#c0caf5',
                marginBottom: 4, wordBreak: 'break-all'
              }}>
                <span style={{ color: '#565f89', marginRight: 12, userSelect: 'none' }}>
                  {new Date(log.timestamp).toLocaleTimeString('en-US', {hour12: false})}
                </span>
                {log.message}
              </div>
            ))}
            {isDeploying && (
              <div style={{ marginTop: 8, color: '#bb9af7', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={14} className="spin" /> <span>Executing processes...</span>
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        {/* HISTORY SECTION */}
        <div className="panel" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-200)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={18} style={{ color: 'var(--primary-600)' }} /> 
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Deployment History</h3>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--gray-400)', marginTop: 40 }}>
                <Clock size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p>No past deployments</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {history.map((item, index) => (
                  <div key={item.id} style={{ 
                    position: 'relative', paddingLeft: 24,
                    borderLeft: index === history.length - 1 ? 'none' : '2px solid var(--gray-200)',
                    paddingBottom: index === history.length - 1 ? 0 : 20
                  }}>
                    {/* Timeline Dot */}
                    <div style={{
                      position: 'absolute', left: -7, top: 0,
                      width: 12, height: 12, borderRadius: '50%',
                      background: item.status === 'success' ? 'var(--success-500)' :
                                  item.status === 'failed' ? 'var(--danger-500)' : 'var(--warning-500)',
                      border: '2px solid white'
                    }} />
                    
                    <div style={{ background: 'var(--gray-50)', padding: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Deploy #{item.id.toString().slice(-4)}</span>
                        {item.status === 'success' ? <CheckCircle size={16} style={{ color: 'var(--success-500)' }} /> :
                         item.status === 'failed' ? <XCircle size={16} style={{ color: 'var(--danger-500)' }} /> :
                         <RefreshCw size={16} className="spin text-warning" />}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--gray-600)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Triggered by:</span>
                          <strong>{item.trigger}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Date:</span>
                          <span>{new Date(item.startedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Button (Mobile) */}
      <button 
        className="fab-btn mobile-only" 
        onClick={triggerDeploy} 
        disabled={isDeploying}
        style={{ 
          background: isDeploying ? 'var(--gray-300)' : 'linear-gradient(135deg, var(--primary-600), var(--primary-800))',
          color: 'white', border: 'none'
        }}
        title="Trigger Deploy"
      >
        {isDeploying ? <RefreshCw size={24} className="spin" /> : <Rocket size={24} />}
      </button>
    </div>
  );
}
