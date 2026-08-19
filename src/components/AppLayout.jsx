import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Calculator,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ExternalLink,
  Receipt,
  Settings,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { signOut } from "../lib/auth";
import { useState } from "react";

const nav = [
  ["/", "Dashboard", LayoutDashboard],
  ["/tenants", "Tenants", Users],
  ["/units", "Units", Building2],
  ["/payments", "Payments", CreditCard],
  ["/maintenance", "Maintenance & Expenses", Wrench],
  ["/summary", "Monthly Summary", BarChart3],
  ["/receipts", "Receipts", Receipt],
  ["/reports", "Reports", FileText],
  ["/submeter-calculator", "Submeter Calculator", Calculator],
  ["/tenant-portal", "Tenant Portal", ExternalLink],
  ["/settings", "Settings", Settings],
];

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const logout = async () => {
    await signOut();
    navigate("/login");
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <strong>Rentuki</strong>
            <small>Rental management</small>
          </div>
          <button className="mobile-close" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="logout" onClick={logout}>
          <LogOut size={18} /> Sign out
        </button>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div>
            <strong>Property Operations</strong>
            <span>Manage tenants, rent and expenses</span>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
