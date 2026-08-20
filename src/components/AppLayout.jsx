import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  Calculator,
  CreditCard,
  Bell,
  Clock3,
  ChevronDown,
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
import { useEffect, useState } from "react";
import { useAsync } from "../hooks/useData";
import { db } from "../services/db";
import { currentMonth } from "../lib/utils";
import { supabase } from "../lib/supabase";

const nav = [
  ["/", "Dashboard", LayoutDashboard],
  ["/tenants", "Tenant Directory", Users],
  ["/units", "Unit Overview", Building2],
  ["/payments", "Payments", CreditCard],
  ["/maintenance", "Maintenance & Expenses", Wrench],
  ["/summary", "Monthly Summary", CalendarRange],
  ["/receipts", "Receipts", Receipt],
  ["/submeter-calculator", "Calculator", Calculator],
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

function dateKey(date) {
  const value = new Date(date);

  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function getInitials(name) {
  return (
    String(name || "Account")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "A"
  );
}

function getTodayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

function getNotifications(billing, maintenance) {
  const today = new Date();
  const todayKey = dateKey(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowKey = dateKey(tomorrow);
  const notifications = [];

  (billing || []).forEach((record) => {
    const paid = (record.payments || []).reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0,
    );
    const dueDate = String(record.due_date || "").slice(0, 10);
    const tenant = record.tenancies?.tenants;
    const tenantName = [tenant?.first_name, tenant?.last_name]
      .filter(Boolean)
      .join(" ");

    if (Number(record.amount_due || 0) > paid && dueDate < todayKey) {
      notifications.push({
        id: `overdue-${record.id}`,
        type: "danger",
        icon: AlertTriangle,
        title: "Rent overdue",
        detail: tenantName || "A tenant has an overdue balance.",
        to: "/payments",
      });
    } else if (Number(record.amount_due || 0) > paid && dueDate === tomorrowKey) {
      notifications.push({
        id: `due-${record.id}`,
        type: "warning",
        icon: Clock3,
        title: "Rent due tomorrow",
        detail: tenantName || "A rent payment is due tomorrow.",
        to: "/payments",
      });
    }
  });

  (maintenance || [])
    .filter((item) => ["open", "in progress"].includes(String(item.status || "").toLowerCase()))
    .slice(0, 5)
    .forEach((item) => {
      notifications.push({
        id: `maintenance-${item.id}`,
        type: "warning",
        icon: Wrench,
        title: "Maintenance needs attention",
        detail: item.title || "An open maintenance request needs attention.",
        to: "/maintenance",
      });
    });

  return notifications;
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileName, setProfileName] = useState("Account");

  const navigate = useNavigate();
  const location = useLocation();
  const billing = useAsync(() => db.billing.list(currentMonth()), []);
  const maintenance = useAsync(() => db.maintenance.list(), []);
  const notifications = getNotifications(billing.data || [], maintenance.data || []);
  const todayLabel = getTodayLabel();

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;

      const name = data.user?.user_metadata?.full_name;
      const emailName = data.user?.email?.split("@")[0];
      setProfileName(name || emailName || "Account");
    });

    return () => {
      active = false;
    };
  }, []);

  const currentPage =
    Object.entries(pageTitles).find(([path]) =>
      path === "/"
        ? location.pathname === "/"
        : location.pathname === path || location.pathname.startsWith(`${path}/`),
    )?.[1] || "Dashboard";

  const logout = async () => {
    setProfileOpen(false);
    await signOut();
    navigate("/login");
  };

  const goTo = (path) => {
    setProfileOpen(false);
    setNotificationsOpen(false);
    navigate(path);
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

        </nav>

        <div className="sidebar-bottom">
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

            <div className="topbar-context" aria-label={`Today, ${todayLabel}`}>
              <span>Today</span>
              <strong>{todayLabel}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-menu-wrap">
              <button
                className="topbar-icon-btn"
                aria-label={`Notifications${notifications.length ? ` (${notifications.length})` : ""}`}
                title="Notifications"
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  setProfileOpen(false);
                }}
              >
                <Bell size={19} />
                {notifications.length > 0 && (
                  <span className="notification-count">{Math.min(notifications.length, 9)}</span>
                )}
              </button>
              {notificationsOpen && (
                <div className="topbar-dropdown notifications-dropdown">
                  <div className="dropdown-heading">
                    <strong>Notifications</strong>
                    <span>{notifications.length} needing attention</span>
                  </div>
                  {notifications.length ? (
                    notifications.map(({ id, icon: Icon, title, detail, to, type }) => (
                      <button
                        key={id}
                        className="notification-item"
                        onClick={() => goTo(to)}
                      >
                        <span className={`notification-icon ${type}`}><Icon size={16} /></span>
                        <span>
                          <strong>{title}</strong>
                          <small>{detail}</small>
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="dropdown-empty">Nothing needs attention right now.</p>
                  )}
                </div>
              )}
            </div>

            <div className="topbar-menu-wrap">
              <button
                className="profile-btn"
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
                title={profileName}
                onClick={() => {
                  setProfileOpen((value) => !value);
                  setNotificationsOpen(false);
                }}
              >
                <span className="profile-avatar">{getInitials(profileName)}</span>
                <ChevronDown size={14} />
              </button>
              {profileOpen && (
                <div className="topbar-dropdown profile-dropdown">
                  <div className="profile-identity">
                    <strong>{profileName}</strong>
                    <small>Administrator</small>
                  </div>
                  <button onClick={() => goTo("/tenant-portal")}>
                    <ExternalLink size={16} /> Tenant Portal
                  </button>
                  <button onClick={() => goTo("/settings")}>
                    <Settings size={16} /> Settings
                  </button>
                  <button onClick={logout}>
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
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
