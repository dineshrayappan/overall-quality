import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Database,
  Factory,
  FileSpreadsheet,
  History,
  LogOut,
  Menu,
  Ruler,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Layout() {
  const { user, company, logout, hasPerm } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prodLineOpen, setProdLineOpen] = useState(true);
  const drawerRef = useRef(null);
  const location = useLocation();
  const isProdLineRoute = location.pathname.startsWith('/inspections');

  useEffect(() => {
    setDrawerOpen(false);
    if (isProdLineRoute) {
      setProdLineOpen(true);
    }
  }, [location.pathname, isProdLineRoute]);

  useEffect(() => {
    const dlg = drawerRef.current;
    if (!dlg) return;
    if (drawerOpen && !dlg.open) dlg.showModal();
    else if (!drawerOpen && dlg.open) dlg.close();
  }, [drawerOpen]);

  const productionLineItems = [
    hasPerm('targetChart', 'view') && {
      to: '/inspections/target-charts',
      label: 'Production Line Target Chart',
      Icon: Activity,
    },
    hasPerm('sizeSet', 'view') && {
      to: '/inspections/size-sets',
      label: 'Size Set / Pilot Run / In-line / Mid-line',
      Icon: CheckSquare,
    },
    hasPerm('sevenPoint', 'view') && {
      to: '/inspections/seven-points',
      label: '7 Point Inspection',
      Icon: ClipboardList,
    },
    hasPerm('measurement', 'view') && {
      to: '/inspections/measurements',
      label: 'Measurement Inspection',
      Icon: Ruler,
    },
  ].filter(Boolean);

  const overviewItems = [
    hasPerm('dashboard', 'view') && { to: '/', label: 'Quality Dashboard', Icon: BarChart3 },
  ].filter(Boolean);

  const adminItems = [
    hasPerm('exports', 'excel') && {
      to: '/reports/export',
      label: 'Excel Export Center',
      Icon: FileSpreadsheet,
    },
    hasPerm('masterData', 'view') && {
      to: '/masters',
      label: 'Master Data (16)',
      Icon: Database,
    },
    hasPerm('configuration', 'view') && {
      to: '/configuration',
      label: 'QMS Configuration',
      Icon: Settings,
    },
    hasPerm('users', 'view') && {
      to: '/users',
      label: 'Users & Scope',
      Icon: Users,
    },
    hasPerm('auditLogs', 'view') && {
      to: '/audit-logs',
      label: 'Audit Trail',
      Icon: History,
    },
  ].filter(Boolean);

  const renderNavLinks = () => (
    <>
      {overviewItems.length > 0 && (
        <div>
          <div className="nav-section-label">Overview</div>
          <ul className="nav-list">
            {overviewItems.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      {productionLineItems.length > 0 && (
        <div>
          <div className="nav-section-label">Inspections</div>
          <ul className="nav-list">
            <li>
              <button
                type="button"
                className={`nav-link nav-parent-btn ${isProdLineRoute ? 'parent-active' : ''}`}
                aria-expanded={prodLineOpen}
                onClick={() => setProdLineOpen((prev) => !prev)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Factory size={17} aria-hidden="true" />
                  <span>Production Line</span>
                </span>
                {prodLineOpen ? (
                  <ChevronDown size={15} aria-hidden="true" />
                ) : (
                  <ChevronRight size={15} aria-hidden="true" />
                )}
              </button>

              {prodLineOpen && (
                <ul className="nav-tree">
                  {productionLineItems.map(({ to, label, Icon }) => (
                    <li key={to} className="nav-tree-item">
                      <NavLink
                        to={to}
                        className={({ isActive }) =>
                          `nav-link nav-sub-link ${isActive ? 'active' : ''}`
                        }
                      >
                        <Icon size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
                        <span>{label}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </div>
      )}

      {adminItems.length > 0 && (
        <div>
          <div className="nav-section-label">Administration &amp; Reports</div>
          <ul className="nav-list">
            {adminItems.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <h1>{company?.companyName || 'Garment QMS'}</h1>
          <p>Quality Management &amp; Reporting</p>
        </div>
        {renderNavLinks()}
      </aside>

      <dialog
        ref={drawerRef}
        className="mobile-drawer"
        aria-label="Mobile navigation menu"
        onClose={() => setDrawerOpen(false)}
        onClick={(e) => {
          if (e.target === drawerRef.current) setDrawerOpen(false);
        }}
      >
        <div
          className="sidebar-brand"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div>
            <h1>{company?.companyName || 'Garment QMS'}</h1>
            <p>Quality Management</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-label="Close navigation menu"
            onClick={() => setDrawerOpen(false)}
            autoFocus
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <nav style={{ overflowY: 'auto', flex: 1 }}>{renderNavLinks()}</nav>
      </dialog>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="btn btn-secondary btn-sm mobile-menu-btn"
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={18} aria-hidden="true" />
            </button>
            <h2 className="topbar-title">Digital Garment Quality Management System</h2>
          </div>

          <div className="topbar-right">
            <span className="badge badge-info">{user?.role}</span>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{user?.fullName}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>
              <LogOut size={14} aria-hidden="true" />
              <span>Logout</span>
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

