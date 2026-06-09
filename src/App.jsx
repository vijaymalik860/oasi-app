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
import HierarchyTree from './pages/admin/HierarchyTree';
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
  // Directly render children for open portal
  return children || <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* Organization */}
              <Route path="/hierarchy" element={<HierarchyTree />} />
              <Route path="/dropdown-master" element={<DropdownMaster />} />

              {/* Data */}
              <Route path="/personnel" element={<PersonnelList />} />
              <Route path="/personnel/add" element={<PersonnelForm />} />
              <Route path="/personnel/import" element={<ExcelImport />} />
              <Route path="/personnel/:id" element={<PersonnelForm />} />
              <Route path="/personnel/:id/edit" element={<PersonnelForm />} />
            </Route>

            {/* Redirect root and unknown routes to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
