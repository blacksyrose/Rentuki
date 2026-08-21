import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import {
  db,
  generateBillingForActiveTenancies,
  recordPayment,
  syncBillingStatuses,
  updatePayment,
  deletePayment,
} from "../services/db";
import { useAsync } from "../hooks/useData";
import {
  compareUnitNumbers,
  currentMonth,
  money,
  monthLabel,
} from "../lib/utils";
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

function statusBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "overdue") return "overdue";
  if (normalized === "due") return "due";
  if (normalized === "upcoming") return "upcoming";
  if (normalized === "partially paid") return "partial";
  if (normalized === "paid") return "paid";
  if (normalized === "waived") return "waived";

  return "";
}

function paymentTypeBadgeClass(value) {
  const type = String(value || "")
    .trim()
    .toLowerCase();

  if (type === "rent") return "rent";
  if (type === "deposit") return "deposit";
  if (type === "advance") return "advance";
  return "other";
}

function paymentMethodBadgeClass(value) {
  const method = String(value || "")
    .trim()
    .toLowerCase();

  if (method === "cash") return "cash";
  if (method === "gcash" || method === "g-cash") return "gcash";

  if (
    ["maribank", "bank transfer", "bank_transfer", "maya", "other"].includes(
      method,
    )
  ) {
    return "maribank";
  }

  return "other";
}

function tenantName(tenant) {
  const full = `${tenant?.first_name || ""} ${tenant?.last_name || ""}`.trim();
  return full || tenant?.full_name || "Unnamed tenant";
}

function activeTenancies(tenant) {
  return (tenant?.tenancies || [])
    .filter((tenancy) => tenancy.status === "active" && !tenancy.end_date)
    .sort((left, right) => compareUnitNumbers(left.units, right.units));
}

export default function Payments() {
  const [month, setMonth] = useState(currentMonth());
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const bill = useAsync(async () => {
    await syncBillingStatuses(month);
    return db.billing.list(month);
  }, [month]);

  const payments = useAsync(() => db.payments.list(), [month]);
  const tenants = useAsync(() => db.tenants.list(), []);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [form, setForm] = useState({
    payment_type: "rent",
    tenant_id: "",
    tenancy_id: "",
    amount: "",
    payment_date: "",
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
      payment_date: "",
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
    const tenantId = billingRecord.tenancies?.tenant_id || "";
    const tenancyId = billingRecord.tenancy_id || "";

    setSelected(billingRecord);
    setEditingPayment(null);
    setForm({
      payment_type: "rent",
      tenant_id: tenantId,
      tenancy_id: tenancyId,
      amount: remainingBalance(billingRecord),
      payment_date: "",
      payment_method: "Cash",
      notes: "",
    });
    setOpen(true);
  };
  useEffect(() => {
    const billingId = searchParams.get("billingId");

    if (!billingId) return;

    let cancelled = false;

    const loadBillingRecord = async () => {
      try {
        const allBilling = await db.billing.listAll();

        if (cancelled) return;

        const record = (allBilling || []).find(
          (item) => String(item.id) === String(billingId),
        );

        if (!record) return;

        const recordMonth = String(record.billing_month || "").slice(0, 7);

        if (recordMonth && recordMonth !== month) {
          setMonth(recordMonth);
        }
      } catch (error) {
        console.error("Unable to load notification billing record:", error);
      }
    };

    loadBillingRecord();

    return () => {
      cancelled = true;
    };
  }, [searchParams, month]);

  useEffect(() => {
    const billingId = searchParams.get("billingId");

    if (!billingId || bill.loading || !bill.data?.length) {
      return;
    }

    const record = bill.data.find(
      (item) => String(item.id) === String(billingId),
    );

    if (record) {
      openPay(record);
      setSearchParams({}, { replace: true });
    }
  }, [bill.loading, bill.data, searchParams, setSearchParams]);

  const openOtherPayment = (paymentType) => {
    setSelected(null);
    setEditingPayment(null);
    setForm({
      payment_type: paymentType,
      tenant_id: "",
      tenancy_id: "",
      amount: "",
      payment_date: "",
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
      payment_date: payment.payment_date || "",
      payment_method: payment.payment_method || "Cash",
      notes: payment.notes || "",
    });
    setOpen(true);
  };

  const openEditOtherPayment = (payment) => {
    setSelected(null);
    setEditingPayment(payment);
    setForm({
      payment_type: payment.payment_type || "advance",
      tenant_id: payment.tenant_id || payment.tenants?.id || "",
      tenancy_id: payment.tenancy_id || payment.tenancies?.id || "",
      amount: Number(payment.amount || 0),
      payment_date: payment.payment_date || "",
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
          payment_date: form.payment_date || null,
          payment_method: form.payment_method,
          notes: form.notes,
          payment_type: type,
        });

        toast.success("Payment updated.");
      } else if (type === "rent") {
        if (!selected) throw new Error("Billing record is required.");

        const billingMonth = String(selected.billing_month || "").slice(0, 7);
        const paymentMonth = String(form.payment_date || "").slice(0, 7);

        if (billingMonth && paymentMonth && paymentMonth < billingMonth) {
          throw new Error(
            `Payment date cannot be before the billing month (${billingMonth}).`,
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
          paymentDate: form.payment_date || null,
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
          paymentDate: form.payment_date || null,
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
      await payments.refresh();
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
            onClick={() => openOtherPayment("deposit")}
          >
            <Plus size={16} />
            Other Payment
          </button>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>Rent Payment ({monthLabel(month)})</h2>
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
              {[...(bill.data || [])]
                .sort((left, right) =>
                  compareUnitNumbers(
                    left.tenancies?.units,
                    right.tenancies?.units,
                  ),
                )
                .map((record) => {
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
                        <span
                          className={`badge payment-status-badge ${statusBadgeClass(
                            statusLabel(record),
                          )}`}
                        >
                          {statusLabel(record)}
                        </span>
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

      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>Other Payments</h2>
            <p>Standalone tenant payments for {monthLabel(month)}.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table>
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(payments.data || [])
                .filter(
                  (payment) =>
                    payment.payment_type !== "rent" &&
                    String(payment.payment_date || "").startsWith(month),
                )
                .map((payment) => {
                  const tenant = payment.tenants;
                  const paymentType = String(payment.payment_type || "other")
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (letter) => letter.toUpperCase());

                  return (
                    <tr key={payment.id}>
                      <td>
                        <strong>
                          {tenant?.first_name || "—"} {tenant?.last_name || ""}
                        </strong>
                      </td>
                      <td>{payment.tenancies?.units?.unit_number || "—"}</td>
                      <td>
                        <span
                          className={`payment-type-badge ${paymentTypeBadgeClass(
                            payment.payment_type,
                          )}`}
                        >
                          {paymentType}
                        </span>
                      </td>
                      <td>{money(payment.amount)}</td>
                      <td>{money(payment.amount)}</td>
                      <td>
                        <strong>{money(0)}</strong>
                      </td>
                      <td>{payment.payment_date || "—"}</td>
                      <td>
                        <span
                          className={`payment-method-badge ${paymentMethodBadgeClass(
                            payment.payment_method,
                          )}`}
                        >
                          {payment.payment_method || "—"}
                        </span>
                      </td>
                      <td>{payment.notes || "—"}</td>
                      <td>
                        <button
                          className="small-btn secondary"
                          onClick={() => openEditOtherPayment(payment)}
                          title="Edit payment"
                          aria-label="Edit payment"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              {!payments.loading &&
                !(payments.data || []).some(
                  (payment) =>
                    payment.payment_type !== "rent" &&
                    String(payment.payment_date || "").startsWith(month),
                ) && (
                  <tr>
                    <td colSpan="10">
                      <EmptyState
                        icon={Plus}
                        title="No deposits or advance rent yet"
                        message="Security deposits and advance rent will appear here."
                      />
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={open} onClose={closeModal} title={modalTitle}>
        <form onSubmit={save} className="form-grid">
          {(!editingPayment || editingPayment.payment_type !== "rent") && (
            <label className="full-span">
              Type
              <select
                value={form.payment_type}
                onChange={(event) => {
                  const paymentType = event.target.value;

                  setForm({
                    ...form,
                    payment_type: paymentType,
                    tenant_id:
                      paymentType === "rent" || editingPayment
                        ? form.tenant_id
                        : "",
                    tenancy_id:
                      paymentType === "rent" || editingPayment
                        ? form.tenancy_id
                        : "",
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
