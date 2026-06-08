import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AuthProvider, { useAuth } from './contexts/AuthContext';
import ToastProvider from './contexts/ToastContext';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PersonnelList from './pages/personnel/PersonnelList';
import PersonnelForm from './pages/personnel/PersonnelForm';
import ExcelImport from './pages/personnel/ExcelImport';
import UnitSetup from './pages/admin/UnitSetup';
import DropdownMaster from './pages/admin/DropdownMaster';
import UserManagement from './pages/admin/UserManagement';
import RoleManagement from './pages/admin/RoleManagement';
import AuditLogs from './pages/admin/AuditLogs';
import DeployManager from './pages/admin/DeployManager';
import AttendanceRegister from './pages/attendance/AttendanceRegister';
import ChitthaList from './pages/chittha/ChitthaList';
import ChitthaEditor from './pages/chittha/ChitthaEditor';
import ChitthaPrintView from './pages/chittha/ChitthaPrintView';
import LeaveRegister from './pages/leave/LeaveRegister';
import LeaveApply from './pages/leave/LeaveApply';
import ReportsDashboard from './pages/reports/ReportsDashboard';
import FIRForm from './pages/reports/FIRForm';
import GrievanceList from './pages/alerts/GrievanceList';
import GrievanceApply from './pages/alerts/GrievanceApply';
import ComingSoon from './components/ComingSoon';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg"></div>
        <p>Loading OASI Portal...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children || <Outlet />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

// AdminRoute allows State Admin, Super Admin, and Range Admin
function AdminRoute({ children }) {
  const { user, loading, isStateAdmin, isSuperAdmin, isRangeAdmin } = useAuth();
  if (loading) return null;
  // Issue #6 Fix: range_admin bhi admin routes access kar sakta hai
  if (!user || (!isStateAdmin && !isSuperAdmin && !isRangeAdmin)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

            {/* Protected */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Personnel */}
              <Route path="/personnel" element={<PersonnelList />} />
              <Route path="/personnel/add" element={<PersonnelForm />} />
              <Route path="/personnel/import" element={<ExcelImport />} />
              <Route path="/personnel/:id" element={<PersonnelForm />} />
              <Route path="/personnel/:id/edit" element={<PersonnelForm />} />

              {/* Unit Setup - Restricted to State Admin/Super Admin */}
              <Route path="/units" element={<AdminRoute><UnitSetup /></AdminRoute>} />
              <Route path="/dropdown-master" element={<AdminRoute><DropdownMaster /></AdminRoute>} />

              {/* Phase 2: Attendance & Chittha */}
              <Route path="/attendance" element={<AttendanceRegister />} />
              <Route path="/chitthas" element={<ChitthaList />} />
              <Route path="/chitthas/new" element={<ChitthaEditor />} />
              <Route path="/chitthas/edit/:id" element={<ChitthaEditor />} />
              <Route path="/chitthas/:id" element={<ChitthaPrintView />} />
              <Route path="/chittha" element={<Navigate to="/chitthas" replace />} />

              {/* Phase 3: Leave Management */}
              <Route path="/leave" element={<LeaveRegister />} />
              <Route path="/leave/apply" element={<LeaveApply />} />

              {/* Phase 4: Reports & Analytics */}
              <Route path="/reports/fir" element={<ReportsDashboard />} />
              <Route path="/reports/fir/add" element={<FIRForm />} />

              {/* Phase 5: Alerts & Grievances */}
              <Route path="/grievances" element={<GrievanceList />} />
              <Route path="/grievances/new" element={<GrievanceApply />} />

              {/* Phase 5+ placeholders */}
              <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
              <Route path="/admin/roles" element={<AdminRoute><RoleManagement /></AdminRoute>} />
              <Route path="/admin/audit-logs" element={<AdminRoute><AuditLogs /></AdminRoute>} />
              <Route path="/admin/deploy" element={<AdminRoute><DeployManager /></AdminRoute>} />
              <Route path="/admin/settings" element={<ComingSoon title="Settings" />} />
            </Route>

            {/* Redirect root */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
