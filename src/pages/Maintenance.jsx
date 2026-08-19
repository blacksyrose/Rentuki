import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { db } from "../services/db";
import { useAsync } from "../hooks/useData";
import { money } from "../lib/utils";
import { useToast } from "../components/Toast";

const emptyMaintenanceForm = () => ({
  unit_id: "",
  title: "",
  description: "",
  priority: "medium",
  status: "open",
  estimated_cost: "",
  actual_cost: "",
  reported_date: new Date().toISOString().slice(0, 10),
});

const emptyExpenseForm = () => ({
  unit_id: "",
  category: "Maintenance",
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

  const [tab, setTab] = useState("maintenance");
  const [open, setOpen] = useState(false);

  const [editingMaintenance, setEditingMaintenance] = useState(null);

  const [editingExpense, setEditingExpense] = useState(null);

  const [form, setForm] = useState(emptyMaintenanceForm());

  const toast = useToast();

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
      estimated_cost: item.estimated_cost ?? "",
      actual_cost: item.actual_cost ?? "",
      reported_date:
        item.reported_date || new Date().toISOString().slice(0, 10),
    });

    setOpen(true);
  };

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

  /* ---------------------------------------------------------------------- */
  /* Save                                                                    */
  /* ---------------------------------------------------------------------- */

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
  /* Render                                                                  */
  /* ---------------------------------------------------------------------- */

  const modalTitle = editingMaintenance
    ? "Edit maintenance request"
    : editingExpense
      ? "Edit expense"
      : tab === "maintenance"
        ? "New maintenance request"
        : "New expense";

  return (
    <div>
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                             */}
      {/* ------------------------------------------------------------------ */}

      <div className="page-head">
        <div>
          <h1>Maintenance & Expenses</h1>

          <p>Track repairs and operating costs in one place.</p>
        </div>

        <button className="primary" onClick={openCreate}>
          <Plus size={17} />

          {tab === "maintenance" ? "Maintenance request" : "Expense"}
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tabs                                                               */}
      {/* ------------------------------------------------------------------ */}

      <div className="tabs">
        <button
          className={tab === "maintenance" ? "active" : ""}
          onClick={() => {
            setTab("maintenance");
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
            setOpen(false);
            setEditingMaintenance(null);
            setEditingExpense(null);
          }}
        >
          Expenses
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tables                                                             */}
      {/* ------------------------------------------------------------------ */}

      <section className="panel table-panel">
        {tab === "maintenance" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Issue</th>

                  <th>Unit</th>

                  <th>Priority</th>

                  <th>Status</th>

                  <th>Reported</th>

                  <th>Cost</th>

                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {(maintenance.data || []).map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.title}</strong>

                      <small>{m.description || "—"}</small>
                    </td>

                    <td>{m.units?.unit_number || "—"}</td>

                    <td>
                      <StatusBadge status={m.priority} />
                    </td>

                    <td>
                      <StatusBadge status={m.status} />
                    </td>

                    <td>{m.reported_date || "—"}</td>

                    <td>{money(m.actual_cost || m.estimated_cost || 0)}</td>

                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => openEditMaintenance(m)}
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="secondary"
                          onClick={() => deleteMaintenance(m)}
                          style={{
                            color: "#b42318",
                          }}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!maintenance.data?.length && (
                  <tr>
                    <td colSpan="7">No maintenance requests yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>

                  <th>Category</th>

                  <th>Description</th>

                  <th>Unit</th>

                  <th>Vendor</th>

                  <th>Amount</th>

                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {(expenses.data || []).map((x) => (
                  <tr key={x.id}>
                    <td>{x.expense_date || "—"}</td>

                    <td>{x.category || "—"}</td>

                    <td>{x.description || "—"}</td>

                    <td>{x.units?.unit_number || "Property-wide"}</td>

                    <td>{x.vendor || "—"}</td>

                    <td>
                      <strong>{money(x.amount)}</strong>
                    </td>

                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => openEditExpense(x)}
                        >
                          <Pencil size={14} />
                          Edit
                        </button>

                        <button
                          type="button"
                          className="secondary"
                          onClick={() => deleteExpense(x)}
                          style={{
                            color: "#b42318",
                          }}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!expenses.data?.length && (
                  <tr>
                    <td colSpan="7">No expenses recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

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

                {(units.data || []).map((u) => (
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
                <option>Maintenance</option>

                <option>Utilities</option>

                <option>Repairs</option>

                <option>Supplies</option>

                <option>Cleaning</option>

                <option>Taxes</option>

                <option>Insurance</option>

                <option>Other</option>
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

                {(units.data || []).map((u) => (
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
