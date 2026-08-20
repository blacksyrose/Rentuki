import { useState } from "react";
import { ChevronDown, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
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

function tenantName(tenant) {
  const full = `${tenant?.first_name || ""} ${tenant?.last_name || ""}`.trim();
  return full || tenant?.full_name || "Unnamed tenant";
}

function activeTenancies(tenant) {
  return (tenant?.tenancies || []).filter(
    (tenancy) => tenancy.status === "active" && !tenancy.end_date,
  );
}

export default function Payments() {
  const [month, setMonth] = useState(currentMonth());
  const toast = useToast();

  const bill = useAsync(async () => {
    await syncBillingStatuses(month);
    return db.billing.list(month);
  }, [month]);

  const tenants = useAsync(() => db.tenants.list(), []);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [form, setForm] = useState({
    payment_type: "rent",
    tenant_id: "",
    tenancy_id: "",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "Cash",
    notes: "",
  });

  const selectedTenant = (tenants.data || []).find(
    (tenant) => tenant.id === form.tenant_id,
  );

  const selectedTenancies = activeTenancies(selectedTenant);
  const selectedTenancy = selectedTenancies.find(
    (tenancy) => tenancy.id === form.tenancy_id,
  );

  const resetForm = () => {
    setForm({
      payment_type: "rent",
      tenant_id: "",
      tenancy_id: "",
      amount: "",
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: "Cash",
      notes: "",
    });
  };

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
    resetForm();
  };

  const openPay = (billingRecord) => {
    const tenant = billingRecord.tenancies?.tenants;
    const tenantId = billingRecord.tenancies?.tenant_id || "";
    const tenancyId = billingRecord.tenancy_id || "";

    setSelected(billingRecord);
    setEditingPayment(null);
    setForm({
      payment_type: "rent",
      tenant_id: tenantId,
      tenancy_id: tenancyId,
      amount: remainingBalance(billingRecord),
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: "Cash",
      notes: "",
    });
    setOpen(true);
  };

  const openOtherPayment = (paymentType) => {
    setSelected(null);
    setEditingPayment(null);
    setForm({
      payment_type: paymentType,
      tenant_id: "",
      tenancy_id: "",
      amount: "",
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
      payment_type: payment.payment_type || "rent",
      tenant_id: billingRecord.tenancies?.tenant_id || "",
      tenancy_id: billingRecord.tenancy_id || "",
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
      `Delete this payment of ${money(editingPayment.amount)}?\n\nThis action permanently removes the payment record and will recalculate the billing balance.`,
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
      const type = form.payment_type || "rent";
      const amount = Number(form.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Payment amount must be greater than zero.");
      }

      if (!form.tenant_id || !form.tenancy_id) {
        throw new Error("Select a tenant and active tenancy.");
      }

      if (editingPayment) {
        await updatePayment(editingPayment.id, {
          amount,
          payment_date: form.payment_date,
          payment_method: form.payment_method,
          notes: form.notes,
          payment_type: type,
        });

        toast.success("Payment updated.");
      } else if (type === "rent") {
        if (!selected) throw new Error("Billing record is required.");

        const billingMonth = String(selected.billing_month || "").slice(0, 7);

        if (
          billingMonth &&
          String(form.payment_date).slice(0, 7) !== billingMonth
        ) {
          throw new Error(
            `Payment date must stay within the billing month (${billingMonth}).`,
          );
        }

        const maxAllowed = remainingBalance(selected);

        if (amount > maxAllowed) {
          throw new Error(
            `Payment cannot exceed the remaining balance of ${money(maxAllowed)}.`,
          );
        }

        await recordPayment({
          paymentType: "rent",
          billingRecord: selected,
          tenantId: form.tenant_id,
          tenancyId: form.tenancy_id,
          amount,
          paymentDate: form.payment_date,
          paymentMethod: form.payment_method,
          notes: form.notes,
        });

        toast.success("Rent payment recorded.");
      } else {
        await recordPayment({
          paymentType: type,
          billingRecord: null,
          tenantId: form.tenant_id,
          tenancyId: form.tenancy_id,
          amount,
          paymentDate: form.payment_date,
          paymentMethod: form.payment_method,
          notes: form.notes,
        });

        toast.success(
          type === "deposit"
            ? "Security deposit recorded."
            : "Advance rent recorded.",
        );
      }

      closeModal();
      await bill.refresh();
      await tenants.refresh();
    } catch (error) {
      toast.error(error.message || "Unable to save payment.");
    }
  };

  const modalTitle = editingPayment
    ? "Edit payment"
    : form.payment_type === "deposit"
      ? "Record Payment"
      : form.payment_type === "advance"
        ? "Record Payment"
        : "Record Payment";

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

          <button
            className="secondary"
            onClick={() => openOtherPayment("advance")}
          >
            <Plus size={16} />
            Other Payment
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
                <th>Action</th>
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
                          flexDirection: "row",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <button
                          className="small-btn"
                          disabled={balance <= 0}
                          onClick={() => openPay(record)}
                          title="Record rent payment"
                          aria-label="Record rent payment"
                        >
                          <Plus size={14} />
                        </button>

                        {(record.payments || []).map((payment) => (
                          <button
                            key={payment.id}
                            className="small-btn secondary"
                            onClick={() => openEditPayment(record, payment)}
                            title={`Edit payment of ${money(payment.amount)}`}
                            aria-label={`Edit payment of ${money(payment.amount)}`}
                          >
                            <Pencil size={14} />
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
            <div>
              <EmptyState
                icon={RefreshCw}
                title="No billing records yet"
                message="Generate billing to create this month’s records."
              />
            </div>
          )}
        </div>
      </section>

      <Modal open={open} onClose={closeModal} title={modalTitle}>
        <form onSubmit={save} className="form-grid">
          {!editingPayment && (
            <label className="full-span">
              Payment type
              <select
                value={form.payment_type}
                onChange={(event) => {
                  const paymentType = event.target.value;

                  setForm({
                    ...form,
                    payment_type: paymentType,
                    tenant_id: paymentType === "rent" ? form.tenant_id : "",
                    tenancy_id: paymentType === "rent" ? form.tenancy_id : "",
                    amount:
                      paymentType === "rent" && selected
                        ? remainingBalance(selected)
                        : "",
                  });
                }}
              >
                <option value="rent">Monthly Rent</option>
                <option value="advance">Advance Rent</option>
                <option value="deposit">Security Deposit</option>
              </select>
            </label>
          )}

          {form.payment_type === "rent" && selected ? (
            <div className="form-note full-span">
              Remaining balance:{" "}
              <strong>
                {money(remainingBalance(selected, editingPayment?.id || null))}
              </strong>
            </div>
          ) : (
            <div className="form-note full-span">
              {form.payment_type === "deposit"
                ? "Recorded separately from monthly rent billing."
                : "Recorded separately from monthly rent billing."}
            </div>
          )}

          {form.payment_type !== "rent" && !editingPayment && (
            <>
              <label className="full-span">
                Tenant
                <select
                  required
                  value={form.tenant_id}
                  onChange={(event) => {
                    setForm({
                      ...form,
                      tenant_id: event.target.value,
                      tenancy_id: "",
                    });
                  }}
                >
                  <option value="">Select tenant</option>
                  {(tenants.data || [])
                    .filter((tenant) => activeTenancies(tenant).length > 0)
                    .map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenantName(tenant)}
                      </option>
                    ))}
                </select>
              </label>

              <label className="full-span">
                Unit / Tenancy
                <select
                  required
                  value={form.tenancy_id}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      tenancy_id: event.target.value,
                    })
                  }
                  disabled={!form.tenant_id}
                >
                  <option value="">Select active tenancy</option>
                  {selectedTenancies.map((tenancy) => (
                    <option key={tenancy.id} value={tenancy.id}>
                      Unit {tenancy.units?.unit_number || "—"} —{" "}
                      {money(tenancy.monthly_rent)} / month
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {form.payment_type === "rent" && selected && (
            <div className="form-note full-span">
              Tenant:{" "}
              <strong>
                {selected.tenancies?.tenants?.first_name || "—"}{" "}
                {selected.tenancies?.tenants?.last_name || ""}
              </strong>
              {" · "}
              Unit {selected.tenancies?.units?.unit_number || "—"}
            </div>
          )}

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
              <option value="Cash">Cash</option>
              <option value="G-Cash">G-Cash</option>
              <option value="Maribank">Maribank</option>
            </select>
          </label>

          <label className="full-span">
            Remarks
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
              placeholder={
                form.payment_type === "deposit"
                  ? "e.g. Security deposit — 1 month"
                  : form.payment_type === "advance"
                    ? "e.g. Advance rent — 1 month"
                    : "e.g. November rent — partial payment"
              }
            />
          </label>

          <div className="form-actions full-span">
            {editingPayment && (
              <button
                type="button"
                className="secondary"
                onClick={removePayment}
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
