import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
  Plus,
} from "lucide-react";

import { signOut } from "../lib/auth";
import { useEffect, useRef, useState } from "react";
import { useAsync } from "../hooks/useData";
import { db } from "../services/db";
import { supabase } from "../lib/supabase";

const workspaceNav = [
  ["/", "Dashboard", LayoutDashboard],
  ["/tenants", "Tenants", Users],
  ["/units", "Units", Building2],
  ["/payments", "Payments", CreditCard],
  ["/maintenance", "Maintenance & Expenses", Wrench],
];

const financeNav = [
  ["/summary", "Monthly Summary", CalendarRange],
  ["/receipts", "Receipts", Receipt],
  ["/submeter-calculator", "Calculator", Calculator],
];

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
  const [createOpen, setCreateOpen] = useState(false);

  const notificationMenuRef = useRef(null);
  const createMenuRef = useRef(null);

  const navigate = useNavigate();
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
  const refreshNotifications = () => {
    billing.refresh();
    maintenance.refresh();
  };

  useEffect(() => {
    const intervalId = window.setInterval(refreshNotifications, 5000);
    window.addEventListener("focus", refreshNotifications);
    window.addEventListener("rentuki:data-changed", refreshNotifications);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshNotifications);
      window.removeEventListener("rentuki:data-changed", refreshNotifications);
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

      if (
        createMenuRef.current &&
        !createMenuRef.current.contains(event.target)
      ) {
        setCreateOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  const logout = async () => {
    setProfileOpen(false);
    await signOut();
    navigate("/login");
  };

  const goTo = (path) => {
    setProfileOpen(false);
    setNotificationsOpen(false);
    setCreateOpen(false);
    navigate(path);
  };

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-identity">
            <div className="brand-mark">
              <Home size={19} strokeWidth={2.4} />
            </div>

            {!collapsed && (
              <div className="brand-copy">
                <strong>Rentuki</strong>
              </div>
            )}
          </div>

          <div className="brand-actions">
            <button
              className="sidebar-collapse brand-collapse"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight size={16} />
              ) : (
                <ChevronLeft size={16} />
              )}
            </button>

            <button
              className="mobile-close"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Workspace</div>

          {workspaceNav.map(([to, label, Icon]) => (
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
          <div className="nav-section-label">Finance</div>

          {financeNav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={2} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-utility-nav">
            <NavLink
              to="/tenant-portal"
              onClick={() => setOpen(false)}
              title={collapsed ? "Tenant Portal" : undefined}
            >
              <ExternalLink size={17} strokeWidth={2} />
              {!collapsed && <span>Tenant Portal</span>}
            </NavLink>
            <NavLink
              to="/settings"
              onClick={() => setOpen(false)}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings size={17} strokeWidth={2} />
              {!collapsed && <span>Settings</span>}
            </NavLink>
          </div>
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
          </div>

          <div className="topbar-right">
            <div className="topbar-menu-wrap create-menu-wrap" ref={createMenuRef}>
              <button
                type="button"
                className={`create-action-btn ${createOpen ? "active" : ""}`}
                aria-label="Create or add"
                aria-expanded={createOpen}
                title="Create or add"
                onClick={() => {
                  setCreateOpen((value) => !value);
                  setNotificationsOpen(false);
                  setProfileOpen(false);
                }}
              >
                <Plus size={18} strokeWidth={2.3} />
                <ChevronDown
                  size={13}
                  className={`create-action-chevron ${createOpen ? "open" : ""}`}
                />
              </button>

              {createOpen && (
                <div className="topbar-dropdown create-dropdown">
                  <div className="create-dropdown-heading">
                    <strong>Action</strong>
                    <span>Create a new record</span>
                  </div>

                  <button type="button" onClick={() => goTo("/tenants?create=tenant")}>
                    <span className="create-item-icon">
                      <Users size={17} />
                    </span>
                    <span className="create-item-copy">
                      <strong>Tenant</strong>
                      <small>Create a new tenant record</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>

                  <button type="button" onClick={() => goTo("/units?create=unit")}>
                    <span className="create-item-icon">
                      <Building2 size={17} />
                    </span>
                    <span className="create-item-copy">
                      <strong>Unit</strong>
                      <small>Add a new property unit</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>

                  <div className="create-menu-group">
                    <div className="create-menu-group-button">
                      <span className="create-item-icon">
                        <CreditCard size={17} />
                      </span>
                      <span className="create-item-copy">
                        <strong>Payment</strong>
                        <small>Record a payment</small>
                      </span>
                    </div>
                    <div className="create-submenu">
                      <button type="button" onClick={() => goTo("/payments?create=payment&type=rent")}>
                        <span>Rent</span>
                        <small>Monthly rent payment</small>
                      </button>
                      <button type="button" onClick={() => goTo("/payments?create=payment&type=deposit")}>
                        <span>Deposit</span>
                        <small>Security deposit</small>
                      </button>
                      <button type="button" onClick={() => goTo("/payments?create=payment&type=advance")}>
                        <span>Advance</span>
                        <small>Advance rent</small>
                      </button>
                    </div>
                  </div>

                  <div className="create-menu-group">
                    <div className="create-menu-group-button">
                      <span className="create-item-icon">
                        <Wrench size={17} />
                      </span>
                      <span className="create-item-copy">
                        <strong>Maintenance & Expenses</strong>
                        <small>Request / Record </small>
                      </span>
                    </div>
                    <div className="create-submenu">
                      <button type="button" onClick={() => goTo("/maintenance?create=maintenance")}>
                        <span>Maintenance Request</span>
                        <small>Report a repair or issue</small>
                      </button>
                      <button type="button" onClick={() => goTo("/maintenance?create=expense")}>
                        <span>Expense</span>
                        <small>Record an operating expense</small>
                      </button>
                    </div>
                  </div>

                  <button type="button" onClick={() => goTo("/receipts?generate=1")}>
                    <span className="create-item-icon">
                      <Receipt size={17} />
                    </span>
                    <span className="create-item-copy">
                      <strong>Generate Receipt</strong>
                      <small>Generate a receipt from a payment</small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </div>

            <div className="topbar-menu-wrap" ref={notificationMenuRef}>
              <button
                className="topbar-icon-btn"
                aria-label={`Notifications${notifications.length ? ` (${notifications.length})` : ""}`}
                title="Notifications"
                onClick={() => {
                  refreshNotifications();
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
                            className={`notification-summary-pill upcoming ${
                              notificationFilter === "upcoming" ? "active" : ""
                            }`}
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
                <span className="profile-header-copy">
                  <strong>{profileName}</strong>
                  <small>Administrator</small>
                </span>
                <ChevronDown size={14} />
              </button>
              {profileOpen && (
                <div className="topbar-dropdown profile-dropdown">
                  <div className="profile-identity">
                    <strong>{profileName}</strong>
                    <small>Administrator</small>
                  </div>
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
