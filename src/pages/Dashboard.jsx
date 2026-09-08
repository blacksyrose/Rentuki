import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  CreditCard,
  CircleDollarSign,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

import { db } from "../services/db";
import { useAsync } from "../hooks/useData";
import { currentMonth, money, monthLabel } from "../lib/utils";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTenantName(tenant) {
  if (!tenant) return "Unknown tenant";
  return (
    tenant.name ||
    tenant.full_name ||
    [tenant.first_name, tenant.last_name].filter(Boolean).join(" ") ||
    tenant.fullName ||
    "Unknown tenant"
  );
}

function getAllMonthsOfYear(monthValue) {
  const year = Number(String(monthValue).slice(0, 4)) || new Date().getFullYear();
  return Array.from({ length: 12 }, (_, index) =>
    `${year}-${String(index + 1).padStart(2, "0")}`,
  );
}

function monthShortLabel(monthValue) {
  return new Date(`${monthValue}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
  });
}

function smoothLinePath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const dx = (current.x - previous.x) / 3;
    path += ` C ${previous.x + dx} ${previous.y}, ${current.x - dx} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}

function niceChartMax(value) {
  const numericValue = Number(value) || 0;
  if (numericValue <= 0) return 1;

  const padded = numericValue * 1.1;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const step = normalized <= 2 ? 0.5 : normalized <= 5 ? 1 : 2;
  return Math.ceil(normalized / step) * step * magnitude;
}

export default function Dashboard() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [firstName, setFirstName] = useState("");
  const [hoveredRentIndex, setHoveredRentIndex] = useState(null);

  const units = useAsync(() => db.units.list(), []);
  const billing = useAsync(() => db.billing.list(selectedMonth), [selectedMonth]);
  const maintenance = useAsync(() => db.maintenance.list(), []);
  const expenses = useAsync(() => db.expenses.list(), []);

  const selectedYear = String(selectedMonth).slice(0, 4);

  const historicalBilling = useAsync(async () => {
    const records = await db.billing.listAll();
    const months = getAllMonthsOfYear(selectedMonth);

    return months.map((month) => ({
      month,
      records: (records || []).filter(
        (record) => String(record?.billing_month || "").slice(0, 7) === month,
      ),
    }));
  }, [selectedYear]);

  useEffect(() => {
    const loadUserName = async () => {
      try {
        const profile = await db.profiles.current();
        const fullName = profile?.full_name?.trim() || "";
        setFirstName(fullName.split(/\s+/)[0] || "");
      } catch (error) {
        console.error("Unable to load user name:", error);
      }
    };
    loadUserName();
  }, []);

  const us = units.data || [];
  const bs = billing.data || [];
  const ms = maintenance.data || [];
  const es = expenses.data || [];

  const occupied = us.filter(
    (unit) => String(unit.status || "").toLowerCase() === "occupied",
  ).length;

  const expected = bs.reduce(
    (total, item) => total + Number(item.amount_due || 0),
    0,
  );

  const collected = bs.reduce(
    (total, item) =>
      total +
      (item.payments || []).reduce(
        (paymentTotal, payment) => paymentTotal + Number(payment.amount || 0),
        0,
      ),
    0,
  );

  const outstanding = Math.max(expected - collected, 0);

  const selectedExpenses = useMemo(
    () =>
      es.filter((expense) =>
        String(expense.expense_date || "").startsWith(selectedMonth),
      ),
    [es, selectedMonth],
  );

  const expensesThis = selectedExpenses.reduce(
    (total, expense) => total + Number(expense.amount || 0),
    0,
  );

  const selectedMaintenance = useMemo(
    () =>
      ms.filter((item) =>
        String(item.reported_date || item.created_at || "").startsWith(
          selectedMonth,
        ),
      ),
    [ms, selectedMonth],
  );

  const requestCount = selectedMaintenance.length;
  const openRequests = selectedMaintenance.filter((item) =>
    ["open", "in progress", "in_progress"].includes(
      String(item.status || "").toLowerCase(),
    ),
  ).length;

  const netIncome = collected - expensesThis;

  const expenseBreakdown = useMemo(() => {
    const categories = {};
    selectedExpenses.forEach((expense) => {
      const category =
        expense.category || expense.expense_category || expense.type || "Other";
      categories[category] =
        (categories[category] || 0) + Number(expense.amount || 0);
    });

    return Object.entries(categories)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [selectedExpenses]);

  const maxExpense = niceChartMax(
    Math.max(...expenseBreakdown.map((item) => item.amount), 0),
  );

  const recentPayments = useMemo(() => {
    return bs
      .flatMap((bill) =>
        (bill.payments || []).map((payment) => ({
          ...payment,
          billing: bill,
          amount: Number(payment.amount || 0),
          date: payment.payment_date || payment.created_at,
        })),
      )
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 5);
  }, [bs]);

  const recentMaintenance = useMemo(
    () =>
      [...selectedMaintenance]
        .sort((a, b) =>
          String(b.reported_date || b.created_at || "").localeCompare(
            String(a.reported_date || a.created_at || ""),
          ),
        )
        .slice(0, 4),
    [selectedMaintenance],
  );

  const rentCollection = useMemo(() => {
    return (historicalBilling.data || []).map(({ month, records }) => ({
      month,
      label: monthShortLabel(month),
      expected: (records || []).reduce(
        (total, record) => total + Number(record.amount_due || 0),
        0,
      ),
      collected: (records || []).reduce(
        (total, record) =>
          total +
          (record.payments || []).reduce(
            (paymentTotal, payment) =>
              paymentTotal + Number(payment.amount || 0),
            0,
          ),
        0,
      ),
    }));
  }, [historicalBilling.data]);

  const rentMax = niceChartMax(
    Math.max(...rentCollection.flatMap((item) => [item.expected, item.collected]), 0),
  );

  const rentChartPoints = useMemo(() => {
    const left = 30;
    const right = 690;
    const top = 0;
    const bottom = 136;
    const height = bottom - top;
    const toPoint = (item, index, key) => ({
      x:
        rentCollection.length > 1
          ? left + (index / (rentCollection.length - 1)) * (right - left)
          : (left + right) / 2,
      y: bottom - (item[key] / rentMax) * height,
    });

    return {
      expected: rentCollection.map((item, index) =>
        toPoint(item, index, "expected"),
      ),
      collected: rentCollection.map((item, index) =>
        toPoint(item, index, "collected"),
      ),
    };
  }, [rentCollection, rentMax]);

  const hoveredRent =
    hoveredRentIndex !== null ? rentCollection[hoveredRentIndex] : null;
  const hoveredRentPoint =
    hoveredRentIndex !== null
      ? rentChartPoints.collected[hoveredRentIndex]
      : null;

  return (
    <div className="dashboard-page">
      <div className="page-head dashboard-head">
        <div>
          <h1>
            {getTimeGreeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p>Track and manage your property dashboard.</p>
        </div>

        <div className="actions dashboard-month-actions">
          <input
            className="month-input secondary"
            type="month"
            value={selectedMonth}
            onChange={(event) => {
              const nextMonth = event.target.value;
              if (!nextMonth) return;
              setSelectedMonth(nextMonth);
              setHoveredRentIndex(null);
            }}
            aria-label="Dashboard month and year"
          />
        </div>
      </div>

      <div className="dashboard-summary-layout">
        <div className="dashboard-stat-grid">
          <StatCard
            label="Total Units"
            value={us.length}
            hint="Property inventory"
            icon={Building2}
          />
          <StatCard
            label="Occupied"
            value={occupied}
            hint={us.length ? `${Math.round((occupied / us.length) * 100)}% occupied` : "0% occupied"}
            icon={Users}
            tone="success"
          />
          <StatCard
            label="Requests"
            value={requestCount}
            hint={`${openRequests} open this month`}
            icon={Wrench}
          />
          <StatCard
            label="Expected Rent"
            value={money(expected)}
            hint={monthLabel(selectedMonth)}
            icon={CircleDollarSign}
          />
          <StatCard
            label="Collected"
            value={money(collected)}
            hint={expected ? `${Math.round((collected / expected) * 100)}% collected` : "0% collected"}
            icon={TrendingUp}
            tone="success"
          />
          <StatCard
            label="Outstanding"
            value={money(outstanding)}
            hint={outstanding > 0 ? "Balance remaining" : "Fully collected"}
            icon={Wallet}
            tone={outstanding > 0 ? "warning" : "success"}
          />
        </div>

        <section className="dashboard-net-income">
          <div className="net-income-top">
            <div>
              <span className="net-income-label">Net Income</span>
              <strong>{money(netIncome)}</strong>
              <p>{monthLabel(selectedMonth)}</p>
            </div>
            <div className="net-income-icon">
              <TrendingUp size={20} />
            </div>
          </div>

          <div className="net-income-bottom">
            <div>
              <span>Collected</span>
              <strong>{money(collected)}</strong>
            </div>
            <div>
              <span>Expenses</span>
              <strong>{money(expensesThis)}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="dashboard-main-grid">
<section className="panel dashboard-chart-card rent-chart-card">
          <div className="panel-head">
            <div>
              <h2>Rent Collection</h2>
              <p>Expected vs collected for {selectedYear}</p>
            </div>
            <span className="chart-month">{selectedYear}</span>
          </div>

          <div
            className="rent-chart"
            onMouseLeave={() => setHoveredRentIndex(null)}
          >
            <div className="rent-chart-y">
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                <span key={ratio}>{money(rentMax * ratio)}</span>
              ))}
            </div>

            <div className="rent-chart-main">
              <div className="chart-grid-lines" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>

              <svg
                key={`rent-chart-${selectedYear}`}
                className="rent-svg"
                viewBox="0 0 720 136"
                preserveAspectRatio="none"
                aria-label={`Rent collection for ${selectedYear}`}
              >
                <path
                  className="rent-line rent-line-expected"
                  pathLength="1"
                  d={smoothLinePath(rentChartPoints.expected)}
                  fill="none"
                  stroke="#91b9a9"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  className="rent-line rent-line-collected"
                  pathLength="1"
                  d={smoothLinePath(rentChartPoints.collected)}
                  fill="none"
                  stroke="#3d765f"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {rentCollection.map((item, index) => {
                  const expectedPoint = rentChartPoints.expected[index];
                  const collectedPoint = rentChartPoints.collected[index];
                  const isHovered = hoveredRentIndex === index;

                  return (
                    <g key={item.month}>
                      {isHovered && (
                        <line
                          x1={expectedPoint.x}
                          x2={expectedPoint.x}
                          y1="0"
                          y2="136"
                          stroke="#d6ddd9"
                          strokeWidth="1"
                        />
                      )}
                      <circle
                        cx={expectedPoint.x}
                        cy={expectedPoint.y}
                        r="4"
                        className="rent-point rent-point-expected"
                        fill="#91b9a9"
                        stroke="#fff"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={collectedPoint.x}
                        cy={collectedPoint.y}
                        r="4.5"
                        className="rent-point rent-point-collected"
                        fill="#fff"
                        stroke="#3d765f"
                        strokeWidth="2.5"
                      />
                      <rect
                        x={expectedPoint.x - 30}
                        y="0"
                        width="60"
                        height="136"
                        fill="transparent"
                        onMouseEnter={() => setHoveredRentIndex(index)}
                      />
                    </g>
                  );
                })}
              </svg>

              {hoveredRent && hoveredRentPoint && (
                <div
                  className="rent-hover-tooltip"
                  style={{
                    left: `${(hoveredRentPoint.x / 720) * 100}%`,
                    top: `${Math.max((hoveredRentPoint.y / 136) * 100 - 2, 5)}%`,
                  }}
                >
                  <strong>{monthShortLabel(hoveredRent.month)}</strong>
                  <span>Expected: <b>{money(hoveredRent.expected)}</b></span>
                  <span>Collected: <b>{money(hoveredRent.collected)}</b></span>
                </div>
              )}

              <div className="rent-chart-x">
                {rentCollection.map((item) => (
                  <span key={item.month}>{item.label}</span>
                ))}
              </div>
            </div>
          </div>

        </section>

<section className="panel dashboard-chart-card expense-card">
          <div className="panel-head">
            <div>
              <h2>Expense Breakdown</h2>
              <p>{monthLabel(selectedMonth)} operating costs</p>
            </div>
            <strong className="panel-total">{money(expensesThis)}</strong>
          </div>

          {expenseBreakdown.length ? (
            <div className="expense-chart">
              <div className="expense-plot">
                <div className="expense-y-axis" aria-hidden="true">
                  {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
                    const value = maxExpense * ratio;
                    return (
                      <span key={ratio}>
                        {value >= 1000
                          ? `₱${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k`
                          : `₱${Math.round(value).toLocaleString("en-PH")}`}
                      </span>
                    );
                  })}
                </div>
                <div className="expense-chart-main">
                  <div className="expense-grid-lines" aria-hidden="true">
                    <span /><span /><span /><span /><span />
                  </div>
                  <div className="expense-bars">
                    {expenseBreakdown.map((item) => (
                      <div className="expense-column" key={item.category}>
                        <div className="expense-bar-area">
                          <div
                            key={`${selectedMonth}-${item.category}-${item.amount}`}
                            className="expense-bar"
                            style={{ height: `${Math.max((item.amount / maxExpense) * 100, 6)}%` }}
                          />
                          <div className="expense-hover-tooltip">
                            <strong>{item.category}</strong>
                            <span>{money(item.amount)}</span>
                          </div>
                        </div>
                        <span className="expense-label">{item.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Receipt}
              title="No expenses recorded"
              message={`No expenses were recorded for ${monthLabel(selectedMonth)}.`}
              className="dashboard-empty"
            />
          )}
        </section>
      </div>

      <div className="dashboard-main-grid">
<section className="panel dashboard-list-card">
          <div className="panel-head">
            <div>
              <h2>Recent Payments</h2>
              <p>{monthLabel(selectedMonth)}</p>
            </div>
            <Link to="/payments" className="panel-link">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="dashboard-payment-list">
            {recentPayments.length ? (
              recentPayments.map((payment, index) => {
                const tenancy = payment.billing?.tenancies;
                const tenant = tenancy?.tenants || null;
                const unitNumber = tenancy?.units?.unit_number || null;
                const tenantName = getTenantName(tenant);
                const initials = tenantName
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase();

                return (
                  <div className="dashboard-payment" key={payment.id || `${payment.date}-${payment.amount}-${index}`}>
                    <div className="dashboard-avatar">{initials || "T"}</div>
                    <div className="dashboard-payment-copy">
                      <strong>{tenantName}</strong>
                      <span>{unitNumber ? `Unit ${unitNumber}` : "No unit"} · {formatDate(payment.date)}</span>
                    </div>
                    <strong className="dashboard-payment-amount">{money(payment.amount)}</strong>
                  </div>
                );
              })
            ) : (
              <EmptyState
                icon={CreditCard}
                title="No payments recorded"
                message={`No payments were recorded for ${monthLabel(selectedMonth)}.`}
                className="dashboard-empty"
              />
            )}
          </div>
        </section>

<section className="panel dashboard-list-card">
          <div className="panel-head">
            <div>
              <h2>Recent Maintenance</h2>
              <p>{monthLabel(selectedMonth)}</p>
            </div>
            <Link to="/maintenance" className="panel-link">
              View all <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="maintenance-list">
            {recentMaintenance.length ? (
              recentMaintenance.map((item) => (
                <div className="maintenance-row" key={item.id}>
                  <div className="maintenance-copy">
                    <strong>{item.title || "Maintenance request"}</strong>
                    <span>
                      {item.unit_number || item.units?.unit_number || item.unit?.unit_number || "Property-wide"} · {formatDate(item.reported_date || item.created_at)}
                    </span>
                  </div>
                  <StatusBadge status={item.status || "open"} />
                </div>
              ))
            ) : (
              <EmptyState
                icon={Wrench}
                title="No maintenance requests"
                message={`No requests were reported in ${monthLabel(selectedMonth)}.`}
                className="dashboard-empty"
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
