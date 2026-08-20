import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Eye,
  ArrowRightLeft,
  Pencil,
  LogOut,
  Users,
} from "lucide-react";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { db } from "../services/db";
import { useAsync } from "../hooks/useData";
import { money, dateLabel } from "../lib/utils";
import { useToast } from "../components/Toast";

export default function Tenants() {
  const { data, loading, refresh } = useAsync(() => db.tenants.list(), []);

  const { data: units, refresh: refreshUnits } = useAsync(
    () => db.units.list(),
    [],
  );

  const { data: billing } = useAsync(() => db.billing.list(), []);

  const [q, setQ] = useState("");
  const [historical, setHistorical] = useState(false);


  const [open, setOpen] = useState(false);

  const [selectedTenant, setSelectedTenant] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const [tenancyOpen, setTenancyOpen] = useState(false);
  const [editingTenancy, setEditingTenancy] = useState(null);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferringTenancy, setTransferringTenancy] = useState(null);

  const [editTenantOpen, setEditTenantOpen] = useState(false);

  const [moveOutOpen, setMoveOutOpen] = useState(false);
  const [movingOutTenancy, setMovingOutTenancy] = useState(null);

  const [editTenantForm, setEditTenantForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  const [moveOutForm, setMoveOutForm] = useState({
    move_out_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const toast = useToast();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address: "",
    status: "active",
    notes: "",
  });

  const [tenancyForm, setTenancyForm] = useState({
    unit_id: "",
    start_date: new Date().toISOString().slice(0, 10),
    monthly_rent: "",
    payment_due_day: "5",
    deposit_amount: "0",
    notes: "",
  });

  const [editTenancyForm, setEditTenancyForm] = useState({
    monthly_rent: "",
    payment_due_day: "5",
    deposit_amount: "0",
    notes: "",
  });

  const [transferForm, setTransferForm] = useState({
    new_unit_id: "",
    transfer_date: new Date().toISOString().slice(0, 10),
    monthly_rent: "",
    payment_due_day: "5",
    deposit_amount: "0",
    notes: "",
  });

  const tenants = (data || [])
    .filter((t) => (historical ? t.status !== "active" : t.status === "active"))
    .filter((t) =>
      `${t.first_name} ${t.last_name} ${t.phone || ""} ${t.email || ""}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    );


  const tenantBalanceMap = useMemo(() => {
    const map = new Map();

    (billing || []).forEach((record) => {
      const tenantId = record.tenancies?.tenant_id;
      if (!tenantId) return;

      const amountDue = Number(record.amount_due || 0);
      const paid = (record.payments || []).reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0,
      );

      map.set(
        tenantId,
        (map.get(tenantId) || 0) + Math.max(amountDue - paid, 0),
      );
    });

    return map;
  }, [billing]);

  // ------------------------------------------------------------
  // Refresh selected tenant profile
  // ------------------------------------------------------------

  const refreshSelectedTenant = async (tenantId) => {
    if (!tenantId) return;

    try {
      const freshTenant = await db.tenants.get(tenantId);
      setSelectedTenant(freshTenant);
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ------------------------------------------------------------
  // Create tenant
  // ------------------------------------------------------------

  const save = async (e) => {
    e.preventDefault();

    try {
      await db.tenants.create(form);

      toast.success("Tenant added");

      setOpen(false);

      setForm({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        address: "",
        status: "active",
        notes: "",
      });

      await refresh();
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ------------------------------------------------------------
  // Open tenant profile
  // ------------------------------------------------------------

  const openProfile = async (tenant) => {
    try {
      const freshTenant = await db.tenants.get(tenant.id);

      setSelectedTenant(freshTenant);
      setProfileOpen(true);
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ------------------------------------------------------------
  // Edit tenant personal information
  // ------------------------------------------------------------

  const openEditTenant = () => {
    if (!selectedTenant) return;

    setEditTenantForm({
      first_name: selectedTenant.first_name || "",
      last_name: selectedTenant.last_name || "",
      phone: selectedTenant.phone || "",
      email: selectedTenant.email || "",
      address: selectedTenant.address || "",
      notes: selectedTenant.notes || "",
    });

    setEditTenantOpen(true);
  };

  const saveEditTenant = async (e) => {
    e.preventDefault();

    if (!selectedTenant) return;

    try {
      const firstName = editTenantForm.first_name.trim();
      const lastName = editTenantForm.last_name.trim();

      if (!firstName) {
        throw new Error("First name is required.");
      }

      await db.tenants.update(selectedTenant.id, {
        first_name: firstName,
        last_name: lastName || null,
        phone: editTenantForm.phone.trim() || null,
        email: editTenantForm.email.trim() || null,
        address: editTenantForm.address.trim() || null,
        notes: editTenantForm.notes.trim() || null,
      });

      toast.success("Tenant information updated");

      setEditTenantOpen(false);

      await refresh();
      await refreshSelectedTenant(selectedTenant.id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ------------------------------------------------------------
  // Create tenancy
  // ------------------------------------------------------------

  const openTenancy = () => {
    if (!selectedTenant) return;

    setTenancyForm({
      unit_id: "",
      start_date: new Date().toISOString().slice(0, 10),
      monthly_rent: "",
      payment_due_day: "5",
      deposit_amount: "0",
      notes: "",
    });

    setTenancyOpen(true);
  };

  const saveTenancy = async (e) => {
    e.preventDefault();

    if (!selectedTenant) return;

    try {
      const selectedUnit = (units || []).find(
        (u) => u.id === tenancyForm.unit_id,
      );

      if (!selectedUnit) {
        throw new Error("Please select a unit.");
      }

      const monthlyRent = Number(tenancyForm.monthly_rent);
      const dueDay = Number(tenancyForm.payment_due_day);
      const depositAmount = Number(tenancyForm.deposit_amount || 0);

      if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
        throw new Error("Monthly rent must be a valid non-negative amount.");
      }

      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        throw new Error("Payment due day must be between 1 and 31.");
      }

      if (!Number.isFinite(depositAmount) || depositAmount < 0) {
        throw new Error("Deposit must be a valid non-negative amount.");
      }

      await db.tenancies.createActive({
        tenantId: selectedTenant.id,
        unitId: tenancyForm.unit_id,
        startDate: tenancyForm.start_date,
        monthlyRent,
        paymentDueDay: dueDay,
        depositAmount,
        notes: tenancyForm.notes,
      });

      toast.success("Tenancy created");

      setTenancyOpen(false);

      await refresh();
      await refreshUnits();

      await refreshSelectedTenant(selectedTenant.id);
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ------------------------------------------------------------
  // Edit current tenancy
  // ------------------------------------------------------------

  const openEditTenancy = (tenancy) => {
    if (!tenancy) return;

    setEditingTenancy(tenancy);

    setEditTenancyForm({
      monthly_rent: tenancy.monthly_rent ?? "",
      payment_due_day: String(tenancy.payment_due_day ?? "5"),
      deposit_amount: tenancy.deposit_amount ?? "0",
      notes: tenancy.notes ?? "",
    });
  };

  const saveEditTenancy = async (e) => {
    e.preventDefault();

    if (!editingTenancy) return;

    try {
      const monthlyRent = Number(editTenancyForm.monthly_rent);

      const dueDay = Number(editTenancyForm.payment_due_day);

      const depositAmount = Number(editTenancyForm.deposit_amount || 0);

      if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
        throw new Error("Monthly rent must be a valid non-negative amount.");
      }

      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        throw new Error("Payment due day must be between 1 and 31.");
      }

      if (!Number.isFinite(depositAmount) || depositAmount < 0) {
        throw new Error("Deposit must be a valid non-negative amount.");
      }

      await db.tenancies.update(editingTenancy.id, {
        monthly_rent: monthlyRent,
        payment_due_day: dueDay,
        deposit_amount: depositAmount,
        notes: editTenancyForm.notes || null,
      });

      toast.success("Tenancy updated");

      const tenantId = selectedTenant?.id;

      setEditingTenancy(null);

      await refresh();
      await refreshUnits();

      if (tenantId) {
        await refreshSelectedTenant(tenantId);
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ------------------------------------------------------------
  // Move tenant out
  // ------------------------------------------------------------

  const openMoveOut = (tenancy) => {
    if (!tenancy || !selectedTenant) return;

    setMovingOutTenancy(tenancy);

    setMoveOutForm({
      move_out_date: new Date().toISOString().slice(0, 10),
      notes: "",
    });

    setMoveOutOpen(true);
  };

  const saveMoveOut = async (e) => {
    e.preventDefault();

    if (!selectedTenant || !movingOutTenancy) {
      return;
    }

    try {
      if (!moveOutForm.move_out_date) {
        throw new Error("Move-out date is required.");
      }

      if (moveOutForm.move_out_date < movingOutTenancy.start_date) {
        throw new Error("Move-out date cannot be before the move-in date.");
      }

      await db.tenants.moveOut({
        tenantId: selectedTenant.id,
        tenancyId: movingOutTenancy.id,
        moveOutDate: moveOutForm.move_out_date,
        notes: moveOutForm.notes,
      });

      toast.success(
        `Tenant ${selectedTenant.first_name} ${selectedTenant.last_name} has been moved out.`,
      );

      const tenantId = selectedTenant.id;

      setMoveOutOpen(false);
      setMovingOutTenancy(null);

      await refresh();
      await refreshUnits();
      await refreshSelectedTenant(tenantId);
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ------------------------------------------------------------
  // Open transfer modal
  // ------------------------------------------------------------

  const openTransfer = (tenancy) => {
    if (!tenancy || !selectedTenant) return;

    setTransferringTenancy(tenancy);

    setTransferForm({
      new_unit_id: "",
      transfer_date: new Date().toISOString().slice(0, 10),
      monthly_rent: tenancy.monthly_rent ?? "",
      payment_due_day: String(tenancy.payment_due_day ?? "5"),
      deposit_amount: tenancy.deposit_amount ?? "0",
      notes: "",
    });

    setTransferOpen(true);
  };

  // ------------------------------------------------------------
  // Transfer tenant
  // ------------------------------------------------------------

  const saveTransfer = async (e) => {
    e.preventDefault();

    if (!selectedTenant || !transferringTenancy) {
      return;
    }

    try {
      const selectedUnit = (units || []).find(
        (u) => u.id === transferForm.new_unit_id,
      );

      if (!selectedUnit) {
        throw new Error("Please select an available destination unit.");
      }

      if (selectedUnit.status !== "available") {
        throw new Error("The selected unit is no longer available.");
      }

      const monthlyRent = Number(transferForm.monthly_rent);

      const dueDay = Number(transferForm.payment_due_day);

      const depositAmount = Number(transferForm.deposit_amount || 0);

      if (!transferForm.transfer_date) {
        throw new Error("Transfer date is required.");
      }

      if (transferForm.transfer_date <= transferringTenancy.start_date) {
        throw new Error(
          "Transfer date must be after the current tenancy start date.",
        );
      }

      if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
        throw new Error("Monthly rent must be a valid non-negative amount.");
      }

      if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
        throw new Error("Payment due day must be between 1 and 31.");
      }

      if (!Number.isFinite(depositAmount) || depositAmount < 0) {
        throw new Error("Deposit must be a valid non-negative amount.");
      }

      await db.tenancies.transfer({
        tenantId: selectedTenant.id,
        currentTenancyId: transferringTenancy.id,
        newUnitId: transferForm.new_unit_id,
        transferDate: transferForm.transfer_date,
        monthlyRent,
        paymentDueDay: dueDay,
        depositAmount,
        notes: transferForm.notes,
      });

      toast.success(`Tenant transferred to Unit ${selectedUnit.unit_number}`);

      const tenantId = selectedTenant.id;

      setTransferOpen(false);
      setTransferringTenancy(null);

      await refresh();
      await refreshUnits();
      await refreshSelectedTenant(tenantId);
    } catch (e) {
      toast.error(e.message);
    }
  };

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  return (
    <div className="tenant-directory-page">
      <div className="page-head tenant-directory-head">
        <div>
          <h1>Tenant Directory</h1>
          <p>Database of tenant contact info, active leases, and rental histories.</p>
        </div>

        <button
          className="primary tenant-add-button"
          onClick={() => setOpen(true)}
        >
          <Plus size={15} />
          Add Tenant
        </button>
      </div>

      <div className="tenant-directory-toolbar">
        <div className="search tenant-search">
          <Search size={15} />
          <input
            placeholder="Search tenant name or contact..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <label className="tenant-filter-select">
          <select
            value={historical ? "historical" : "active"}
            onChange={(e) => setHistorical(e.target.value === "historical")}
            aria-label="Tenant status filter"
          >
            <option value="active">Active</option>
            <option value="historical">Historical</option>
          </select>
        </label>
      </div>

      <section className="panel table-panel tenant-directory-panel">
        {loading ? (
          <div className="loading">Loading tenants…</div>
        ) : (
          <div className="table-wrap tenant-table-wrap">
            <table className="tenant-directory-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Unit</th>
                  <th>Monthly rent</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {tenants.map((t) => {
                  const current = (t.tenancies || []).find(
                    (x) => x.status === "active",
                  );

                  const currentUnit = current
                    ? (units || []).find((u) => u.id === current.unit_id) ||
                      current.units
                    : null;

                  const balance = tenantBalanceMap.get(t.id) || 0;

                  return (
                    <tr key={t.id} onClick={() => openProfile(t)}>
                      <td>
                        <div className="tenant-name-cell">
                          <span className="tenant-avatar">
                            {(t.first_name?.[0] || "T").toUpperCase()}
                            {(t.last_name?.[0] || "").toUpperCase()}
                          </span>
                          <span className="tenant-name-copy">
                            <strong>
                              {t.first_name} {t.last_name}
                            </strong>
                            <small>
                              {t.phone || t.email || "No contact number"}
                            </small>
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="tenant-unit-cell">
                          <strong>
                            {currentUnit?.unit_number
                              ? `Unit ${currentUnit.unit_number}`
                              : "—"}
                          </strong>
                          <small>
                            {currentUnit?.unit_type ||
                              currentUnit?.type ||
                              "Rental unit"}
                          </small>
                        </div>
                      </td>

                      <td>
                        <strong className="tenant-money">
                          {current ? money(current.monthly_rent) : "—"}
                        </strong>
                      </td>

                      <td>
                        <strong
                          className={
                            balance > 0
                              ? "tenant-money tenant-balance-due"
                              : "tenant-money tenant-balance-paid"
                          }
                        >
                          {money(balance)}
                        </strong>
                      </td>

                      <td>
                        <StatusBadge status={t.status} />
                      </td>

                      <td>
                        <div className="tenant-row-actions">
                          <button
                            type="button"
                            className="tenant-icon-action"
                            title="View tenant"
                            aria-label={`View ${t.first_name} ${t.last_name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openProfile(t);
                            }}
                          >
                            <Eye size={15} />
                          </button>

                          {current && (
                            <button
                              type="button"
                              className="tenant-icon-action"
                              title="Transfer tenant"
                              aria-label={`Transfer ${t.first_name} ${t.last_name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTenant(t);
                                setTransferringTenancy(current);
                                setTransferForm({
                                  new_unit_id: "",
                                  transfer_date: new Date()
                                    .toISOString()
                                    .slice(0, 10),
                                  monthly_rent: current.monthly_rent ?? "",
                                  payment_due_day: String(
                                    current.payment_due_day ?? "5",
                                  ),
                                  deposit_amount: current.deposit_amount ?? "0",
                                  notes: "",
                                });
                                setTransferOpen(true);
                              }}
                            >
                              <ArrowRightLeft size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!tenants.length && (
              <div className="tenant-directory-empty">
                <EmptyState
                  icon={Users}
                  title="No tenants found"
                  message="Try changing your filters or add your first tenant."
                />
              </div>
            )}
          </div>
        )}
      </section>

      {/* ======================================================
          ADD TENANT
      ====================================================== */}

      <Modal open={open} onClose={() => setOpen(false)} title="Add tenant">
        <form className="form-grid" onSubmit={save}>
          <label>
            First name
            <input
              required
              value={form.first_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  first_name: e.target.value,
                })
              }
            />
          </label>

          <label>
            Last name
            <input
              value={form.last_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  last_name: e.target.value,
                })
              }
            />
          </label>

          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: e.target.value,
                })
              }
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value,
                })
              }
            />
          </label>

          <label className="full-span">
            Address
            <input
              value={form.address}
              onChange={(e) =>
                setForm({
                  ...form,
                  address: e.target.value,
                })
              }
            />
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
              <option value="active">Active</option>

              <option value="historical">Historical</option>
            </select>
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
            <button
              className="secondary"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>

            <button className="primary" type="submit">
              Save
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================
          TENANT PROFILE
      ====================================================== */}

      <Modal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        title={
          selectedTenant
            ? `${selectedTenant.first_name} ${selectedTenant.last_name}`
            : "Tenant"
        }
        wide
      >
        {selectedTenant && (
          <div>
            {/* Personal Information */}

            <div
              className="panel"
              style={{
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0 }}>Personal Information</h3>

                <button
                  type="button"
                  className="secondary"
                  onClick={openEditTenant}
                >
                  <Pencil size={15} />
                  Edit
                </button>
              </div>

              <p>
                <strong>Phone:</strong> {selectedTenant.phone || "—"}
              </p>

              <p>
                <strong>Email:</strong> {selectedTenant.email || "—"}
              </p>

              <p>
                <strong>Address:</strong> {selectedTenant.address || "—"}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                <StatusBadge status={selectedTenant.status} />
              </p>

              {selectedTenant.notes && (
                <p>
                  <strong>Notes:</strong> {selectedTenant.notes}
                </p>
              )}
            </div>

            {/* Current Rental */}

            <div
              className="panel"
              style={{
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <h3>Current Rental</h3>

                  {!(selectedTenant.tenancies || []).some(
                    (x) => x.status === "active",
                  ) && <p>This tenant does not currently occupy a unit.</p>}
                </div>

                {selectedTenant.status === "active" &&
                  !(selectedTenant.tenancies || []).some(
                    (x) => x.status === "active",
                  ) && (
                    <button
                      className="primary"
                      type="button"
                      onClick={openTenancy}
                    >
                      <Plus size={16} />
                      Create tenancy
                    </button>
                  )}
              </div>

              {(selectedTenant.tenancies || [])
                .filter((x) => x.status === "active")
                .map((t) => (
                  <div
                    key={t.id}
                    style={{
                      marginTop: 16,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 16,
                      }}
                    >
                      <div>
                        <p>
                          <strong>Unit:</strong> {t.units?.unit_number || "—"}
                        </p>

                        <p>
                          <strong>Monthly rent:</strong> {money(t.monthly_rent)}
                        </p>

                        <p>
                          <strong>Due day:</strong> {t.payment_due_day}
                        </p>

                        <p>
                          <strong>Move-in:</strong> {dateLabel(t.start_date)}
                        </p>

                        <p>
                          <strong>Deposit:</strong> {money(t.deposit_amount)}
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => openEditTenancy(t)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="secondary"
                          onClick={() => openTransfer(t)}
                        >
                          <ArrowRightLeft size={16} />
                          Transfer
                        </button>

                        <button
                          type="button"
                          className="secondary"
                          onClick={() => openMoveOut(t)}
                        >
                          <LogOut size={16} />
                          Move Out
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Rental History */}

            <div className="panel">
              <h3>Rental History</h3>

              {!(selectedTenant.tenancies || []).length ? (
                <p>No rental periods yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Unit</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Rent</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(selectedTenant.tenancies || [])
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.start_date) - new Date(a.start_date),
                        )
                        .map((t) => (
                          <tr key={t.id}>
                            <td>{t.units?.unit_number || "—"}</td>

                            <td>{dateLabel(t.start_date)}</td>

                            <td>{dateLabel(t.end_date)}</td>

                            <td>{money(t.monthly_rent)}</td>

                            <td>
                              <StatusBadge status={t.status} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================
          TENANT PORTAL KEY
      ====================================================== */}



      {/* ======================================================
    EDIT TENANT
====================================================== */}

      <Modal
        open={editTenantOpen}
        onClose={() => setEditTenantOpen(false)}
        title="Edit tenant information"
      >
        <form className="form-grid" onSubmit={saveEditTenant}>
          <label>
            First name
            <input
              required
              value={editTenantForm.first_name}
              onChange={(e) =>
                setEditTenantForm({
                  ...editTenantForm,
                  first_name: e.target.value,
                })
              }
            />
          </label>

          <label>
            Last name
            <input
              value={editTenantForm.last_name}
              onChange={(e) =>
                setEditTenantForm({
                  ...editTenantForm,
                  last_name: e.target.value,
                })
              }
            />
          </label>

          <label>
            Phone
            <input
              value={editTenantForm.phone}
              onChange={(e) =>
                setEditTenantForm({
                  ...editTenantForm,
                  phone: e.target.value,
                })
              }
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={editTenantForm.email}
              onChange={(e) =>
                setEditTenantForm({
                  ...editTenantForm,
                  email: e.target.value,
                })
              }
            />
          </label>

          <label className="full-span">
            Address
            <input
              value={editTenantForm.address}
              onChange={(e) =>
                setEditTenantForm({
                  ...editTenantForm,
                  address: e.target.value,
                })
              }
            />
          </label>

          <label className="full-span">
            Notes
            <textarea
              value={editTenantForm.notes}
              onChange={(e) =>
                setEditTenantForm({
                  ...editTenantForm,
                  notes: e.target.value,
                })
              }
            />
          </label>

          <div className="form-actions full-span">
            <button
              className="secondary"
              type="button"
              onClick={() => setEditTenantOpen(false)}
            >
              Cancel
            </button>

            <button className="primary" type="submit">
              Save changes
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================
    MOVE OUT TENANT
====================================================== */}

      <Modal
        open={moveOutOpen}
        onClose={() => {
          setMoveOutOpen(false);
          setMovingOutTenancy(null);
        }}
        title="Move out tenant"
      >
        <form className="form-grid" onSubmit={saveMoveOut}>
          <div className="full-span">
            <div className="panel">
              <p style={{ margin: 0 }}>
                <strong>Tenant:</strong>{" "}
                {selectedTenant
                  ? `${selectedTenant.first_name} ${selectedTenant.last_name}`
                  : "—"}
              </p>

              <p style={{ margin: "8px 0 0" }}>
                <strong>Unit:</strong>{" "}
                {movingOutTenancy?.units?.unit_number || "—"}
              </p>

              <p style={{ margin: "8px 0 0" }}>
                <strong>Move-in:</strong>{" "}
                {movingOutTenancy
                  ? dateLabel(movingOutTenancy.start_date)
                  : "—"}
              </p>

              <p
                style={{
                  margin: "12px 0 0",
                  color: "#64748b",
                }}
              >
                The tenancy will be ended and the unit will become available.
                Existing payment and rental history will remain unchanged.
              </p>
            </div>
          </div>

          <label>
            Move-out date
            <input
              required
              type="date"
              min={movingOutTenancy?.start_date || undefined}
              value={moveOutForm.move_out_date}
              onChange={(e) =>
                setMoveOutForm({
                  ...moveOutForm,
                  move_out_date: e.target.value,
                })
              }
            />
          </label>

          <label className="full-span">
            Notes
            <textarea
              placeholder="Optional move-out notes"
              value={moveOutForm.notes}
              onChange={(e) =>
                setMoveOutForm({
                  ...moveOutForm,
                  notes: e.target.value,
                })
              }
            />
          </label>

          <div className="form-actions full-span">
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setMoveOutOpen(false);
                setMovingOutTenancy(null);
              }}
            >
              Cancel
            </button>

            <button className="primary" type="submit">
              <LogOut size={16} />
              Move Out
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================
          EDIT CURRENT TENANCY
      ====================================================== */}

      <Modal
        open={Boolean(editingTenancy)}
        onClose={() => setEditingTenancy(null)}
        title="Edit current tenancy"
      >
        <form className="form-grid" onSubmit={saveEditTenancy}>
          <div className="full-span">
            <div className="panel">
              <p
                style={{
                  margin: 0,
                }}
              >
                <strong>Unit:</strong>{" "}
                {editingTenancy?.units?.unit_number || "—"}
              </p>

              <p
                style={{
                  margin: "8px 0 0",
                }}
              >
                <strong>Move-in:</strong>{" "}
                {editingTenancy ? dateLabel(editingTenancy.start_date) : "—"}
              </p>
            </div>
          </div>

          <label>
            Monthly rent
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={editTenancyForm.monthly_rent}
              onChange={(e) =>
                setEditTenancyForm({
                  ...editTenancyForm,
                  monthly_rent: e.target.value,
                })
              }
            />
          </label>

          <label>
            Payment due day
            <input
              required
              type="number"
              min="1"
              max="31"
              value={editTenancyForm.payment_due_day}
              onChange={(e) =>
                setEditTenancyForm({
                  ...editTenancyForm,
                  payment_due_day: e.target.value,
                })
              }
            />
          </label>

          <label>
            Deposit
            <input
              type="number"
              min="0"
              step="0.01"
              value={editTenancyForm.deposit_amount}
              onChange={(e) =>
                setEditTenancyForm({
                  ...editTenancyForm,
                  deposit_amount: e.target.value,
                })
              }
            />
          </label>

          <label className="full-span">
            Notes
            <textarea
              value={editTenancyForm.notes}
              onChange={(e) =>
                setEditTenancyForm({
                  ...editTenancyForm,
                  notes: e.target.value,
                })
              }
            />
          </label>

          <div className="form-actions full-span">
            <button
              className="secondary"
              type="button"
              onClick={() => setEditingTenancy(null)}
            >
              Cancel
            </button>

            <button className="primary" type="submit">
              Save changes
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================
          TRANSFER TENANT
      ====================================================== */}

      <Modal
        open={transferOpen}
        onClose={() => {
          setTransferOpen(false);
          setTransferringTenancy(null);
        }}
        title="Transfer tenant"
      >
        <form className="form-grid" onSubmit={saveTransfer}>
          <div className="full-span">
            <div className="panel">
              <p
                style={{
                  margin: 0,
                }}
              >
                <strong>Current unit:</strong>{" "}
                {transferringTenancy?.units?.unit_number || "—"}
              </p>

              <p
                style={{
                  margin: "8px 0 0",
                }}
              >
                <strong>Move-in:</strong>{" "}
                {transferringTenancy
                  ? dateLabel(transferringTenancy.start_date)
                  : "—"}
              </p>

              <p
                style={{
                  margin: "8px 0 0",
                  color: "#64748b",
                }}
              >
                The existing rental period and payment history will remain
                unchanged.
              </p>
            </div>
          </div>

          <label className="full-span">
            Transfer to unit
            <select
              required
              value={transferForm.new_unit_id}
              onChange={(e) => {
                const unitId = e.target.value;

                const selectedUnit = (units || []).find((u) => u.id === unitId);

                setTransferForm({
                  ...transferForm,
                  new_unit_id: unitId,
                  monthly_rent:
                    selectedUnit?.default_rent ?? transferForm.monthly_rent,
                });
              }}
            >
              <option value="">Select available unit</option>

              {(units || [])
                .filter(
                  (u) =>
                    u.status === "available" &&
                    u.id !== transferringTenancy?.unit_id,
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unit_number}
                    {" — "}
                    {money(u.default_rent)}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Transfer date
            <input
              required
              type="date"
              min={
                transferringTenancy
                  ? new Date(
                      new Date(transferringTenancy.start_date).getTime() +
                        24 * 60 * 60 * 1000,
                    )
                      .toISOString()
                      .slice(0, 10)
                  : undefined
              }
              value={transferForm.transfer_date}
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  transfer_date: e.target.value,
                })
              }
            />
          </label>

          <label>
            Monthly rent
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={transferForm.monthly_rent}
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  monthly_rent: e.target.value,
                })
              }
            />
          </label>

          <label>
            Payment due day
            <input
              required
              type="number"
              min="1"
              max="31"
              value={transferForm.payment_due_day}
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  payment_due_day: e.target.value,
                })
              }
            />
          </label>

          <label>
            Deposit
            <input
              type="number"
              min="0"
              step="0.01"
              value={transferForm.deposit_amount}
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  deposit_amount: e.target.value,
                })
              }
            />
          </label>

          <label className="full-span">
            Notes
            <textarea
              placeholder="Optional transfer notes"
              value={transferForm.notes}
              onChange={(e) =>
                setTransferForm({
                  ...transferForm,
                  notes: e.target.value,
                })
              }
            />
          </label>

          <div className="form-actions full-span">
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setTransferOpen(false);
                setTransferringTenancy(null);
              }}
            >
              Cancel
            </button>

            <button className="primary" type="submit">
              Transfer tenant
            </button>
          </div>
        </form>
      </Modal>

      {/* ======================================================
          CREATE TENANCY
      ====================================================== */}

      <Modal
        open={tenancyOpen}
        onClose={() => setTenancyOpen(false)}
        title="Create tenancy"
      >
        <form className="form-grid" onSubmit={saveTenancy}>
          <label className="full-span">
            Unit
            <select
              required
              value={tenancyForm.unit_id}
              onChange={(e) =>
                setTenancyForm({
                  ...tenancyForm,
                  unit_id: e.target.value,
                })
              }
            >
              <option value="">Select available unit</option>

              {(units || [])
                .filter((u) => u.status === "available")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    Unit {u.unit_number}
                    {" — "}
                    {money(u.default_rent)}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Start date
            <input
              required
              type="date"
              value={tenancyForm.start_date}
              onChange={(e) =>
                setTenancyForm({
                  ...tenancyForm,
                  start_date: e.target.value,
                })
              }
            />
          </label>

          <label>
            Monthly rent
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={tenancyForm.monthly_rent}
              placeholder="12000"
              onChange={(e) =>
                setTenancyForm({
                  ...tenancyForm,
                  monthly_rent: e.target.value,
                })
              }
            />
          </label>

          <label>
            Payment due day
            <input
              required
              type="number"
              min="1"
              max="31"
              value={tenancyForm.payment_due_day}
              onChange={(e) =>
                setTenancyForm({
                  ...tenancyForm,
                  payment_due_day: e.target.value,
                })
              }
            />
          </label>

          <label>
            Deposit
            <input
              type="number"
              min="0"
              step="0.01"
              value={tenancyForm.deposit_amount}
              onChange={(e) =>
                setTenancyForm({
                  ...tenancyForm,
                  deposit_amount: e.target.value,
                })
              }
            />
          </label>

          <label className="full-span">
            Notes
            <textarea
              value={tenancyForm.notes}
              onChange={(e) =>
                setTenancyForm({
                  ...tenancyForm,
                  notes: e.target.value,
                })
              }
            />
          </label>

          <div className="form-actions full-span">
            <button
              className="secondary"
              type="button"
              onClick={() => setTenancyOpen(false)}
            >
              Cancel
            </button>

            <button className="primary" type="submit">
              Create tenancy
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
