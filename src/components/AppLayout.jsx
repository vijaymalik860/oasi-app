import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, Building2, ClipboardList,
  CalendarCheck, FileText, LogOut, Menu, X,
  Bell, UserCircle, Upload, Settings, ChevronRight,
  Shield, Clock, ArrowRightLeft, MessageSquare, AlertCircle, Database, UserCog
} from 'lucide-react';

const NAV_ITEMS = [
  {
    section: 'Main',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['state_admin', 'range_admin', 'district_admin', 'unit_admin', 'super_admin'] },
    ],
  },
  {
    section: 'Management',
    items: [
      { to: '/units', label: 'Unit Setup', icon: Building2, roles: ['state_admin', 'super_admin'] },
      { to: '/dropdown-master', label: 'Dropdown Master', icon: Database, roles: ['state_admin', 'super_admin'] },
      { to: '/personnel', label: 'Personnel', icon: Users, roles: ['state_admin', 'district_admin', 'unit_admin', 'super_admin'] },
      { to: '/personnel/import', label: 'Import Data', icon: Upload, roles: ['state_admin', 'district_admin', 'unit_admin', 'super_admin'] },
    ],
  },
  {
    section: 'Registers',
    items: [
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck, roles: ['state_admin', 'district_admin', 'unit_admin', 'super_admin'] },
      { to: '/chitthas', label: 'Naukari Chittha', icon: ClipboardList, roles: ['state_admin', 'district_admin', 'unit_admin', 'super_admin'] },
      { to: '/leave', label: 'Leave Register', icon: Clock, roles: ['state_admin', 'range_admin', 'district_admin', 'unit_admin', 'super_admin'] },
      { to: '/transfer', label: 'Transfers', icon: ArrowRightLeft, roles: ['state_admin', 'range_admin', 'district_admin', 'unit_admin', 'super_admin'] },
      { to: '/reports/fir', label: 'FIR & Reports', icon: FileText, roles: ['state_admin', 'range_admin', 'district_admin', 'unit_admin', 'super_admin'] },
    ],
  },
  {
    section: 'Admin',
    items: [
      { to: '/grievances', label: 'Grievances', icon: MessageSquare, roles: ['state_admin', 'district_admin', 'unit_admin', 'staff', 'super_admin'] },
      { to: '/admin/users', label: 'User Management', icon: UserCog, roles: ['state_admin', 'super_admin'] },
      { to: '/admin/roles', label: 'Role Management', icon: Shield, roles: ['state_admin', 'super_admin'] },
      { to: '/admin/settings', label: 'Settings', icon: Settings, roles: ['state_admin', 'super_admin'] },
    ],
  },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const flat = NAV_ITEMS.flatMap(s => s.items);
    // Sort by path length descending so more specific paths match before shorter ones (e.g. /personnel/import before /personnel)
    const sorted = [...flat].sort((a, b) => b.to.length - a.to.length);
    const match = sorted.find(i => location.pathname.startsWith(i.to));
    return match?.label || 'OASI Portal';
  };

  const userInitials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="app-layout">
      {/* Sidebar overlay for mobile */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">O</div>
          <div className="sidebar-brand-text">
            <h1>OASI Portal</h1>
            <span>Haryana Police</span>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((section) => {
            const visibleItems = section.items.filter(
              (item) => item.roles.includes(user?.role)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.section}>
                <div className="sidebar-section-title">{section.section}</div>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="icon" size={20} />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{userInitials}</div>
            <div className="sidebar-user-info">
              <div className="name">{user?.name || 'User'}</div>
              <div className="role">{user?.roleLabel || 'Admin'}</div>
            </div>
          </div>
          <button
            className="sidebar-link"
            onClick={logout}
            style={{ marginTop: 8, color: 'rgba(255,255,255,0.6)' }}
          >
            <LogOut className="icon" size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main-content">
        <header className="top-header">
          <div className="top-header-left">
            <button
              className="menu-toggle"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1 className="top-header-title">{getPageTitle()}</h1>
          </div>
          <div className="top-header-right">
            <div style={{ position: 'relative' }}>
              <button 
                className="header-icon-btn" 
                title="Notifications"
                onClick={() => setAlertsOpen(!alertsOpen)}
              >
                <Bell size={18} />
                {import.meta.env.DEV && <span className="badge">3</span>}
              </button>

              {/* Alerts Dropdown — DEV ONLY placeholder until Phase 5 is implemented */}
              {import.meta.env.DEV && alertsOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 8,
                  width: 320,
                  backgroundColor: '#fff',
                  borderRadius: 8,
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  border: '1px solid var(--gray-200)',
                  zIndex: 100,
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '0.9rem' }}>Notifications</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary-600)', cursor: 'pointer' }}>Mark all read</span>
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {/* Mock Alert 1: WhatsApp Trigger */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 12, cursor: 'pointer', backgroundColor: 'var(--blue-50)' }}>
                      <AlertCircle size={16} style={{ color: 'var(--blue-600)', marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>VIP Duty Assigned (WhatsApp Sent)</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--gray-600)' }}>Ramesh Kumar (1234) assigned to CM Escort Duty.</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--gray-400)' }}>Just now</p>
                      </div>
                    </div>
                    {/* Mock Alert 2: System Trigger */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', gap: 12, cursor: 'pointer' }}>
                      <Clock size={16} style={{ color: 'var(--amber-600)', marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Naukari Chittha Reminder</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--gray-600)' }}>Window closes at 9:00 PM. Please submit.</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--gray-400)' }}>1 hour ago</p>
                      </div>
                    </div>
                    {/* Mock Alert 3: Grievance */}
                    <div style={{ padding: '12px 16px', display: 'flex', gap: 12, cursor: 'pointer' }}>
                      <MessageSquare size={16} style={{ color: 'var(--green-600)', marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>New Grievance Filed</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--gray-600)' }}>Leave pending for 10 days.</p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--gray-400)' }}>2 hours ago</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '8px', borderTop: '1px solid var(--gray-200)', textAlign: 'center' }}>
                    <button className="btn btn-ghost btn-sm" style={{ width: '100%', color: 'var(--primary-600)' }}>View All Alerts</button>
                  </div>
                </div>
              )}
            </div>
            
            <button className="header-icon-btn" title="Profile">
              <UserCircle size={18} />
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
