import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Pencil, Receipt, Search, Trash2, Wrench } from "lucide-react";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { db } from "../services/db";
import { useAsync } from "../hooks/useData";
import { compareUnitNumbers, money } from "../lib/utils";
import { useToast } from "../components/Toast";

const emptyMaintenanceForm = () => ({
  unit_id: "",
  title: "",
  description: "",
  priority: "medium",
  status: "open",
  assigned_person: "",
  estimated_cost: "",
  actual_cost: "",
  reported_date: new Date().toISOString().slice(0, 10),
});

const emptyExpenseForm = () => ({
  unit_id: "",
  category: "Salary",
  description: "",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  vendor: "",
  payment_method: "",
  reference: "",
  notes: "",
});

export default function Maintenance() {
  const maintenance = useAsync(() => db.maintenance.list(), []);
  const expenses = useAsync(() => db.expenses.list(), []);
  const units = useAsync(() => db.units.list(), []);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState("maintenance");
  const [open, setOpen] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [form, setForm] = useState(emptyMaintenanceForm());
  const [search, setSearch] = useState("");
  const toast = useToast();

  useEffect(() => {
    const create = searchParams.get("create");

    if (create !== "maintenance" && create !== "expense") return;

    const nextTab = create === "expense" ? "expenses" : "maintenance";

    setTab(nextTab);
    setEditingMaintenance(null);
    setEditingExpense(null);
    setForm(
      nextTab === "maintenance" ? emptyMaintenanceForm() : emptyExpenseForm(),
    );
    setOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                */
  /* ---------------------------------------------------------------------- */

  const refreshAll = async () => {
    await Promise.all([maintenance.refresh(), expenses.refresh()]);
  };

  const closeModal = () => {
    setOpen(false);
    setEditingMaintenance(null);
    setEditingExpense(null);
    setForm(
      tab === "maintenance" ? emptyMaintenanceForm() : emptyExpenseForm(),
    );
  };

  /* ---------------------------------------------------------------------- */
  /* Open create                                                             */
  /* ---------------------------------------------------------------------- */

  const openCreate = () => {
    setEditingMaintenance(null);
    setEditingExpense(null);

    setForm(
      tab === "maintenance" ? emptyMaintenanceForm() : emptyExpenseForm(),
    );

    setOpen(true);
  };

  /* ---------------------------------------------------------------------- */
  /* Open maintenance edit                                                   */
  /* ---------------------------------------------------------------------- */

  const openEditMaintenance = (item) => {
    setEditingMaintenance(item);
    setEditingExpense(null);

    setForm({
      unit_id: item.unit_id || "",
      title: item.title || "",
      description: item.description || "",
      priority: item.priority || "medium",
      status: item.status || "open",
      assigned_person: item.assigned_person || "",
      estimated_cost: item.estimated_cost ?? "",
      actual_cost: item.actual_cost ?? "",
      reported_date:
        item.reported_date || new Date().toISOString().slice(0, 10),
    });

    setOpen(true);
  };

  useEffect(() => {
    const maintenanceId = searchParams.get("maintenanceId");

    if (!maintenanceId || maintenance.loading || !maintenance.data?.length) {
      return;
    }

    const item = maintenance.data.find(
      (record) => String(record.id) === String(maintenanceId),
    );

    if (item) {
      setTab("maintenance");
      setEditingExpense(null);
      openEditMaintenance(item);

      setSearchParams({}, { replace: true });
    }
  }, [maintenance.loading, maintenance.data, searchParams, setSearchParams]);

  /* ---------------------------------------------------------------------- */
  /* Open expense edit                                                       */
  /* ---------------------------------------------------------------------- */

  const openEditExpense = (item) => {
    setEditingExpense(item);
    setEditingMaintenance(null);

    setForm({
      unit_id: item.unit_id || "",
      category: item.category || "Other",
      description: item.description || "",
      amount: item.amount ?? "",
      expense_date: item.expense_date || new Date().toISOString().slice(0, 10),
      vendor: item.vendor || "",
      payment_method: item.payment_method || "",
      reference: item.reference || "",
      notes: item.notes || "",
    });

    setOpen(true);
  };

  /* Save */

  const save = async (event) => {
    event.preventDefault();

    try {
      if (editingMaintenance) {
        await db.maintenance.update(editingMaintenance.id, {
          unit_id: form.unit_id || null,
          title: String(form.title || "").trim(),
          description: String(form.description || "").trim() || null,
          priority: form.priority,
          status: form.status,
          assigned_person: String(form.assigned_person || "").trim() || null,
          estimated_cost: Number(form.estimated_cost || 0),
          actual_cost: Number(form.actual_cost || 0),
          reported_date: form.reported_date,
        });

        toast.success("Maintenance request updated.");
      } else if (editingExpense) {
        const amount = Number(form.amount);

        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error("Expense amount must be a valid number.");
        }

        if (!String(form.description || "").trim()) {
          throw new Error("Expense description is required.");
        }

        await db.expenses.update(editingExpense.id, {
          unit_id: form.unit_id || null,
          category: String(form.category || "Other").trim() || "Other",
          description: String(form.description || "").trim(),
          amount,
          expense_date: form.expense_date,
          vendor: String(form.vendor || "").trim() || null,
          payment_method: String(form.payment_method || "").trim() || null,
          reference: String(form.reference || "").trim() || null,
          notes: String(form.notes || "").trim() || null,
        });

        toast.success("Expense updated.");
      } else if (tab === "maintenance") {
        await db.maintenance.create({
          unit_id: form.unit_id || null,
          title: String(form.title || "").trim(),
          description: String(form.description || "").trim() || null,
          priority: form.priority,
          status: form.status,
          assigned_person: String(form.assigned_person || "").trim() || null,
          estimated_cost: Number(form.estimated_cost || 0),
          actual_cost: Number(form.actual_cost || 0),
          reported_date: form.reported_date,
        });

        toast.success("Maintenance request created.");
      } else {
        const amount = Number(form.amount);

        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error("Expense amount must be a valid number.");
        }

        if (!String(form.description || "").trim()) {
          throw new Error("Expense description is required.");
        }

        await db.expenses.create({
          unit_id: form.unit_id || null,
          category: String(form.category || "Other").trim() || "Other",
          description: String(form.description || "").trim(),
          amount,
          expense_date: form.expense_date,
          vendor: String(form.vendor || "").trim() || null,
          payment_method: String(form.payment_method || "").trim() || null,
          reference: String(form.reference || "").trim() || null,
          notes: String(form.notes || "").trim() || null,
        });

        toast.success("Expense added.");
      }

      closeModal();
      await refreshAll();
    } catch (error) {
      toast.error(error.message || "Unable to save record.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Delete maintenance                                                      */
  /* ---------------------------------------------------------------------- */

  const deleteMaintenance = async (item) => {
    const confirmed = window.confirm(
      `Delete this maintenance request?\n\n"${item.title}"\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await db.maintenance.delete(item.id);

      toast.success("Maintenance request deleted.");

      await maintenance.refresh();
    } catch (error) {
      toast.error(error.message || "Unable to delete maintenance request.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Delete expense                                                          */
  /* ---------------------------------------------------------------------- */

  const deleteExpense = async (item) => {
    const confirmed = window.confirm(
      `Delete this expense?\n\n${item.description}\nAmount: ${money(item.amount)}\n\nThis action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await db.expenses.delete(item.id);

      toast.success("Expense deleted.");

      await expenses.refresh();
    } catch (error) {
      toast.error(error.message || "Unable to delete expense.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Inline status                                                           */
  /* ---------------------------------------------------------------------- */

  const updateMaintenanceStatus = async (item, status) => {
    if (!status || status === item.status) return;

    try {
      await db.maintenance.update(item.id, { status });
      toast.success("Maintenance status updated.");
      await maintenance.refresh();
    } catch (error) {
      toast.error(error.message || "Unable to update maintenance status.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  const maintenanceRows = (maintenance.data || []).filter((item) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return [
      item.title,
      item.description,
      item.priority,
      item.status,
      item.assigned_person,
      item.reported_date,
      item.units?.unit_number,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const expenseRows = (expenses.data || []).filter((item) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return [
      item.category,
      item.description,
      item.vendor,
      item.expense_date,
      item.units?.unit_number,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const pendingCount = (maintenance.data || []).filter(
    (item) => item.status === "open",
  ).length;

  const inProgressCount = (maintenance.data || []).filter(
    (item) => item.status === "in_progress",
  ).length;

  const resolvedCount = (maintenance.data || []).filter(
    (item) => item.status === "completed",
  ).length;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthExpenses = (expenses.data || []).filter((item) => {
    if (!item.expense_date) return false;
    const date = new Date(`${item.expense_date}T00:00:00`);
    return (
      date.getFullYear() === currentYear && date.getMonth() === currentMonth
    );
  });

  const yearExpenses = (expenses.data || []).filter((item) => {
    if (!item.expense_date) return false;
    return (
      new Date(`${item.expense_date}T00:00:00`).getFullYear() === currentYear
    );
  });

  const monthTotal = monthExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const yearTotal = yearExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const statusLabel = (status) => {
    if (status === "open") return "Pending";
    if (status === "in_progress") return "In Progress";
    if (status === "completed") return "Resolved";
    if (status === "cancelled") return "Cancelled";
    return status || "Pending";
  };

  const modalTitle = editingMaintenance
    ? "Edit maintenance request"
    : editingExpense
      ? "Edit expense"
      : tab === "maintenance"
        ? "New maintenance request"
        : "New expense";

  return (
    <div className="maintenance-page">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div className="page-head maintenance-page-head">
        <div>
          <h1>Maintenance & Expenses</h1>
          <p>Track repairs and operating costs in one place.</p>
        </div>

      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tabs                                                               */}
      {/* ------------------------------------------------------------------ */}

      <div className="tabs maintenance-tabs">
        <button
          className={tab === "maintenance" ? "active" : ""}
          onClick={() => {
            setTab("maintenance");
            setSearch("");
            setOpen(false);
            setEditingMaintenance(null);
            setEditingExpense(null);
          }}
        >
          Maintenance
        </button>

        <button
          className={tab === "expenses" ? "active" : ""}
          onClick={() => {
            setTab("expenses");
            setSearch("");
            setOpen(false);
            setEditingMaintenance(null);
            setEditingExpense(null);
          }}
        >
          Expenses
        </button>
      </div>

      {tab === "maintenance" ? (
        <>
          <div className="maintenance-stats">
            <div className="maintenance-stat-card">
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </div>
            <div className="maintenance-stat-card">
              <span>In Progress</span>
              <strong>{inProgressCount}</strong>
            </div>
            <div className="maintenance-stat-card">
              <span>Resolved</span>
              <strong>{resolvedCount}</strong>
            </div>
          </div>

          <section className="panel maintenance-table-panel">
            <div className="maintenance-search-bar">
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search issue, tenant, or unit..."
                aria-label="Search maintenance"
              />
            </div>

            <div className="table-wrap">
              <table className="maintenance-table">
                <thead>
                  <tr>
                    <th>Issue</th>
                    <th>Unit</th>
                    <th>Reported</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Cost</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {maintenanceRows.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.title}</strong>
                        <small>{m.description || "Maintenance"}</small>
                      </td>

                      <td>{m.units?.unit_number || "Property-wide"}</td>

                      <td>{formatDate(m.reported_date)}</td>

                      <td>
                        <span
                          className={`maintenance-priority priority-${m.priority || "medium"}`}
                        >
                          {m.priority || "Medium"}
                        </span>
                      </td>

                      <td>
                        <select
                          className={`maintenance-status-select status-${m.status || "open"}`}
                          value={m.status || "open"}
                          onChange={(event) =>
                            updateMaintenanceStatus(m, event.target.value)
                          }
                          aria-label={`Status for ${m.title}`}
                        >
                          <option value="open">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Resolved</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>

                      <td>{m.assigned_person || "—"}</td>

                      <td>{money(m.actual_cost || m.estimated_cost || 0)}</td>

                      <td>
                        <div className="maintenance-action-group">
                          <button
                            type="button"
                            className="maintenance-icon-action"
                            onClick={() => openEditMaintenance(m)}
                            aria-label={`Edit ${m.title}`}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="maintenance-icon-action danger"
                            onClick={() => deleteMaintenance(m)}
                            aria-label={`Delete ${m.title}`}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!maintenanceRows.length && (
                    <tr>
                      <td colSpan="8" className="maintenance-empty-row">
                        <EmptyState
                          icon={Wrench}
                          title={
                            search
                              ? "No requests found"
                              : "No maintenance requests yet"
                          }
                          message={
                            search
                              ? "Try a different search."
                              : "Open requests will appear here."
                          }
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="maintenance-stats expense-stats">
            <div className="maintenance-stat-card">
              <span>This month</span>
              <strong>{money(monthTotal)}</strong>
            </div>
            <div className="maintenance-stat-card">
              <span>This year</span>
              <strong>{money(yearTotal)}</strong>
            </div>
            <div className="maintenance-stat-card expense-count-card">
              <span>Expense entries</span>
              <strong>{(expenses.data || []).length}</strong>
            </div>
          </div>

          <section className="panel maintenance-table-panel expense-table-panel">
            <div className="maintenance-search-bar expense-search-bar">
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search description, vendor, category..."
                aria-label="Search expenses"
              />
            </div>

            <div className="table-wrap">
              <table className="maintenance-table expense-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Vendor</th>
                    <th>Unit</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {expenseRows.map((x) => (
                    <tr key={x.id}>
                      <td>{formatDate(x.expense_date)}</td>
                      <td>
                        <span className="expense-category-badge">
                          {x.category || "Other"}
                        </span>
                      </td>
                      <td>{x.description || "—"}</td>
                      <td>{x.vendor || "—"}</td>
                      <td>{x.units?.unit_number || "Property-wide"}</td>
                      <td>
                        <strong>{money(x.amount)}</strong>
                      </td>
                      <td>
                        <div className="maintenance-action-group">
                          <button
                            type="button"
                            className="maintenance-icon-action"
                            onClick={() => openEditExpense(x)}
                            aria-label={`Edit ${x.description}`}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="maintenance-icon-action danger"
                            onClick={() => deleteExpense(x)}
                            aria-label={`Delete ${x.description}`}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!expenseRows.length && (
                    <tr>
                      <td colSpan="7" className="maintenance-empty-row">
                        <EmptyState
                          icon={Receipt}
                          title={
                            search
                              ? "No expenses found"
                              : "No expenses recorded yet"
                          }
                          message={
                            search
                              ? "Try a different search."
                              : "Recorded expenses will appear here."
                          }
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal                                                               */}
      {/* ------------------------------------------------------------------ */}

      <Modal open={open} onClose={closeModal} title={modalTitle}>
        {editingMaintenance || tab === "maintenance" ? (
          <form className="form-grid" onSubmit={save}>
            <label>
              Unit
              <select
                value={form.unit_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    unit_id: e.target.value,
                  })
                }
              >
                <option value="">Select unit</option>

                {[...(units.data || [])].sort(compareUnitNumbers).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_number}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority: e.target.value,
                  })
                }
              >
                <option value="low">Low</option>

                <option value="medium">Medium</option>

                <option value="high">High</option>

                <option value="urgent">Urgent</option>
              </select>
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value,
                  })
                }
              >
                <option value="open">Open</option>

                <option value="in_progress">In Progress</option>

                <option value="completed">Completed</option>

                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label>
              Assigned Person
              <input
                type="text"
                value={form.assigned_person}
                onChange={(e) =>
                  setForm({
                    ...form,
                    assigned_person: e.target.value,
                  })
                }
                placeholder="e.g. Maintenance Staff"
              />
            </label>

            <label>
              Reported date
              <input
                type="date"
                value={form.reported_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reported_date: e.target.value,
                  })
                }
              />
            </label>

            <label className="full-span">
              Issue
              <input
                required
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title: e.target.value,
                  })
                }
              />
            </label>

            <label className="full-span">
              Description
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Estimated cost
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.estimated_cost}
                onChange={(e) =>
                  setForm({
                    ...form,
                    estimated_cost: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Actual cost
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.actual_cost}
                onChange={(e) =>
                  setForm({
                    ...form,
                    actual_cost: e.target.value,
                  })
                }
              />
            </label>

            <div className="form-actions full-span">
              <button type="button" className="secondary" onClick={closeModal}>
                Cancel
              </button>

              <button className="primary" type="submit">
                {editingMaintenance ? "Save changes" : "Create request"}
              </button>
            </div>
          </form>
        ) : (
          <form className="form-grid" onSubmit={save}>
            <label>
              Date
              <input
                type="date"
                required
                value={form.expense_date}
                onChange={(e) =>
                  setForm({
                    ...form,
                    expense_date: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Category
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value,
                  })
                }
              >
                <option value="Salary">Salary</option>
                <option value="Utilities">Utilities</option>
                <option value="Materials">Materials</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label className="full-span">
              Description
              <input
                required
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    amount: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Unit
              <select
                value={form.unit_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    unit_id: e.target.value,
                  })
                }
              >
                <option value="">Property-wide</option>

                {[...(units.data || [])].sort(compareUnitNumbers).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_number}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Vendor
              <input
                value={form.vendor}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vendor: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Payment method
              <input
                value={form.payment_method}
                onChange={(e) =>
                  setForm({
                    ...form,
                    payment_method: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Reference
              <input
                value={form.reference}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reference: e.target.value,
                  })
                }
              />
            </label>

            <label className="full-span">
              Notes
              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes: e.target.value,
                  })
                }
              />
            </label>

            <div className="form-actions full-span">
              <button type="button" className="secondary" onClick={closeModal}>
                Cancel
              </button>

              <button className="primary" type="submit">
                {editingExpense ? "Save changes" : "Add expense"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
