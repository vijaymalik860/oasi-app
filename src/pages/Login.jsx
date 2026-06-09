import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Shield, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [beltNumber, setBeltNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!beltNumber.trim() || !password.trim()) {
      toast.warning('Please enter Belt Number and Password.');
      return;
    }
    setLoading(true);
    try {
      await login(beltNumber.trim(), password);
      toast.success('Login successful. Welcome to OASI Portal.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (belt, pass) => {
    setLoading(true);
    try {
      await login(belt, pass);
      toast.success('Login successful. Welcome to OASI Portal.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="emblem">
            <Shield size={32} color="#fff" />
          </div>
          <h2>OASI Portal</h2>
          <p>Haryana Police — Digital Records System</p>
        </div>

        {/* TEMPORARILY HIDDEN AUTHENTICATION FORM
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="beltNumber">
              Belt Number / User ID
            </label>
            <input
              id="beltNumber"
              className="form-input"
              type="text"
              placeholder="Enter your Belt Number"
              value={beltNumber}
              onChange={(e) => setBeltNumber(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 10, top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4,
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
        */}

        <div className="quick-login-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={() => handleQuickLogin('ADMIN001', 'Admin@1234')}
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            Login as Super Admin
          </button>
          <button
            onClick={() => handleQuickLogin('STATE001', 'Admin@1234')}
            className="btn btn-primary login-btn"
            style={{ backgroundColor: '#4f46e5' }}
            disabled={loading}
          >
            Login as State Admin
          </button>
          <button
            onClick={() => handleQuickLogin('RANGE001', 'Admin@1234')}
            className="btn btn-primary login-btn"
            style={{ backgroundColor: '#0ea5e9' }}
            disabled={loading}
          >
            Login as Range Admin (Ambala)
          </button>
          <button
            onClick={() => handleQuickLogin('DIST001', 'Admin@1234')}
            className="btn btn-primary login-btn"
            style={{ backgroundColor: '#10b981' }}
            disabled={loading}
          >
            Login as District Admin (Ambala)
          </button>
          <button
            onClick={() => handleQuickLogin('UNIT002', 'Admin@1234')}
            className="btn btn-primary login-btn"
            style={{ backgroundColor: '#f59e0b' }}
            disabled={loading}
          >
            Login as Unit Admin (Ambala Cantt)
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>

          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 10 }}>
            © 2026 OASI Portal — Haryana Police
          </p>
        </div>
      </div>
    </div>
  );
}
