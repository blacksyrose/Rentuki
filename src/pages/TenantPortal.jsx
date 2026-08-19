import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  KeyRound,
  LogOut,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { db } from "../services/db";
import { currentMonth, dateLabel, money } from "../lib/utils";

const STORAGE_KEY = "rentuki_tenant_portal_key";

function monthLabel(value) {
  const date = new Date(`${value}-01T00:00:00`);
  return date.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

function normalizeKey(value) {
  return String(value || "").trim().toUpperCase();
}

function hasObjectData(value) {
  return value && typeof value === "object" && Object.keys(value).length > 0;
}

export default function TenantPortal() {
  const [accessKey, setAccessKey] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [keyInput, setKeyInput] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(Boolean(accessKey));
  const [error, setError] = useState("");

  const loadSummary = async (key, selectedMonth = month) => {
    const normalized = normalizeKey(key);

    if (!normalized) {
      setSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await db.tenantPortal.summary(normalized, selectedMonth);
      setSummary(data);
      setAccessKey(normalized);
      try {
        sessionStorage.setItem(STORAGE_KEY, normalized);
      } catch {
        // Session storage can be unavailable in hardened/private browser modes.
      }
    } catch (e) {
      setSummary(null);
      setError(e.message || "Unable to load your rental summary.");
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage failures.
      }
      setAccessKey("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessKey) {
      setLoading(false);
      return;
    }

    loadSummary(accessKey, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessKey, month]);

  const signOut = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
    setAccessKey("");
    setSummary(null);
    setKeyInput("");
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    const normalized = normalizeKey(keyInput);

    if (!normalized) {
      setError("Please enter your access key.");
      return;
    }

    setLoading(true);
    setAccessKey(normalized);
  };

  const tenant = summary?.tenant || {};
  const tenancy = hasObjectData(summary?.current_tenancy)
    ? summary.current_tenancy
    : null;
  const billing = hasObjectData(summary?.billing) ? summary.billing : null;
  const payments = Array.isArray(summary?.payments) ? summary.payments : [];
  const history = Array.isArray(summary?.unit_history)
    ? summary.unit_history
    : [];

  const paid = useMemo(
    () => payments.reduce((total, payment) => total + Number(payment.amount || 0), 0),
    [payments],
  );

  const paymentRows = useMemo(() => {
    let runningPaid = 0;

    return payments
      .slice()
      .sort((a, b) => {
        const dateCompare = String(a.payment_date || "").localeCompare(
          String(b.payment_date || ""),
        );

        if (dateCompare !== 0) return dateCompare;

        return String(a.created_at || "").localeCompare(
          String(b.created_at || ""),
        );
      })
      .map((payment) => {
        runningPaid += Number(payment.amount || 0);

        return {
          ...payment,
          balance_after_payment: Math.max(
            Number(billing?.amount_due || 0) - runningPaid,
            0,
          ),
        };
      })
      .reverse();
  }, [payments, billing?.amount_due]);

  const amountDue = Number(billing?.amount_due || 0);
  const balance = Math.max(amountDue - paid, 0);

  const status =
    balance <= 0 && amountDue > 0
      ? "Paid"
      : paid > 0
        ? "Partially paid"
        : billing?.status
          ? String(billing.status).replaceAll("_", " ")
          : "Not generated";

  if (!accessKey || !summary) {
    return (
      <div className="portal-page">
        <div className="portal-shell portal-login-shell">
          <div className="portal-brand">
            <div className="portal-brand-mark">
              <Building2 size={22} />
            </div>
            <div>
              <strong>Rentuki</strong>
              <span>Tenant Portal</span>
            </div>
          </div>

          <section className="portal-login-card">
            <div className="portal-login-icon">
              <ShieldCheck size={28} />
            </div>

            <span className="portal-eyebrow">PRIVATE TENANT ACCESS</span>
            <h1>View your rental summary</h1>
            <p>
              Enter the private access key provided by your property
              administrator. No account or password is required.
            </p>

            <form onSubmit={submit} className="portal-form">
              <label>
                Access key
                <div className="portal-input-wrap">
                  <KeyRound size={18} />
                  <input
                    autoFocus
                    value={keyInput}
                    onChange={(event) => {
                      setKeyInput(event.target.value.toUpperCase());
                      setError("");
                    }}
                    placeholder="TENANT-ABCD-EFGH-IJKL-MNOP"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>
              </label>

              {error && <div className="portal-error">{error}</div>}

              <button className="portal-primary" type="submit" disabled={loading}>
                {loading ? "Checking key…" : "View my summary"}
              </button>
            </form>

            <div className="portal-security-note">
              <ShieldCheck size={15} />
              <span>This portal is read-only. Your rental records cannot be changed here.</span>
            </div>
          </section>

          <p className="portal-footer">
            Need help? Contact your property administrator for a new access key.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-page portal-dashboard-page">
      <header className="portal-topbar">
        <div className="portal-topbar-inner">
          <div className="portal-brand">
            <div className="portal-brand-mark">
              <Building2 size={21} />
            </div>
            <div>
              <strong>{summary.property_name || "Rentuki"}</strong>
              <span>Tenant Portal</span>
            </div>
          </div>

          <button className="portal-signout" onClick={signOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <main className="portal-content">
        <div className="portal-heading">
          <div>
            <span className="portal-eyebrow">RENTAL SUMMARY</span>
            <h1>Welcome back, {tenant.first_name || "Tenant"}</h1>
            <p>Your rental records for the selected month.</p>
          </div>

          <div className="portal-month-control">
            <CalendarDays size={17} />
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </div>
        </div>

        {error && <div className="portal-error portal-dashboard-error">{error}</div>}

        <section className="portal-hero">
          <div>
            <span>Current unit</span>
            <strong>{tenancy?.unit_number ? `Unit ${tenancy.unit_number}` : "No active unit"}</strong>
            <small>
              {tenancy?.status === "active"
                ? `Since ${dateLabel(tenancy.start_date)}`
                : "Rental history remains available below"}
            </small>
          </div>
          <div>
            <span>Monthly rent</span>
            <strong>{money(tenancy?.monthly_rent || 0)}</strong>
            <small>
              {tenancy?.payment_due_day
                ? `Due every ${tenancy.payment_due_day}${tenancy.payment_due_day === 1 ? "st" : tenancy.payment_due_day === 2 ? "nd" : tenancy.payment_due_day === 3 ? "rd" : "th"}`
                : "No active tenancy"}
            </small>
          </div>
          <div>
            <span>{monthLabel(month)} balance</span>
            <strong>{money(balance)}</strong>
            <small>{status}</small>
          </div>
        </section>

        <div className="portal-grid">
          <section className="portal-card portal-payments-card">
            <div className="portal-card-head">
              <div className="portal-card-icon">
                <ReceiptText size={18} />
              </div>
              <div>
                <h2>Payment history</h2>
                <p>{monthLabel(month)} payments and receipt references.</p>
              </div>
            </div>

            <div className="portal-summary-strip">
              <div>
                <span>Amount due</span>
                <strong>{money(amountDue)}</strong>
              </div>
              <div>
                <span>Total paid</span>
                <strong>{money(paid)}</strong>
              </div>
              <div>
                <span>Balance</span>
                <strong>{money(balance)}</strong>
              </div>
            </div>

            {billing && (
              <div className="portal-billing-line">
                <div>
                  <span>Due date</span>
                  <strong>{dateLabel(billing.due_date)}</strong>
                </div>
                <span className={`portal-status ${balance <= 0 && amountDue > 0 ? "paid" : ""}`}>
                  {status}
                </span>
              </div>
            )}

            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Rent period</th>
                    <th>Paid</th>
                    <th>Method</th>
                    <th>Receipt</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((payment) => (
                    <tr key={payment.id}>
                      <td>{dateLabel(payment.payment_date)}</td>
                      <td>{payment.billing_month ? monthLabel(String(payment.billing_month).slice(0, 7)) : monthLabel(month)}</td>
                      <td><strong>{money(payment.amount)}</strong></td>
                      <td>{payment.payment_method || "—"}</td>
                      <td>{payment.receipt_number || "—"}</td>
                      <td><strong>{money(payment.balance_after_payment)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!payments.length && (
              <div className="portal-empty">
                <Clock3 size={20} />
                <strong>No payments recorded</strong>
                <span>Your payment history for this month will appear here.</span>
              </div>
            )}
          </section>

          <aside className="portal-side-stack">
            <section className="portal-card portal-balance-card">
              <div className="portal-card-head">
                <div className="portal-card-icon soft-green">
                  <CircleDollarSign size={18} />
                </div>
                <div>
                  <h2>Monthly balance</h2>
                  <p>{monthLabel(month)}</p>
                </div>
              </div>

              <div className="portal-balance-amount">{money(balance)}</div>

              <div className="portal-balance-row">
                <span>Monthly rent</span>
                <strong>{money(tenancy?.monthly_rent || 0)}</strong>
              </div>
              <div className="portal-balance-row">
                <span>Recorded payments</span>
                <strong>{money(paid)}</strong>
              </div>
              <div className="portal-balance-row">
                <span>Due date</span>
                <strong>{billing?.due_date ? dateLabel(billing.due_date) : "Not generated"}</strong>
              </div>
            </section>

            <section className="portal-card portal-info-card">
              <div className="portal-card-head">
                <div className="portal-card-icon soft-blue">
                  <Building2 size={18} />
                </div>
                <div>
                  <h2>Current rental</h2>
                  <p>Your active assignment</p>
                </div>
              </div>

              <div className="portal-detail-list">
                <div>
                  <span>Unit</span>
                  <strong>{tenancy?.unit_number ? `Unit ${tenancy.unit_number}` : "—"}</strong>
                </div>
                <div>
                  <span>Move-in date</span>
                  <strong>{tenancy?.start_date ? dateLabel(tenancy.start_date) : "—"}</strong>
                </div>
                <div>
                  <span>Payment due</span>
                  <strong>{tenancy?.payment_due_day ? `Day ${tenancy.payment_due_day}` : "—"}</strong>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section className="portal-card portal-history-card">
          <div className="portal-card-head">
            <div className="portal-card-icon soft-purple">
              <ArrowLeft size={18} />
            </div>
            <div>
              <h2>Unit history</h2>
              <p>Previous rental assignments remain available for your records.</p>
            </div>
          </div>

          <div className="portal-history-list">
            {history.map((item) => (
              <div className="portal-history-item" key={item.id}>
                <div>
                  <strong>Unit {item.unit_number}</strong>
                  <span>
                    {dateLabel(item.start_date)} — {item.end_date ? dateLabel(item.end_date) : "Present"}
                  </span>
                </div>
                <div className="portal-history-rent">
                  <strong>{money(item.monthly_rent)}</strong>
                  <span>{item.status}</span>
                </div>
              </div>
            ))}
          </div>

          {!history.length && (
            <div className="portal-empty">
              <Building2 size={20} />
              <strong>No rental history yet</strong>
              <span>Your unit assignments will appear here.</span>
            </div>
          )}
        </section>

        <div className="portal-readonly-footer">
          <ShieldCheck size={15} />
          <span>Read-only tenant portal · For corrections or payment questions, contact your property administrator.</span>
        </div>
      </main>
    </div>
  );
}
