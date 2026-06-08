import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Rocket, GitBranch, CheckCircle, XCircle, AlertTriangle,
  Clock, RefreshCw, Terminal, ChevronDown, ChevronUp,
  Shield, History, Loader
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function DeployManager() {
  const { isSuperAdmin, user } = useAuth();

  const [status, setStatus] = useState(null);       // { isDeploying, lastDeploy, history }
  const [deploying, setDeploying] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deployResult, setDeployResult] = useState(null); // 'success' | 'failed' | null
  const logsEndRef = useRef(null);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (isSuperAdmin) loadStatus();
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, [isSuperAdmin]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  async function loadStatus() {
    try {
      const token = localStorage.getItem('oasi_token');
      const res = await fetch(`${API_BASE}/api/deploy/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Status load failed:', err);
    }
  }

  function startDeploy() {
    setShowConfirm(false);
    setDeploying(true);
    setLogs([]);
    setDeployResult(null);

    const token = localStorage.getItem('oasi_token');
    const es = new EventSource(`${API_BASE}/api/deploy/stream?token=${token}`);
    eventSourceRef.current = es;

    // Note: EventSource does not support custom headers natively.
    // We handle this via query param or cookie on the server if needed.
    // For now, token is passed via URL param and server reads it.

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLogs(prev => [...prev, data]);

        if (data.type === 'success') {
          setDeployResult('success');
          setDeploying(false);
          loadStatus();
          es.close();
        } else if (data.type === 'error' || data.type === 'rollback') {
          if (data.type === 'rollback') {
            setDeployResult('failed');
            setDeploying(false);
            loadStatus();
            es.close();
          }
        }
      } catch (_) {}
    };

    es.onerror = () => {
      setLogs(prev => [...prev, { type: 'error', msg: '❌ Connection lost. Server se disconnect ho gaya.' }]);
      setDeploying(false);
      setDeployResult('failed');
      es.close();
    };
  }

  function getLogStyle(type) {
    switch (type) {
      case 'success': return { color: '#22c55e', fontWeight: 700 };
      case 'error':   return { color: '#ef4444', fontWeight: 600 };
      case 'warn':    return { color: '#f59e0b' };
      case 'step':    return { color: '#60a5fa', fontWeight: 600, marginTop: 4 };
      case 'done':    return { color: '#34d399' };
      case 'rollback':return { color: '#f97316', fontWeight: 700 };
      case 'info':    return { color: '#a78bfa' };
      default:        return { color: '#cbd5e1' };
    }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Shield size={48} style={{ color: 'var(--gray-300)', marginBottom: 16 }} />
        <h3 style={{ color: 'var(--gray-500)' }}>Access Denied</h3>
        <p style={{ color: 'var(--gray-400)' }}>Sirf Super Admin yahan access kar sakta hai.</p>
      </div>
    );
  }

  const lastDeploy = status?.lastDeploy;
  const history    = status?.history || [];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, #1e1b4b, #3730a3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Rocket size={24} color="#a5b4fc" />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Deploy Manager</h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--gray-500)' }}>
              GitHub se latest code pull karke server update karo
            </p>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={loadStatus}
          disabled={deploying}
          title="Refresh status"
        >
          <RefreshCw size={16} className={deploying ? 'spin' : ''} />
        </button>
      </div>

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="panel" style={{ padding: 20, borderLeft: '4px solid var(--primary-500)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Server Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: deploying ? '#f59e0b' : '#22c55e',
              boxShadow: deploying ? '0 0 8px #f59e0b' : '0 0 8px #22c55e',
            }} />
            <span style={{ fontWeight: 600, color: deploying ? '#f59e0b' : '#22c55e' }}>
              {deploying ? 'Deploying...' : 'Live'}
            </span>
          </div>
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Last Deploy
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            {lastDeploy ? formatDate(lastDeploy.deployedAt) : 'Koi deploy nahi hua abhi tak'}
          </div>
          {lastDeploy && (
            <div style={{ marginTop: 4 }}>
              <span className={`badge ${lastDeploy.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                {lastDeploy.status === 'success' ? '✓ Success' : '✗ Failed'}
              </span>
            </div>
          )}
        </div>

        <div className="panel" style={{ padding: 20 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Last Commit
          </div>
          <div style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--primary-600)', wordBreak: 'break-all' }}>
            {lastDeploy?.commitHash || '—'}
          </div>
        </div>
      </div>

      {/* Deploy Button Panel */}
      <div className="panel" style={{
        padding: 28,
        marginBottom: 24,
        background: deploying
          ? 'linear-gradient(135deg, #1e1b4b08, #3730a308)'
          : 'linear-gradient(135deg, #f8faff, #f0f4ff)',
        border: '1px solid var(--primary-200)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>
              <GitBranch size={18} style={{ marginRight: 8, verticalAlign: 'middle', color: 'var(--primary-500)' }} />
              master branch → Server
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--gray-500)' }}>
              GitHub se latest code fetch → npm install → Build → Restart
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--gray-400)' }}>
              ⚠️ Build fail hone par automatically rollback hoga. Server safe rahega.
            </p>
          </div>

          <div>
            {deployResult === 'success' && !deploying && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', marginBottom: 12, fontWeight: 600 }}>
                <CheckCircle size={20} /> Deploy Successful!
              </div>
            )}
            {deployResult === 'failed' && !deploying && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', marginBottom: 12, fontWeight: 600 }}>
                <XCircle size={20} /> Deploy Failed — Rollback active
              </div>
            )}

            {!showConfirm ? (
              <button
                className="btn btn-primary"
                onClick={() => setShowConfirm(true)}
                disabled={deploying}
                style={{
                  background: deploying ? 'var(--gray-400)' : 'linear-gradient(135deg, #1e1b4b, #3730a3)',
                  padding: '12px 28px',
                  fontSize: '1rem',
                  borderRadius: 10,
                  boxShadow: deploying ? 'none' : '0 4px 14px rgba(55, 48, 163, 0.4)',
                }}
              >
                {deploying ? (
                  <><Loader size={18} className="mr-2 spin" /> Deploying...</>
                ) : (
                  <><Rocket size={18} className="mr-2" /> Deploy Now</>
                )}
              </button>
            ) : (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: 10,
                padding: '16px 20px',
              }}>
                <p style={{ margin: '0 0 12px 0', fontWeight: 600, color: '#92400e' }}>
                  <AlertTriangle size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Confirm karo — Production server update hoga!
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={startDeploy}
                    style={{ background: '#dc2626' }}
                  >
                    Haan, Deploy Karo
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Terminal / Logs */}
      {logs.length > 0 && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid var(--gray-200)',
            background: '#0f172a',
            borderRadius: '8px 8px 0 0',
          }}>
            <Terminal size={16} color="#a5b4fc" />
            <span style={{ color: '#a5b4fc', fontWeight: 600, fontSize: '0.9rem' }}>
              Live Deploy Log
            </span>
            {deploying && (
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: '#fbbf24', fontSize: '0.82rem' }}>
                <Loader size={12} className="spin" /> Running...
              </span>
            )}
          </div>
          <div style={{
            background: '#0f172a',
            padding: '16px',
            height: 380,
            overflowY: 'auto',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '0.82rem',
            lineHeight: 1.7,
            borderRadius: '0 0 8px 8px',
          }}>
            {logs.map((log, i) => (
              <div key={i} style={{ ...getLogStyle(log.type), marginBottom: 2 }}>
                <span style={{ color: '#475569', marginRight: 8, fontSize: '0.72rem' }}>
                  {log.ts ? new Date(log.ts).toLocaleTimeString('en-IN') : ''}
                </span>
                {log.msg}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Deploy History */}
      <div className="panel">
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer' }}
          onClick={() => setShowHistory(!showHistory)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <History size={18} color="var(--primary-500)" />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Deploy History</h3>
            <span className="badge badge-neutral">{history.length}</span>
          </div>
          {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>

        {showHistory && (
          <div style={{ borderTop: '1px solid var(--gray-200)' }}>
            {history.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gray-400)' }}>
                Koi deploy history nahi hai
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Commit</th>
                    <th>By</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: '0.82rem' }}>{formatDate(h.deployedAt)}</td>
                      <td>
                        {h.status === 'success'
                          ? <span className="badge badge-success">✓ Success</span>
                          : <span className="badge badge-danger">✗ Failed</span>
                        }
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                        {h.duration ? `${h.duration}s` : '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--primary-600)' }}>
                        {h.commitHash ? h.commitHash.slice(0, 40) : '—'}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{h.deployedBy || '—'}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>
                        {h.failedStep ? `Failed: ${h.failedStep}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
