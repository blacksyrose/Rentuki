import { useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import {
  db,
  generateBillingForActiveTenancies,
  recordPayment,
  syncBillingStatuses,
  updatePayment,
  deletePayment,
} from "../services/db";
import { useAsync } from "../hooks/useData";
import { currentMonth, money, monthLabel } from "../lib/utils";
import { useToast } from "../components/Toast";

function paidAmount(record) {
  return (record?.payments || []).reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
}

function remainingBalance(record, excludePaymentId = null) {
  const paid = (record?.payments || []).reduce((sum, payment) => {
    if (payment.id === excludePaymentId) return sum;
    return sum + Number(payment.amount || 0);
  }, 0);

  return Math.max(Number(record?.amount_due || 0) - paid, 0);
}

function statusLabel(record) {
  const paid = paidAmount(record);
  const amountDue = Number(record?.amount_due || 0);
  const balance = Math.max(amountDue - paid, 0);

  if (record?.status === "waived") return "Waived";
  if (amountDue > 0 && balance <= 0) return "Paid";
  if (paid > 0) return "Partially Paid";
  if (record?.status === "overdue") return "Overdue";
  if (record?.status === "due") return "Due";
  return "Upcoming";
}

export default function Payments() {
  const [month, setMonth] = useState(currentMonth());
  const toast = useToast();

  const bill = useAsync(async () => {
    await syncBillingStatuses(month);
    return db.billing.list(month);
  }, [month]);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [form, setForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "Cash",
    notes: "",
  });

  const generate = async () => {
    try {
      const created = await generateBillingForActiveTenancies(month);
      toast.success(
        created.length
          ? `${created.length} billing record${created.length === 1 ? "" : "s"} created.`
          : "Billing is already up to date.",
      );
      await bill.refresh();
    } catch (error) {
      toast.error(error.message || "Unable to generate billing.");
    }
  };

  const closeModal = () => {
    setOpen(false);
    setSelected(null);
    setEditingPayment(null);
  };

  const openPay = (billingRecord) => {
    setSelected(billingRecord);
    setEditingPayment(null);
    setForm({
      amount: remainingBalance(billingRecord),
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: "Cash",
      notes: "",
    });
    setOpen(true);
  };

  const openEditPayment = (billingRecord, payment) => {
    setSelected(billingRecord);
    setEditingPayment(payment);
    setForm({
      amount: Number(payment.amount || 0),
      payment_date:
        payment.payment_date || new Date().toISOString().slice(0, 10),
      payment_method: payment.payment_method || "Cash",
      notes: payment.notes || "",
    });
    setOpen(true);
  };

  const removePayment = async () => {
    if (!editingPayment?.id) return;

    const confirmed = window.confirm(
      `Delete this payment of ${money(editingPayment.amount)}?\\n\\nThis action permanently removes the payment record and will recalculate the billing balance.`,
    );

    if (!confirmed) return;

    try {
      await deletePayment(editingPayment.id);
      toast.success("Payment deleted.");
      closeModal();
      await bill.refresh();
    } catch (error) {
      toast.error(error.message || "Unable to delete payment.");
    }
  };

  const save = async (event) => {
    event.preventDefault();

    try {
      if (!selected) throw new Error("Billing record is required.");

      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Payment amount must be greater than zero.");
      }

      const billingMonth = String(selected.billing_month || "").slice(0, 7);
      if (
        billingMonth &&
        String(form.payment_date).slice(0, 7) !== billingMonth
      ) {
        throw new Error(
          `Payment date must stay within the billing month (${billingMonth}).`,
        );
      }

      const maxAllowed = remainingBalance(selected, editingPayment?.id || null);

      if (amount > maxAllowed) {
        throw new Error(
          `Payment cannot exceed the remaining balance of ${money(maxAllowed)}.`,
        );
      }

      if (editingPayment) {
        await updatePayment(editingPayment.id, {
          amount,
          payment_date: form.payment_date,
          payment_method: form.payment_method,
          notes: form.notes,
        });
        toast.success("Payment updated.");
      } else {
        const tenancy = selected.tenancies;
        if (!tenancy)
          throw new Error("The tenancy information could not be loaded.");

        await recordPayment({
          billingRecord: selected,
          tenantId: tenancy.tenant_id,
          tenancyId: selected.tenancy_id,
          amount,
          paymentDate: form.payment_date,
          paymentMethod: form.payment_method,
          notes: form.notes,
        });
        toast.success("Payment recorded.");
      }

      closeModal();
      await bill.refresh();
    } catch (error) {
      toast.error(error.message || "Unable to save payment.");
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Payments</h1>
          <p>
            Month-to-month billing, partial payments and permanent payment
            history.
          </p>
        </div>
        <div className="actions">
          <input
            className="month-input"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
          <button className="secondary" onClick={generate}>
            <RefreshCw size={16} />
            Generate billing
          </button>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>{monthLabel(month)}</h2>
            <p>Billing obligations for active tenancies</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Unit</th>
                <th>Due</th>
                <th>Amount due</th>
                <th>Paid</th>
                <th>Balance</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(bill.data || []).map((record) => {
                const paid = paidAmount(record);
                const balance = Math.max(
                  Number(record.amount_due || 0) - paid,
                  0,
                );
                const tenant = record.tenancies?.tenants;

                return (
                  <tr key={record.id}>
                    <td>
                      <strong>
                        {tenant?.first_name || "—"} {tenant?.last_name || ""}
                      </strong>
                    </td>
                    <td>{record.tenancies?.units?.unit_number || "—"}</td>
                    <td>{record.due_date}</td>
                    <td>{money(record.amount_due)}</td>
                    <td>{money(paid)}</td>
                    <td>
                      <strong>{money(balance)}</strong>
                    </td>
                    <td>
                      <StatusBadge status={statusLabel(record)} />
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          alignItems: "flex-start",
                        }}
                      >
                        <button
                          className="small-btn"
                          disabled={balance <= 0}
                          onClick={() => openPay(record)}
                        >
                          <Plus size={14} /> Payment
                        </button>

                        {(record.payments || []).map((payment) => (
                          <button
                            key={payment.id}
                            className="small-btn secondary"
                            onClick={() => openEditPayment(record, payment)}
                            title={`Edit payment of ${money(payment.amount)}`}
                          >
                            <Pencil size={14} /> Edit {money(payment.amount)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!bill.loading && !bill.data?.length && (
            <div className="empty">
              No billing records for this month. Click “Generate billing”.
            </div>
          )}
        </div>
      </section>

      <Modal
        open={open}
        onClose={closeModal}
        title={editingPayment ? "Edit payment" : "Record payment"}
      >
        <form onSubmit={save} className="form-grid">
          <div className="form-note full-span">
            Remaining balance:{" "}
            <strong>
              {money(remainingBalance(selected, editingPayment?.id || null))}
            </strong>
          </div>

          <label>
            Amount
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={form.amount}
              onChange={(event) =>
                setForm({ ...form, amount: event.target.value })
              }
            />
          </label>

          <label>
            Payment date
            <input
              type="date"
              required
              value={form.payment_date}
              onChange={(event) =>
                setForm({ ...form, payment_date: event.target.value })
              }
            />
          </label>

          <label>
            Method
            <select
              value={form.payment_method}
              onChange={(event) =>
                setForm({ ...form, payment_method: event.target.value })
              }
            >
              <option>Cash</option>
              <option>GCash</option>
              <option>Bank Transfer</option>
              <option>Maya</option>
              <option>Other</option>
            </select>
          </label>

          <label className="full-span">
            Remarks
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
              placeholder="e.g. November rent — partial payment"
            />
          </label>

          <div className="form-actions full-span">
            {editingPayment && (
              <button
                type="button"
                className="secondary"
                onClick={removePayment}
                style={{
                  marginRight: "auto",
                  color: "#b42318",
                  borderColor: "#f0b8b3",
                }}
              >
                <Trash2 size={14} /> Delete payment
              </button>
            )}

            <button type="button" className="secondary" onClick={closeModal}>
              Cancel
            </button>
            <button className="primary" type="submit">
              {editingPayment ? "Save changes" : "Record payment"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
