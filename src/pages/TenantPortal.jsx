import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ClipboardPaste,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  KeyRound,
  LogOut,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { db } from "../services/db";
import { currentMonth, dateLabel, money } from "../lib/utils";

const STORAGE_KEY = "rentuki_tenant_portal_key";

const previewSummary = {
  property_name: "Rental Management System",
  tenant: {
    first_name: "Erika",
    last_name: "Ferolino",
  },
  current_tenancy: {
    unit_number: "204",
    monthly_rent: 15000,
    payment_due_day: 5,
    start_date: "2026-01-05",
  },
  billing: {
    amount_due: 15000,
    status: "due",
  },
  payments: [
    {
      id: "preview-payment-1",
      payment_date: "2026-07-05",
      amount: 15000,
      payment_method: "GCash",
      receipt_number: "REC-1001",
      unit_number: "204",
    },
  ],
  unit_history: [
    {
      id: "preview-tenancy-1",
      unit_number: "204",
      start_date: "2026-01-05",
      monthly_rent: 15000,
      status: "active",
    },
  ],
};

function monthLabel(value) {
  const date = new Date(`${value}-01T00:00:00`);
  return date.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function hasObjectData(value) {
  return value && typeof value === "object" && Object.keys(value).length > 0;
}

export default function TenantPortal() {
  const isPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("preview") === "1";
  const [accessKey, setAccessKey] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [keyInput, setKeyInput] = useState("");
  const [month] = useState(currentMonth());
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
        // Ignore storage failures.
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
    if (isPreview) return;

    if (!accessKey) {
      setLoading(false);
      return;
    }

    loadSummary(accessKey, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessKey, isPreview]);

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

  const submit = (event) => {
    event.preventDefault();

    const normalized = normalizeKey(keyInput);

    if (!normalized) {
      setError("Please enter your access key.");
      return;
    }

    setLoading(true);
    setAccessKey(normalized);
  };

  const portalSummary = isPreview ? previewSummary : summary;
  const tenant = portalSummary?.tenant || {};
  const tenancy = hasObjectData(portalSummary?.current_tenancy)
    ? portalSummary.current_tenancy
    : null;
  const billing = hasObjectData(portalSummary?.billing)
    ? portalSummary.billing
    : null;
  const payments = Array.isArray(portalSummary?.payments)
    ? portalSummary.payments
    : [];
  const history = Array.isArray(portalSummary?.unit_history)
    ? portalSummary.unit_history
    : [];

  const paid = useMemo(
    () =>
      payments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0,
      ),
    [payments],
  );

  const amountDue = Number(billing?.amount_due || 0);
  const balance = Math.max(amountDue - paid, 0);

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
          balance_after_payment: Math.max(amountDue - runningPaid, 0),
        };
      })
      .reverse();
  }, [payments, amountDue]);

  const status =
    balance <= 0 && amountDue > 0
      ? "Paid"
      : paid > 0
        ? "Partially paid"
        : billing?.status
          ? String(billing.status).replaceAll("_", " ")
          : "Not generated";
  if (!isPreview && (!accessKey || !summary)) {
    return (
      <div className="portal-page portal-login-page">
        <div className="portal-login-shell">
          <section className="portal-login-card portal-login-card-simple">
            <div className="portal-login-heading">
              <div className="portal-login-icon">
                <ShieldCheck size={28} />
              </div>

              <span className="portal-login-title">Rental Summary</span>
              <p className="portal-login-subtitle">Private tenant access</p>
            </div>

            <div className="portal-login-info">
              <ShieldCheck size={15} />
              <span>
                Enter the private access key provided by your property
                administrator.
              </span>
            </div>

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
                    placeholder="TENANT-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <button
                    type="button"
                    className="portal-paste-button"
                    aria-label="Paste access key"
                    title="Paste access key"
                    onClick={async () => {
                      try {
                        const pasted = await navigator.clipboard.readText();
                        setKeyInput(pasted.toUpperCase());
                        setError("");
                      } catch {
                        setError(
                          "Clipboard access is unavailable. Please paste the key manually.",
                        );
                      }
                    }}
                  >
                    <ClipboardPaste size={17} />
                  </button>
                </div>
              </label>

              {error && <div className="portal-error">{error}</div>}

              <button
                className="portal-primary"
                type="submit"
                disabled={loading}
              >
                {loading ? "Checking key…" : "Access Portal"}
              </button>
            </form>
            <p className="portal-private-note">
              🔒 Your access key is private and should not be shared.
            </p>
          </section>
        </div>
      </div>
    );
  }

  const firstName = tenant.first_name || tenant.full_name || "Tenant";
  const propertyName = portalSummary.property_name || "Rentuki";

  return (
    <div className="portal-page portal-dashboard-page">
      <header className="portal-topbar">
        <div className="portal-topbar-inner">
          <div className="portal-brand">
            <div className="portal-brand-mark">
              <Building2 size={21} />
            </div>
            <div>
              <strong>{propertyName}</strong>
              <span>Tenant Portal</span>
            </div>
          </div>

          <button className="portal-signout" onClick={signOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <main className="portal-content portal-content-simple">
        <section className="portal-hero portal-hero-simple">
          <div className="portal-welcome">
            <span>Welcome back</span>
            <strong>{firstName}</strong>
          </div>

          <div>
            <span>Current unit</span>
            <Building2 size={17} />
            <strong>
              {tenancy?.unit_number
                ? `Unit ${tenancy.unit_number}`
                : "No active unit"}
            </strong>
            <small>
              {tenancy?.start_date
                ? `Since ${dateLabel(tenancy.start_date)}`
                : "Rental history remains available below"}
            </small>
          </div>

          <div>
            <span>Monthly rent</span>
            <CircleDollarSign size={17} />
            <strong>{money(tenancy?.monthly_rent || 0)}</strong>
            <small>
              {tenancy?.payment_due_day
                ? `Due every ${tenancy.payment_due_day}`
                : "No active tenancy"}
            </small>
          </div>

          <div>
            <span>{monthLabel(month)} balance</span>
            <CircleDollarSign size={17} />
            <strong>{money(balance)}</strong>
            <small
              className={`portal-balance-status ${status.toLowerCase().replaceAll(" ", "-")}`}
            >
              <span /> {status}
            </small>
          </div>
        </section>

        {error && (
          <div className="portal-error portal-dashboard-error">{error}</div>
        )}

        <section className="portal-card portal-payments-card portal-payments-simple">
          <div className="portal-card-head">
            <div className="portal-card-icon">
              <ReceiptText size={18} />
            </div>
            <div>
              <h2>Payment history</h2>
              <p>Your rental payments and receipt references.</p>
            </div>
          </div>

          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Rent period</th>
                  <th>Unit</th>
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
                    <td>
                      {payment.billing_month
                        ? monthLabel(String(payment.billing_month).slice(0, 7))
                        : monthLabel(month)}
                    </td>
                    <td>
                      {payment.unit_number
                        ? `Unit ${payment.unit_number}`
                        : "—"}
                    </td>
                    <td>
                      <strong>{money(payment.amount)}</strong>
                    </td>
                    <td>{payment.payment_method || "—"}</td>
                    <td>{payment.receipt_number || "—"}</td>
                    <td>
                      <strong>{money(payment.balance_after_payment)}</strong>
                    </td>
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

        <section className="portal-card portal-history-card">
          <div className="portal-card-head">
            <div className="portal-card-icon soft-purple">
              <Building2 size={18} />
            </div>
            <div>
              <h2>Unit history</h2>
              <p>
                Previous rental assignments remain available for your records.
              </p>
            </div>
          </div>

          <div className="portal-history-list">
            {history.map((item) => (
              <div className="portal-history-item" key={item.id}>
                <div>
                  <strong>Unit {item.unit_number}</strong>
                  <span>
                    {dateLabel(item.start_date)} —{" "}
                    {item.end_date ? dateLabel(item.end_date) : "Present"}
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

        <footer className="portal-support-note">
          <strong>
            For payment concerns, maintenance requests, or account questions,
            contact your landlord.
          </strong>
        </footer>
      </main>
    </div>
  );
}
