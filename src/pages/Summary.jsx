import { useState } from "react";
import { Download, FileText, Receipt, Wallet } from "lucide-react";
import EmptyState from "../components/EmptyState";
import { db } from "../services/db";
import { useAsync } from "../hooks/useData";
import {
  compareUnitNumbers,
  currentMonth,
  money,
  csvDownload,
} from "../lib/utils";

function formatSummaryPaymentMethod(value) {
  const method = String(value || "")
    .trim()
    .toLowerCase();

  if (method === "gcash" || method === "g-cash") return "G-Cash";
  if (
    ["maribank", "bank transfer", "bank_transfer", "maya", "other"].includes(
      method,
    )
  ) {
    return "Maribank";
  }

  if (method === "cash") return "Cash";
  return value ? String(value) : "—";
}

function getPaymentMethodClass(value) {
  const method = String(value || "")
    .trim()
    .toLowerCase();

  if (method === "gcash" || method === "g-cash") return "gcash";
  if (
    ["maribank", "bank transfer", "bank_transfer", "maya", "other"].includes(
      method,
    )
  ) {
    return "maribank";
  }

  if (method === "cash") return "cash";
  return "other";
}

function formatSummaryPaymentType(value) {
  return String(value || "other")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getPaymentTypeClass(value) {
  const type = String(value || "")
    .trim()
    .toLowerCase();

  if (type === "rent") return "rent";
  if (type === "deposit") return "deposit";
  if (type === "advance") return "advance";
  return "other";
}

export default function Summary() {
  const [month, setMonth] = useState(currentMonth());
  const b = useAsync(() => db.billing.list(month), [month]),
    p = useAsync(() => db.payments.list(), [month]),
    e = useAsync(() => db.expenses.list(), []),
    u = useAsync(() => db.units.list(), []);
  const bills = [...(b.data || [])].sort((a, b) =>
      compareUnitNumbers(
        a.tenancies?.units?.unit_number || a.unit_id,
        b.tenancies?.units?.unit_number || b.unit_id,
      ),
    ),
    payments = (p.data || []).filter((x) =>
      String(x.payment_date || "").startsWith(month),
    ),
    expenses = (e.data || []).filter((x) =>
      String(x.expense_date || "").startsWith(month),
    ),
    otherPaymentRows = payments
      .filter(
        (payment) => payment.payment_type && payment.payment_type !== "rent",
      )
      .sort(
        (a, b) =>
          compareUnitNumbers(
            a.tenancies?.units?.unit_number,
            b.tenancies?.units?.unit_number,
          ) ||
          String(a.payment_date || "").localeCompare(
            String(b.payment_date || ""),
          ) ||
          String(a.created_at || "").localeCompare(String(b.created_at || "")),
      );
  const expected = bills.reduce((a, x) => a + Number(x.amount_due || 0), 0),
    collected = bills.reduce(
      (a, x) =>
        a +
        (x.payments || []).reduce(
          (s, payment) => s + Number(payment.amount || 0),
          0,
        ),
      0,
    ),
    securityDeposits = payments
      .filter((payment) => payment.payment_type === "deposit")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    advanceRent = payments
      .filter((payment) => payment.payment_type === "advance")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    otherPayments = payments
      .filter(
        (payment) =>
          payment.payment_type &&
          !["rent", "advance", "deposit"].includes(payment.payment_type),
      )
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    exp = expenses.reduce((a, x) => a + Number(x.amount || 0), 0);
  const exportCsv = () =>
    csvDownload(
      [
        { metric: "Expected Rent", amount: expected },
        { metric: "Collected Rent", amount: collected },
        { metric: "Security Deposits", amount: securityDeposits },
        { metric: "Advance Rent", amount: advanceRent },
        { metric: "Other Tenant Payments", amount: otherPayments },
        {
          metric: "Outstanding Rent",
          amount: Math.max(expected - collected, 0),
        },
        { metric: "Expenses", amount: exp },
        { metric: "Net Income", amount: collected - exp },
      ],
      `monthly-summary-${month}.csv`,
    );
  return (
    <div className="summary-page">
      <div className="page-head">
        <div>
          <h1>Monthly Summary</h1>
          <p>Income, collections, balances and expenses.</p>
        </div>
        <div className="actions">
          <input
            className="month-input"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button className="secondary" onClick={exportCsv}>
            <Download size={16} /> CSV
          </button>
        </div>
      </div>
      <div className="summary-stats">
        <div className="summary-stat">
          <span>Total units</span>
          <strong>{u.loading ? "…" : (u.data || []).length}</strong>
        </div>
        <div className="summary-stat">
          <span>Occupied</span>
          <strong>
            {new Set(bills.map((x) => x.tenancy_id).filter(Boolean)).size ||
              "0"}
          </strong>
        </div>
        <div className="summary-stat">
          <span>Expected rent</span>
          <strong>{money(expected)}</strong>
        </div>
        <div className="summary-stat">
          <span>Rent collected</span>
          <strong className="green-value">{money(collected)}</strong>
        </div>
        <div className="summary-stat">
          <span>Collection rate</span>
          <strong>
            {expected > 0
              ? `${((collected / expected) * 100).toFixed(1)}%`
              : "0.0%"}
          </strong>
        </div>
      </div>

      <div className="summary-main-grid">
        <section className="panel tenant-payment-panel">
          <div className="panel-head">
            <div>
              <h2>Payment summary</h2>
              <p>Summary of Rental collections</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Unit</th>
                  <th>Monthly rent</th>
                  <th>Due date</th>
                  <th>Amount due</th>
                  <th>Total paid</th>
                  <th>Payment method</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((record) => {
                  const paid = (record.payments || []).reduce(
                    (sum, payment) => sum + Number(payment.amount || 0),
                    0,
                  );
                  const amountDue = Number(record.amount_due || 0);
                  const balance = Math.max(amountDue - paid, 0);
                  const tenant = record.tenancies?.tenants;
                  const paymentMethods = [
                    ...new Set(
                      (record.payments || [])
                        .map((payment) =>
                          formatSummaryPaymentMethod(payment.payment_method),
                        )
                        .filter((method) => method !== "—"),
                    ),
                  ];

                  return (
                    <tr key={record.id}>
                      <td>
                        <strong>
                          {tenant?.first_name || "—"} {tenant?.last_name || ""}
                        </strong>
                      </td>
                      <td>{record.tenancies?.units?.unit_number || "—"}</td>
                      <td>
                        {money(record.tenancies?.monthly_rent || amountDue)}
                      </td>
                      <td>{record.due_date || "—"}</td>
                      <td>{money(amountDue)}</td>
                      <td>{money(paid)}</td>
                      <td>
                        <div className="summary-payment-methods">
                          {paymentMethods.length ? (
                            paymentMethods.map((method) => (
                              <span
                                key={method}
                                className={`summary-payment-method ${getPaymentMethodClass(
                                  method,
                                )}`}
                              >
                                {method}
                              </span>
                            ))
                          ) : (
                            <span className="summary-payment-method empty">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong>{money(balance)}</strong>
                      </td>
                      <td>
                        <span
                          className={`payment-status-badge ${
                            balance <= 0 && amountDue > 0
                              ? "paid"
                              : balance > 0 && paid > 0
                                ? "partial"
                                : month > currentMonth()
                                  ? "not-due"
                                  : record.due_date <
                                      new Date().toISOString().slice(0, 10)
                                    ? "overdue"
                                    : record.due_date ===
                                        new Date().toISOString().slice(0, 10)
                                      ? "due"
                                      : "upcoming"
                          }`}
                        >
                          {balance <= 0 && amountDue > 0
                            ? "Paid"
                            : balance > 0 && paid > 0
                              ? "Partially Paid"
                              : month > currentMonth()
                                ? "Not Due"
                                : record.due_date <
                                    new Date().toISOString().slice(0, 10)
                                  ? "Overdue"
                                  : record.due_date ===
                                      new Date().toISOString().slice(0, 10)
                                    ? "Due"
                                    : "Upcoming"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {!bills.length && (
                  <tr>
                    <td colSpan="9">
                      <EmptyState
                        icon={FileText}
                        title="No billing records yet"
                        message="Monthly billing records will appear here."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="summary-outstanding">
          <div>
            <span>Outstanding balance</span>
            <strong>{money(Math.max(expected - collected, 0))}</strong>
          </div>
          <div className="outstanding-details">
            <p>
              <span>Collected</span>
              <strong>{money(collected)}</strong>
            </p>
            <p>
              <span>Expected</span>
              <strong>{money(expected)}</strong>
            </p>
          </div>
          <div className="collection-bar">
            <div
              style={{
                width: `${Math.min(expected > 0 ? (collected / expected) * 100 : 0, 100)}%`,
              }}
            />
          </div>
          <small>
            {expected > 0
              ? `${((collected / expected) * 100).toFixed(1)}%`
              : "0.0%"}{" "}
            collection rate
          </small>
        </section>
      </div>

      <section className="panel other-payments-panel">
        <div className="panel-head">
          <div>
            <h2>Other Payments</h2>
            <p>Deposits, advance rent, and other payment types.</p>
          </div>
        </div>
        <div className="table-wrap other-payments-table-wrap">
          <table className="other-payments-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Unit</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Date Paid</th>
                <th>MOP</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {otherPaymentRows.map((payment) => {
                const amount = Number(payment.amount || 0);
                const tenant = payment.tenants;
                const unit = payment.tenancies?.units?.unit_number || "—";
                const paymentType = formatSummaryPaymentType(
                  payment.payment_type,
                );

                return (
                  <tr key={payment.id}>
                    <td>
                      <strong>
                        {tenant?.first_name || "—"} {tenant?.last_name || ""}
                      </strong>
                    </td>
                    <td>{unit}</td>
                    <td>
                      <span
                        className={`summary-payment-type ${getPaymentTypeClass(
                          payment.payment_type,
                        )}`}
                      >
                        {paymentType}
                      </span>
                    </td>
                    <td>{money(amount)}</td>
                    <td>{money(amount)}</td>
                    <td>
                      <strong>{money(0)}</strong>
                    </td>
                    <td>{payment.payment_date || "—"}</td>
                    <td>
                      <span
                        className={`summary-payment-method ${getPaymentMethodClass(
                          payment.payment_method,
                        )}`}
                      >
                        {formatSummaryPaymentMethod(payment.payment_method)}
                      </span>
                    </td>
                    <td>{payment.notes || "—"}</td>
                  </tr>
                );
              })}
              {!otherPaymentRows.length && (
                <tr>
                  <td colSpan="9">
                    <EmptyState
                      icon={Wallet}
                      title="No other payments yet"
                      message="Deposits and advance rent will appear here."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Expense breakdown</h2>
            <p>By category for {month}</p>
          </div>
        </div>
        <div className="category-list">
          {Object.entries(
            expenses.reduce(
              (a, x) => (
                (a[x.category] = (a[x.category] || 0) + Number(x.amount || 0)),
                a
              ),
              {},
            ),
          ).map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <strong>{money(v)}</strong>
            </div>
          ))}
          {!expenses.length && (
            <EmptyState
              icon={Receipt}
              title="No expenses recorded yet"
              message="Monthly expenses will appear here."
            />
          )}
        </div>
      </section>
    </div>
  );
}
