import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  CalendarRange,
  Calculator,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ExternalLink,
  Receipt,
  Settings,
  Users,
  Wrench,
  X,
  ChevronLeft,
  ChevronRight,
  Home,
} from "lucide-react";

import { signOut } from "../lib/auth";
import { useState } from "react";

const nav = [
  ["/", "Dashboard", LayoutDashboard],
  ["/tenants", "Tenant Directory", Users],
  ["/units", "Unit Overview", Building2],
  ["/payments", "Payments", CreditCard],
  ["/maintenance", "Maintenance & Expenses", Wrench],
  ["/summary", "Monthly Summary", CalendarRange],
  ["/receipts", "Receipts", Receipt],
  ["/submeter-calculator", "Submeter Calculator", Calculator],
];

const pageTitles = {
  "/": "Dashboard",
  "/tenants": "Tenant Directory",
  "/units": "Unit Overview",
  "/payments": "Payments",
  "/maintenance": "Maintenance & Expenses",
  "/summary": "Monthly Summary",
  "/receipts": "Receipts",
  "/submeter-calculator": "Submeter Calculator",
  "/tenant-portal": "Tenant Portal",
  "/settings": "Settings",
};

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const currentPage =
    nav.find(([to]) =>
      to === "/" ? location.pathname === "/" : location.pathname.startsWith(to),
    )?.[1] || "Dashboard";

  const logout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Home size={19} strokeWidth={2.4} />
          </div>

          {!collapsed && (
            <div className="brand-copy">
              <strong>Rentuki</strong>
              <small>Rental management</small>
            </div>
          )}

          <button
            className="mobile-close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Workspace</div>

          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={2} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}

          <div className="nav-divider" />

          <div className="nav-section-label">Access</div>

          <NavLink
            to="/tenant-portal"
            onClick={() => setOpen(false)}
            title={collapsed ? "Tenant Portal" : undefined}
          >
            <ExternalLink size={18} strokeWidth={2} />
            {!collapsed && <span>Tenant Portal</span>}
          </NavLink>

          <NavLink
            to="/settings"
            onClick={() => setOpen(false)}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings size={18} strokeWidth={2} />
            {!collapsed && <span>Settings</span>}
          </NavLink>
        </nav>

        <div className="sidebar-bottom">
          <button
            className="logout"
            onClick={logout}
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut size={18} />
            {!collapsed && <span>Sign Out</span>}
          </button>

          <button
            className="sidebar-collapse"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          </button>
        </div>
      </aside>

      {open && (
        <button
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-btn"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? "Close navigation" : "Open navigation"}
            >
              {open ? <X size={21} /> : <Menu size={21} />}
            </button>

            <div className="topbar-title">
              <span>Property Management</span>
              <strong>{currentPage}</strong>
            </div>
          </div>
        </header>

        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
