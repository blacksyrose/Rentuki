import { useState } from "react";
import { Download } from "lucide-react";
import { db } from "../services/db";
import { useAsync } from "../hooks/useData";
import { currentMonth, money, csvDownload } from "../lib/utils";

export default function Summary() {
  const [month, setMonth] = useState(currentMonth());
  const b = useAsync(() => db.billing.list(month), [month]),
    e = useAsync(() => db.expenses.list(), []);
  const bills = b.data || [],
    expenses = (e.data || []).filter((x) =>
      String(x.expense_date || "").startsWith(month),
    );
  const expected = bills.reduce((a, x) => a + Number(x.amount_due || 0), 0),
    collected = bills.reduce(
      (a, x) =>
        a + (x.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0),
      0,
    ),
    exp = expenses.reduce((a, x) => a + Number(x.amount || 0), 0);
  const exportCsv = () =>
    csvDownload(
      [
        { metric: "Expected Rent", amount: expected },
        { metric: "Collected Rent", amount: collected },
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
    <div>
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
      <div className="summary-grid">
        <div>
          <span>Expected Rent</span>
          <strong>{money(expected)}</strong>
        </div>
        <div>
          <span>Collected</span>
          <strong>{money(collected)}</strong>
        </div>
        <div>
          <span>Outstanding</span>
          <strong>{money(Math.max(expected - collected, 0))}</strong>
        </div>
        <div>
          <span>Expenses</span>
          <strong>{money(exp)}</strong>
        </div>
        <div className="highlight">
          <span>Net Income</span>
          <strong>{money(collected - exp)}</strong>
        </div>
      </div>
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
            <div className="empty">No expenses recorded this month.</div>
          )}
        </div>
      </section>
    </div>
  );
}
