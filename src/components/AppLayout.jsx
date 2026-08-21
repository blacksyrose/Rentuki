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
import { useEffect, useRef, useState } from "react";
import { useAsync } from "../hooks/useData";
import { db } from "../services/db";
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
  const todayKey = dateKey(new Date());
  const notifications = [];

  (billing || []).forEach((record) => {
    const paid = (record.payments || []).reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0,
    );
    const amountDue = Number(record.amount_due || 0);
    const balance = Math.max(amountDue - paid, 0);
    const dueDate = String(record.due_date || "").slice(0, 10);
    const tenant = record.tenancies?.tenants;
    const tenantName =
      [tenant?.first_name, tenant?.last_name].filter(Boolean).join(" ") ||
      "Tenant";
    const unitNumber = record.tenancies?.units?.unit_number || "—";

    if (!dueDate || balance <= 0 || record.status === "waived") return;

    const isPartial = paid > 0 && balance > 0;

    let status;
    let type;
    let icon = Clock3;
    let title;
    let sortOrder;

    if (isPartial) {
      status = "Partial";
      type = "partial";
      icon = Clock3;

      if (dueDate < todayKey) {
        title = "Partially paid rent overdue";
      } else if (dueDate === todayKey) {
        title = "Partially paid rent due today";
      } else {
        title = "Partially paid rent";
      }

      sortOrder = 0;
    } else if (dueDate < todayKey) {
      status = "Overdue";
      type = "danger";
      icon = AlertTriangle;
      title = "Rent overdue";
      sortOrder = 1;
    } else if (dueDate === todayKey) {
      status = "Due";
      type = "due";
      title = "Rent due today";
      sortOrder = 2;
    } else {
      status = "Upcoming";
      type = "info";
      title = "Upcoming rent payment";
      sortOrder = 3;
    }

    notifications.push({
      id: `${status.toLowerCase()}-${record.id}`,
      category: "rent",
      status,
      type,
      icon,
      title,
      detail: tenantName,
      meta: `Unit ${unitNumber} · Due ${dueDate}${
        isPartial
          ? ` · Paid ₱${paid.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })}`
          : ""
      }`,
      amount: `₱${balance.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
      })}`,
      amountLabel: isPartial ? "Remaining balance" : "Balance",
      to: `/payments?billingId=${encodeURIComponent(record.id)}`,
      sortOrder,
      isPartial,
    });
  });

  (maintenance || [])
    .filter((item) =>
      ["open", "in_progress"].includes(String(item.status || "").toLowerCase()),
    )
    .forEach((item) => {
      const inProgress =
        String(item.status || "").toLowerCase() === "in_progress";
      const status = inProgress ? "In Progress" : "Pending";

      notifications.push({
        id: `maintenance-${item.id}`,
        category: "maintenance",
        status,
        type: inProgress ? "info" : "warning",
        icon: Wrench,
        title: inProgress ? "Maintenance in progress" : "Maintenance pending",
        detail: item.title || "Maintenance request",
        meta: item.units?.unit_number
          ? `Unit ${item.units.unit_number}`
          : "Property-wide",
        amount: item.priority ? item.priority : "Needs attention",
        amountLabel: item.priority ? "Priority" : "Status",
        to: `/maintenance?maintenanceId=${encodeURIComponent(item.id)}`,
        sortOrder: 4,
      });
    });

  return notifications.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;

    const aDue =
      String(a.meta || "").match(/Due (\d{4}-\d{2}-\d{2})/)?.[1] || "";
    const bDue =
      String(b.meta || "").match(/Due (\d{4}-\d{2}-\d{2})/)?.[1] || "";

    return aDue.localeCompare(bDue);
  });
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState("all");
  const [profileName, setProfileName] = useState("Account");

  const notificationMenuRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  // Notifications need the complete billing history, including previous months.
  const billing = useAsync(() => db.billing.listAll(), []);
  const maintenance = useAsync(() => db.maintenance.list(), []);
  const notifications = getNotifications(
    billing.data || [],
    maintenance.data || [],
  );
  const notificationSummary = notifications.reduce(
    (summary, notification) => {
      if (notification.category === "maintenance") {
        if (notification.status === "Pending") summary.maintenancePending += 1;
        if (notification.status === "In Progress")
          summary.maintenanceInProgress += 1;
      } else if (notification.status === "Partial") {
        summary.partial += 1;
      } else if (notification.status === "Overdue") {
        summary.overdue += 1;
      } else if (notification.status === "Due") {
        summary.due += 1;
      } else if (notification.status === "Upcoming") {
        summary.upcoming += 1;
      }
      return summary;
    },
    {
      partial: 0,
      overdue: 0,
      due: 0,
      upcoming: 0,
      maintenancePending: 0,
      maintenanceInProgress: 0,
    },
  );

  const filteredNotifications =
    notificationFilter === "all"
      ? notifications
      : notifications.filter((notification) => {
          if (notificationFilter === "partial")
            return notification.status === "Partial";
          if (notificationFilter === "overdue")
            return notification.status === "Overdue";
          if (notificationFilter === "due")
            return notification.status === "Due";
          if (notificationFilter === "upcoming")
            return notification.status === "Upcoming";
          if (notificationFilter === "maintenancePending") {
            return (
              notification.category === "maintenance" &&
              notification.status === "Pending"
            );
          }
          if (notificationFilter === "maintenanceInProgress") {
            return (
              notification.category === "maintenance" &&
              notification.status === "In Progress"
            );
          }
          return true;
        });
  useEffect(() => {
    const refreshNotifications = () => {
      billing.refresh();
      maintenance.refresh();
    };

    window.addEventListener("focus", refreshNotifications);

    return () => {
      window.removeEventListener("focus", refreshNotifications);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationMenuRef.current &&
        !notificationMenuRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
        : location.pathname === path ||
          location.pathname.startsWith(`${path}/`),
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
            <div className="topbar-menu-wrap" ref={notificationMenuRef}>
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
                  <span className="notification-count">
                    {notifications.length > 99 ? "99+" : notifications.length}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="topbar-dropdown notifications-dropdown">
                  <div className="dropdown-heading notification-heading">
                    <div className="notification-heading-main">
                      <div>
                        <strong>Notifications</strong>
                        <span>
                          {notifications.length} item
                          {notifications.length === 1 ? "" : "s"} needing
                          attention
                        </span>
                      </div>
                    </div>

                    {notifications.length > 0 && (
                      <div
                        className="notification-summary"
                        role="tablist"
                        aria-label="Notification filters"
                      >
                        <button
                          type="button"
                          className={`notification-summary-pill all ${notificationFilter === "all" ? "active" : ""}`}
                          onClick={() => setNotificationFilter("all")}
                        >
                          All ({notifications.length})
                        </button>

                        {notificationSummary.partial > 0 && (
                          <button
                            type="button"
                            className={`notification-summary-pill partial ${notificationFilter === "partial" ? "active" : ""}`}
                            onClick={() => setNotificationFilter("partial")}
                          >
                            Partial ({notificationSummary.partial})
                          </button>
                        )}

                        {notificationSummary.overdue > 0 && (
                          <button
                            type="button"
                            className={`notification-summary-pill danger ${notificationFilter === "overdue" ? "active" : ""}`}
                            onClick={() => setNotificationFilter("overdue")}
                          >
                            Overdue ({notificationSummary.overdue})
                          </button>
                        )}

                        {notificationSummary.due > 0 && (
                          <button
                            type="button"
                            className={`notification-summary-pill due ${notificationFilter === "due" ? "active" : ""}`}
                            onClick={() => setNotificationFilter("due")}
                          >
                            Due ({notificationSummary.due})
                          </button>
                        )}

                        {notificationSummary.upcoming > 0 && (
                          <button
                            type="button"
                            className={`notification-summary-pill info ${notificationFilter === "upcoming" ? "active" : ""}`}
                            onClick={() => setNotificationFilter("upcoming")}
                          >
                            Upcoming ({notificationSummary.upcoming})
                          </button>
                        )}

                        {notificationSummary.maintenancePending > 0 && (
                          <button
                            type="button"
                            className={`notification-summary-pill warning ${notificationFilter === "maintenancePending" ? "active" : ""}`}
                            onClick={() =>
                              setNotificationFilter("maintenancePending")
                            }
                          >
                            Pending ({notificationSummary.maintenancePending})
                          </button>
                        )}

                        {notificationSummary.maintenanceInProgress > 0 && (
                          <button
                            type="button"
                            className={`notification-summary-pill info ${notificationFilter === "maintenanceInProgress" ? "active" : ""}`}
                            onClick={() =>
                              setNotificationFilter("maintenanceInProgress")
                            }
                          >
                            In Progress (
                            {notificationSummary.maintenanceInProgress})
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {filteredNotifications.length ? (
                    <div className="notifications-list">
                      {filteredNotifications.map(
                        ({
                          id,
                          icon: Icon,
                          title,
                          detail,
                          meta,
                          amount,
                          amountLabel,
                          to,
                          type,
                        }) => (
                          <button
                            key={id}
                            type="button"
                            className="notification-item"
                            onClick={() => goTo(to)}
                          >
                            <span className={`notification-icon ${type}`}>
                              <Icon size={17} strokeWidth={2} />
                            </span>

                            <span className="notification-copy">
                              <strong className={`notification-title ${type}`}>
                                {title}
                              </strong>

                              <strong className="notification-entity">
                                {detail}
                              </strong>

                              <small>{meta}</small>

                              <span className="notification-item-bottom">
                                <span className="notification-balance">
                                  <small>{amountLabel}</small>
                                  <strong>{amount}</strong>
                                </span>
                              </span>
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="dropdown-empty">
                      No{" "}
                      {notificationFilter === "all" ? "" : notificationFilter}{" "}
                      notifications.
                    </p>
                  )}

                  <button
                    type="button"
                    className="notification-footer"
                    onClick={() => goTo("/payments")}
                  >
                    <span className="notification-footer-icon">
                      <Receipt size={16} />
                    </span>
                    <span>
                      <strong>Go to Payments</strong>
                      <small>View all billing and payment records</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
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
                <span className="profile-avatar">
                  {getInitials(profileName)}
                </span>
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
