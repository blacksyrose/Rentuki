import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  CreditCard,
  UserPlus,
  Users,
  Wrench,
  Receipt,
  Wallet,
  TrendingUp,
  CircleDollarSign,
} from "lucide-react";

import { db } from "../services/db";
import { useAsync } from "../hooks/useData";
import { currentMonth, money } from "../lib/utils";
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

function getLastSixMonths(monthValue) {
  const [year, month] = String(monthValue || currentMonth())
    .split("-")
    .map(Number);

  const date = new Date(year, (month || 1) - 1, 1);

  return Array.from({ length: 6 }, (_, index) => {
    const value = new Date(date);
    value.setMonth(date.getMonth() - (5 - index));

    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  });
}

function monthShortLabel(monthValue) {
  const date = new Date(`${monthValue}-01T00:00:00`);

  return date.toLocaleDateString("en-US", {
    month: "short",
  });
}

function monthLongLabel(monthValue) {
  const date = new Date(`${monthValue}-01T00:00:00`);

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
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

    path += ` C ${previous.x + dx} ${previous.y}, ${
      current.x - dx
    } ${current.y}, ${current.x} ${current.y}`;
  }

  return path;
}

export default function Dashboard() {
  const units = useAsync(() => db.units.list(), []);
  const tenants = useAsync(() => db.tenants.list(), []);
  const billing = useAsync(() => db.billing.list(currentMonth()), []);
  const maintenance = useAsync(() => db.maintenance.list(), []);
  const expenses = useAsync(() => db.expenses.list(), []);

  const historicalBilling = useAsync(async () => {
    const months = getLastSixMonths(currentMonth());

    const records = await Promise.all(
      months.map((month) => db.billing.list(month)),
    );

    return months.map((month, index) => ({
      month,
      records: records[index] || [],
    }));
  }, []);

  const [hoveredRentIndex, setHoveredRentIndex] = useState(null);
  const [hoveredOccupancy, setHoveredOccupancy] = useState(null);

  const us = units.data || [];
  const ts = tenants.data || [];
  const bs = billing.data || [];
  const ms = maintenance.data || [];
  const es = expenses.data || [];

  /* DASHBOARD NUMBERS */

  const activeTenants = ts.filter((t) => t.status === "active");

  const occupied = us.filter(
    (u) => String(u.status || "").toLowerCase() === "occupied",
  ).length;

  const vacant = Math.max(us.length - occupied, 0);

  const occupancyRate = us.length
    ? Math.round((occupied / us.length) * 1000) / 10
    : 0;

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

  const expensesThis = es
    .filter((expense) =>
      String(expense.expense_date || "").startsWith(currentMonth()),
    )
    .reduce((total, expense) => total + Number(expense.amount || 0), 0);

  const overdue = bs.filter((item) => {
    const due = new Date(item.due_date);

    const paid = (item.payments || []).reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0,
    );

    return (
      !Number.isNaN(due.getTime()) &&
      due < new Date() &&
      Number(item.amount_due || 0) > paid
    );
  }).length;

  const openMaintenance = ms.filter((item) => {
    const status = String(item.status || "").toLowerCase();

    return status === "open" || status === "in progress";
  }).length;

  const netIncome = collected - expensesThis;

  /* EXPENSE BREAKDOWN */

  const expenseBreakdown = useMemo(() => {
    const categories = {};

    es.filter((expense) =>
      String(expense.expense_date || "").startsWith(currentMonth()),
    ).forEach((expense) => {
      const category =
        expense.category || expense.expense_category || expense.type || "Other";

      categories[category] =
        (categories[category] || 0) + Number(expense.amount || 0);
    });

    return Object.entries(categories)
      .map(([category, amount]) => ({
        category,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [es]);

  const maxExpense = Math.max(
    ...expenseBreakdown.map((item) => item.amount),
    1,
  );

  /* RECENT PAYMENTS */

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
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 5);
  }, [bs]);

  /* RECENT MAINTENANCE */

  const recentMaintenance = useMemo(() => {
    return [...ms]
      .sort((a, b) =>
        String(b.reported_date || b.created_at || "").localeCompare(
          String(a.reported_date || a.created_at || ""),
        ),
      )
      .slice(0, 4);
  }, [ms]);

  /* RENT COLLECTION GRAPH */

  const rentCollection = useMemo(() => {
    const months = getLastSixMonths(currentMonth());

    return months.map((month) => {
      const monthData = (historicalBilling.data || []).find(
        (item) => item.month === month,
      );

      const records = monthData?.records || [];

      const expectedAmount = records.reduce(
        (total, record) => total + Number(record.amount_due || 0),
        0,
      );

      const collectedAmount = records.reduce(
        (total, record) =>
          total +
          (record.payments || []).reduce(
            (paymentTotal, payment) =>
              paymentTotal + Number(payment.amount || 0),
            0,
          ),
        0,
      );

      return {
        month,
        label: monthShortLabel(month),
        expected: expectedAmount,
        collected: collectedAmount,
      };
    });
  }, [historicalBilling.data]);

  const rentMax = Math.max(
    ...rentCollection.flatMap((item) => [item.expected, item.collected]),
    1,
  );

  const rentChartPoints = useMemo(() => {
    const left = 0;
    const right = 720;
    const top = 0;
    const bottom = 242;
    const width = right - left;
    const height = bottom - top;

    const toPoint = (item, index, key) => ({
      x:
        rentCollection.length > 1
          ? left + (index / (rentCollection.length - 1)) * width
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

  const occupancyCircumference = 2 * Math.PI * 72;
  const occupancyOffset = occupancyCircumference * (1 - occupancyRate / 100);

  /* RENDER */

  return (
    <div className="dashboard-page">
      {/* HEADER */}

      <div className="page-head dashboard-head">
        <div>
          <h1>{getTimeGreeting()}, Admin</h1>
          <p>Here's what's happening with your properties today.</p>
        </div>
        <div className="actions dashboard-quick-actions">
          <Link
            to="/tenants"
            className="icon-btn"
            aria-label="Add tenant"
            title="Add tenant"
          >
            <UserPlus size={17} />
          </Link>
          <Link
            to="/units"
            className="icon-btn"
            aria-label="Add unit"
            title="Add unit"
          >
            <Building2 size={17} />
          </Link>
          <Link
            to="/payments"
            className="icon-btn"
            aria-label="Record payment"
            title="Record payment"
          >
            <CreditCard size={17} />
          </Link>
          <Link
            to="/maintenance"
            className="icon-btn"
            aria-label="Add expense"
            title="Add expense"
          >
            <Wallet size={17} />
          </Link>
        </div>
      </div>

      {/* SUMMARY CARDS */}

      <div className="stats-grid dashboard-stats dashboard-stats-five">
        <StatCard
          label="Total Units"
          value={us.length}
          hint={`${occupied} currently occupied`}
          icon={Building2}
        />

        <StatCard
          label="Occupied Units"
          value={occupied}
          hint={`${occupancyRate}% occupancy`}
          icon={Users}
          tone="success"
        />

        <StatCard
          label="Expected Rent"
          value={money(expected)}
          hint={currentMonth()}
          icon={CircleDollarSign}
        />

        <StatCard
          label="Collected"
          value={money(collected)}
          hint={
            expected
              ? `${Math.round((collected / expected) * 100)}% of expected`
              : "0% collected"
          }
          icon={TrendingUp}
          tone="success"
        />

        <StatCard
          label="Outstanding"
          value={money(outstanding)}
          hint={`${overdue} overdue · ${openMaintenance} open repairs`}
          icon={Wallet}
          tone={outstanding > 0 ? "warning" : "success"}
        />
      </div>

      {/* CHART ROW */}

      <div className="dashboard-chart-grid">
        {/* RENT COLLECTION */}

        <section className="panel dashboard-chart-card rent-chart-card">
          <div className="panel-head">
            <div>
              <h2>Rent collection</h2>
              <p>Expected vs collected over the last six months</p>
            </div>

            <div className="chart-month">{monthLongLabel(currentMonth())}</div>
          </div>

          <div
            className="rent-chart rent-chart-reference"
            onMouseLeave={() => setHoveredRentIndex(null)}
          >
            <div className="rent-chart-y">
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                <span key={ratio}>{money(rentMax * ratio)}</span>
              ))}
            </div>

            <div className="rent-chart-main">
              <div className="chart-grid-lines">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>

              <svg
                className="rent-svg rent-svg-reference"
                viewBox="0 0 720 270"
                preserveAspectRatio="none"
                aria-label="Rent collection over the last six months"
              >
                <path
                  d={smoothLinePath(rentChartPoints.expected)}
                  fill="none"
                  stroke="#91b9a9"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
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
                          y1="18"
                          y2="242"
                          stroke="#d6ddd9"
                          strokeWidth="1"
                        />
                      )}

                      <circle
                        className={`rent-data-dot${isHovered ? " is-hovered" : ""}`}
                        cx={expectedPoint.x}
                        cy={expectedPoint.y}
                        r="4.5"
                        fill="#91b9a9"
                        stroke="#fff"
                        strokeWidth="1.5"
                      />

                      <circle
                        className={`rent-data-dot${isHovered ? " is-hovered" : ""}`}
                        cx={collectedPoint.x}
                        cy={collectedPoint.y}
                        r="4.8"
                        fill="#fff"
                        stroke="#3d765f"
                        strokeWidth="2.5"
                      />

                      <rect
                        x={expectedPoint.x - 34}
                        y="18"
                        width="68"
                        height="224"
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
                    top: `${Math.max(
                      (hoveredRentPoint.y / 270) * 100 - 2,
                      5,
                    )}%`,
                  }}
                >
                  <strong>{monthShortLabel(hoveredRent.month)}</strong>
                  <span>
                    collected : <b>{money(hoveredRent.collected)}</b>
                  </span>
                  <span>
                    expected : <b>{money(hoveredRent.expected)}</b>
                  </span>
                </div>
              )}

              <div className="rent-chart-x">
                {rentCollection.map((item) => (
                  <span key={item.month}>{item.label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="chart-legend">
            <span>
              <i className="legend-dot expected" />
              Expected {money(expected)}
            </span>

            <span>
              <i className="legend-dot collected" />
              Collected {money(collected)}
            </span>

            <strong className="chart-rate">
              {expected
                ? `${Math.round((collected / expected) * 100)}% collected`
                : "0% collected"}
            </strong>
          </div>
        </section>

        {/* OCCUPANCY */}

        <section className="panel dashboard-chart-card occupancy-card">
          <div className="panel-head">
            <div>
              <h2>Occupancy</h2>
              <p>Current unit status</p>
            </div>
          </div>

          <div className="occupancy-content occupancy-reference">
            <div
              className="occupancy-ring occupancy-ring-reference"
              onMouseLeave={() => setHoveredOccupancy(null)}
            >
              <svg
                className="occupancy-ring-svg"
                viewBox="0 0 200 200"
                aria-label="Occupancy chart"
              >
                <circle
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke="#dfe5e2"
                  strokeWidth="24"
                  onMouseEnter={() => setHoveredOccupancy("vacant")}
                />

                <circle
                  className="occupancy-ring-progress"
                  cx="100"
                  cy="100"
                  r="72"
                  fill="none"
                  stroke="#3d765f"
                  strokeWidth="24"
                  strokeLinecap="butt"
                  strokeDasharray={occupancyCircumference}
                  strokeDashoffset={occupancyOffset}
                  transform="rotate(-90 100 100)"
                  style={{ transformOrigin: "100px 100px" }}
                  onMouseEnter={() => setHoveredOccupancy("occupied")}
                />
              </svg>

              <div className="occupancy-ring-inner">
                <strong>{occupancyRate}%</strong>
                <span>occupied</span>
              </div>

              {hoveredOccupancy && (
                <div className="occupancy-hover-tooltip">
                  {hoveredOccupancy === "occupied"
                    ? `Occupied : ${occupied}`
                    : `Vacant : ${vacant}`}
                </div>
              )}
            </div>

            <div className="occupancy-legend">
              <span>
                <i className="occupancy-dot occupied" />
                Occupied {occupied}
              </span>

              <span>
                <i className="occupancy-dot vacant" />
                Vacant {vacant}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* SECOND CONTENT ROW */}

      <div className="dashboard-content-grid">
        {/* EXPENSE BREAKDOWN */}

        <section className="panel dashboard-chart-card expense-card">
          <div className="panel-head">
            <div>
              <h2>Expense breakdown</h2>
              <p>{currentMonth()} operating costs</p>
            </div>

            <strong className="panel-total">{money(expensesThis)}</strong>
          </div>

          {expenseBreakdown.length ? (
            <div className="expense-chart">
              <div className="expense-plot">
                <div className="expense-y-axis" aria-hidden="true">
                  {[1, 0.75, 0.5, 0.25, 0].map((ratio) => (
                    <span key={ratio}>
                      {(() => {
                        const value = maxExpense * ratio;
                        if (value === 0) return "₱0";
                        if (value >= 1000) {
                          const thousands = value / 1000;
                          return `₱${
                            Number.isInteger(thousands)
                              ? thousands
                              : thousands
                                  .toFixed(2)
                                  .replace(/0+$/, "")
                                  .replace(/\.$/, "")
                          }k`;
                        }
                        return `₱${Math.round(value).toLocaleString("en-PH")}`;
                      })()}
                    </span>
                  ))}
                </div>

                <div className="expense-chart-main">
                  <div className="expense-grid-lines" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>

                  <div className="expense-bars">
                    {expenseBreakdown.slice(0, 6).map((item) => (
                      <div className="expense-column" key={item.category}>
                        <div className="expense-bar-area">
                          <div
                            className="expense-bar"
                            style={{
                              height: `${Math.max(
                                (item.amount / maxExpense) * 100,
                                6,
                              )}%`,
                            }}
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
              title="No expenses recorded yet"
              message="Monthly expenses will appear here."
              className="dashboard-empty"
            />
          )}
        </section>

        {/* RECENT PAYMENTS */}

        <section className="panel dashboard-list-card">
          <div className="panel-head">
            <div>
              <h2>Recent payments</h2>
              <p>Latest recorded transactions</p>
            </div>

            <Link to="/payments" className="panel-link">
              View all
              <ArrowUpRight size={14} />
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
                  <div
                    className="dashboard-payment"
                    key={
                      payment.id || `${payment.date}-${payment.amount}-${index}`
                    }
                  >
                    <div className="dashboard-avatar">{initials || "T"}</div>

                    <div className="dashboard-payment-copy">
                      <strong>{tenantName}</strong>

                      <span>
                        {unitNumber ? `Unit ${unitNumber}` : " "} {" · "}
                        {formatDate(payment.date)}
                      </span>
                    </div>

                    <strong className="dashboard-payment-amount">
                      {money(payment.amount)}
                    </strong>
                  </div>
                );
              })
            ) : (
              <EmptyState
                icon={CreditCard}
                title="No payments recorded yet"
                message="Recorded payments will appear here."
                className="dashboard-empty"
              />
            )}
          </div>
        </section>
      </div>

      {/* THIRD CONTENT ROW */}

      <div className="dashboard-content-grid">
        {/* MAINTENANCE */}

        <section className="panel dashboard-list-card">
          <div className="panel-head">
            <div>
              <h2>Recent maintenance</h2>
              <p>Open and recently resolved requests</p>
            </div>

            <div className="panel-head-actions">
              {openMaintenance > 0 && (
                <span className="dashboard-alert-pill">
                  {openMaintenance} open
                </span>
              )}
              <Link to="/maintenance" className="panel-link">
                View all
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          <div className="maintenance-list">
            {recentMaintenance.length ? (
              recentMaintenance.map((item) => (
                <div className="maintenance-row" key={item.id}>
                  <div className="maintenance-copy">
                    <strong>{item.title || "Maintenance request"}</strong>

                    <span>
                      {item.unit_number ||
                        item.unit?.unit_number ||
                        item.unit?.name ||
                        "Property unit"}{" "}
                      · {formatDate(item.reported_date || item.created_at)}
                    </span>
                  </div>

                  <StatusBadge status={item.status || "open"} />
                </div>
              ))
            ) : (
              <EmptyState
                icon={Wrench}
                title="No maintenance requests yet"
                message="Open requests will appear here."
                className="dashboard-empty"
              />
            )}
          </div>
        </section>

        {/* NET INCOME */}

        <section className="dashboard-net-income">
          <div className="net-income-top">
            <div>
              <span className="net-income-label">Net income</span>

              <strong>{money(netIncome)}</strong>

              <p>Collected rent minus {currentMonth()} expenses</p>
            </div>

            <div className="net-income-icon">
              <TrendingUp size={21} />
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
    </div>
  );
}
