import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

const ROLE_LABELS = {
  super_admin:    'Super Admin (Headquarters)',
  state_admin:    'State Admin',
  range_admin:    'Range Admin (OASI)',
  district_admin: 'District Admin (OASI)',
  unit_admin:     'Unit Admin (MHC)',
  staff:          'Normal Staff',
};

export default function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Session restore from localStorage
  useEffect(() => {
    async function syncSession() {
      // 🚨 MOCK SESSION FOR OPEN PORTAL (NO LOGIN REQUIRED)
      const mockUser = {
        uid: null,
        name: 'Portal Admin',
        beltNumber: 'ADMIN001',
        role: 'super_admin',
        roleLabel: 'Super Admin (Open Portal)',
        stateId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // Haryana State UUID
      };
      setUser(mockUser);
      setLoading(false);
    }
    syncSession();
  }, []);

  const login = useCallback(async (beltNumber, password) => {
    // ✅ Secure login via backend (bcrypt check hoga server pe)
    const { token, user: userData } = await api.auth.login(beltNumber, password);

    const sessionUser = {
      ...userData,
      roleLabel: ROLE_LABELS[userData.role] || userData.role,
    };

    localStorage.setItem('oasi_token', token);
    localStorage.setItem('oasi_user', JSON.stringify(sessionUser));
    setUser(sessionUser);
    return sessionUser;
  }, []);

  const logout = useCallback(async () => {
    try { await api.auth.logout(); } catch (_) {}
    localStorage.removeItem('oasi_token');
    localStorage.removeItem('oasi_user');
    setUser(null);
  }, []);

  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  // Permission helpers
  const isSuperAdmin    = user?.role === 'super_admin';
  const isStateAdmin    = user?.role === 'state_admin';
  const isRangeAdmin    = user?.role === 'range_admin';
  const isDistrictAdmin = user?.role === 'district_admin';
  const isUnitAdmin     = user?.role === 'unit_admin';
  const isStaff         = user?.role === 'staff';

  const canManageUnits      = isSuperAdmin || isStateAdmin;
  const canManagePersonnel  = isSuperAdmin || isStateAdmin || isDistrictAdmin || isUnitAdmin;
  const canViewAllDistricts = isSuperAdmin || isStateAdmin;

  const value = {
    user, loading, login, logout,
    isSuperAdmin, isStateAdmin, isRangeAdmin,
    isDistrictAdmin, isUnitAdmin, isStaff,
    canManageUnits, canManagePersonnel, canViewAllDistricts,
    ROLE_LABELS,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
