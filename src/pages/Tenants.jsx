import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Eye,
  ArrowRightLeft,
  Pencil,
  LogOut,
  RotateCcw,
  Users,
} from "lucide-react";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { db } from "../services/db";
import { useAsync } from "../hooks/useData";
import { compareUnitNumbers, money, dateLabel } from "../lib/utils";
import { useToast } from "../components/Toast";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

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
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedTenant, setSelectedTenant] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  const [tenancyOpen, setTenancyOpen] = useState(false);
  const [editingTenancy, setEditingTenancy] = useState(null);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferringTenancy, setTransferringTenancy] = useState(null);

  const [editTenantOpen, setEditTenantOpen] = useState(false);

  const [moveOutOpen, setMoveOutOpen] = useState(false);
  const [movingOutTenancy, setMovingOutTenancy] = useState(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoringTenancy, setRestoringTenancy] = useState(null);

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

  useEffect(() => {
    if (searchParams.get("create") !== "tenant") return;

    setOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

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
    start_date: "",
    end_date: "",
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
    )
    .sort((left, right) => {
      const leftUnit = (left.tenancies || []).find(
        (tenancy) => tenancy.status === "active",
      )?.units;
      const rightUnit = (right.tenancies || []).find(
        (tenancy) => tenancy.status === "active",
      )?.units;
      return compareUnitNumbers(leftUnit, rightUnit);
    });

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
      start_date: tenancy.start_date || "",
      end_date: tenancy.end_date || "",
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
      if (!editTenancyForm.start_date) {
        throw new Error("Move-in date is required.");
      }

      if (
        editTenancyForm.end_date &&
        editTenancyForm.end_date < editTenancyForm.start_date
      ) {
        throw new Error("End date cannot be before the move-in date.");
      }

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
        start_date: editTenancyForm.start_date,
        end_date: editTenancyForm.end_date || null,
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
        `Tenant ${[selectedTenant.first_name, selectedTenant.last_name]
          .filter(Boolean)
          .join(" ")} has been moved out.`,
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
  // Restore a moved-out tenant
  // ------------------------------------------------------------

  const openRestore = (tenancy) => {
    if (!tenancy || !selectedTenant) return;

    setRestoringTenancy(tenancy);
    setRestoreOpen(true);
  };

  const restoreMoveOut = async () => {
    if (!selectedTenant || !restoringTenancy) return;

    try {
      const unitId = restoringTenancy.unit_id;

      if (!unitId) {
        throw new Error("This tenancy has no unit assigned, so it cannot be restored.");
      }

      // Do not restore into a unit that has already been occupied by another tenant.
      const { data: unit, error: unitError } = await supabase
        .from("units")
        .select("id, status, unit_number")
        .eq("id", unitId)
        .single();

      if (unitError) throw unitError;

      if (unit.status !== "available") {
        throw new Error(
          `Unit ${unit.unit_number || ""} is no longer available. The move-out cannot be reverted safely.`,
        );
      }

      // A tenant can only have one active tenancy.
      const existingActive = (selectedTenant.tenancies || []).find(
        (tenancy) => tenancy.status === "active",
      );

      if (existingActive && existingActive.id !== restoringTenancy.id) {
        throw new Error(
          "This tenant already has an active tenancy. End that tenancy first before restoring this one.",
        );
      }

      const { error: tenancyError } = await supabase
        .from("tenancies")
        .update({
          status: "active",
          end_date: null,
        })
        .eq("id", restoringTenancy.id)
        .eq("tenant_id", selectedTenant.id);

      if (tenancyError) throw tenancyError;

      const { error: unitUpdateError } = await supabase
        .from("units")
        .update({ status: "occupied" })
        .eq("id", unitId);

      if (unitUpdateError) throw unitUpdateError;

      const { error: tenantError } = await supabase
        .from("tenants")
        .update({ status: "active" })
        .eq("id", selectedTenant.id);

      if (tenantError) throw tenantError;

      const tenantId = selectedTenant.id;

      setRestoreOpen(false);
      setRestoringTenancy(null);

      await refresh();
      await refreshUnits();
      await refreshSelectedTenant(tenantId);

      toast.success("Move-out reverted. Tenant is active again.");
    } catch (e) {
      toast.error(e?.message || "Unable to restore the tenancy.");
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
          <p>
            Track and manage tenant directory [Personal informations and rental history]
          </p>
        </div>

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
                              {[t.first_name, t.last_name]
                                .filter(Boolean)
                                .join(" ")}
                            </strong>
                            <small>
                              {t.phone || t.email || "-"}
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
        title=""
        wide
        headerActions={(() => {
          const activeTenancy = (selectedTenant?.tenancies || []).find(
            (tenancy) => tenancy.status === "active",
          );

          if (activeTenancy) {
            return (
              <>
                <button
                  type="button"
                  className="icon-btn"
                  title="Edit rental"
                  aria-label="Edit rental"
                  onClick={() => openEditTenancy(activeTenancy)}
                >
                  <Pencil size={17} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Transfer tenant"
                  aria-label="Transfer tenant"
                  onClick={() => openTransfer(activeTenancy)}
                >
                  <ArrowRightLeft size={17} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Move out tenant"
                  aria-label="Move out tenant"
                  onClick={() => openMoveOut(activeTenancy)}
                >
                  <LogOut size={17} />
                </button>
              </>
            );
          }

          const endedTenancy = (selectedTenant?.tenancies || [])
            .filter((tenancy) => tenancy.status === "ended")
            .slice()
            .sort(
              (a, b) =>
                new Date(b.end_date || b.start_date) -
                new Date(a.end_date || a.start_date),
            )[0];

          if (selectedTenant?.status === "moved_out" && endedTenancy) {
            return (
              <button
                type="button"
                className="icon-btn"
                title="Restore moved-out tenant"
                aria-label="Restore moved-out tenant"
                onClick={() => openRestore(endedTenancy)}
              >
                <RotateCcw size={17} />
              </button>
            );
          }

          return null;
        })()}
      >
        {selectedTenant && (
          <div className="tenant-profile-content">
            {/* Personal Information */}
            <div
              className="panel tenant-profile-personal-panel"
              style={{ marginBottom: 16 }}
            >
              <h3>Personal Information</h3>

              <div className="tenant-profile-personal-grid">
                <div className="tenant-profile-avatar" aria-hidden="true">
                  {(selectedTenant.first_name?.[0] || "T").toUpperCase()}
                  {(selectedTenant.last_name?.[0] || "").toUpperCase()}
                </div>

                <div className="tenant-profile-identity">
                  <strong className="tenant-profile-name">
                    {[selectedTenant.first_name, selectedTenant.last_name]
                      .filter(Boolean)
                      .join(" ") || "Tenant"}
                  </strong>

                  <div className="tenant-profile-field">
                    <span className="tenant-profile-label">Phone</span>
                    <span>{selectedTenant.phone || "—"}</span>
                  </div>

                  <div className="tenant-profile-field">
                    <span className="tenant-profile-label">Email</span>
                    <span>{selectedTenant.email || "—"}</span>
                  </div>
                </div>

                <div className="tenant-profile-meta">
                  <div className="tenant-profile-field tenant-profile-address">
                    <span className="tenant-profile-label">Address</span>
                    <span>{selectedTenant.address || "—"}</span>
                  </div>

                  <div className="tenant-profile-field tenant-profile-status">
                    <span className="tenant-profile-label">Status</span>
                    {selectedTenant.status === "active" ? (
                      <span className="tenant-history-status tenant-history-status-active">
                        Active
                      </span>
                    ) : selectedTenant.status === "moved_out" ? (
                      <span className="tenant-history-status tenant-history-status-moved-out">
                        Moved out
                      </span>
                    ) : (
                      <span className="tenant-history-status tenant-history-status-ended">
                        Ended
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selectedTenant.notes && (
                <div className="tenant-profile-notes">
                  <span className="tenant-profile-label">Notes</span>
                  <span>{selectedTenant.notes}</span>
                </div>
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
                              {t.status === "active" ? (
                                <span className="tenant-history-status tenant-history-status-active">
                                  Active
                                </span>
                              ) : (
                                <span className="tenant-history-status tenant-history-status-ended">
                                  Ended
                                </span>
                              )}
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

      {/* EDIT TENANT */}

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
          RESTORE MOVED-OUT TENANT
      ====================================================== */}

      <Modal
        open={restoreOpen}
        onClose={() => {
          setRestoreOpen(false);
          setRestoringTenancy(null);
        }}
        title="Restore tenant"
      >
        <div className="restore-tenant-modal">
          <div className="restore-tenant-icon">
            <RotateCcw size={20} />
          </div>

          <h3>Restore this tenant?</h3>
          <p>
            This will undo the move-out and return the tenant to <strong>Active</strong>
            status. The previous tenancy will become active again and the unit will
            be marked as occupied.
          </p>

          {restoringTenancy && (
            <div className="restore-tenant-summary">
              <div>
                <span>Tenant</span>
                <strong>
                  {[selectedTenant?.first_name, selectedTenant?.last_name]
                    .filter(Boolean)
                    .join(" ")}
                </strong>
              </div>
              <div>
                <span>Unit</span>
                <strong>Unit {restoringTenancy.units?.unit_number || "—"}</strong>
              </div>
              <div>
                <span>Move-in</span>
                <strong>{dateLabel(restoringTenancy.start_date)}</strong>
              </div>
              <div>
                <span>Move-out</span>
                <strong>{dateLabel(restoringTenancy.end_date)}</strong>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setRestoreOpen(false);
                setRestoringTenancy(null);
              }}
            >
              Cancel
            </button>
            <button className="primary" type="button" onClick={restoreMoveOut}>
              <RotateCcw size={16} />
              Restore tenant
            </button>
          </div>
        </div>
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
        title="Edit tenancy"
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
            Move-in date
            <input
              required
              type="date"
              value={editTenancyForm.start_date}
              onChange={(e) =>
                setEditTenancyForm({
                  ...editTenancyForm,
                  start_date: e.target.value,
                })
              }
            />
          </label>

          <label>
            End date
            <input
              type="date"
              min={editTenancyForm.start_date || undefined}
              value={editTenancyForm.end_date}
              onChange={(e) =>
                setEditTenancyForm({
                  ...editTenancyForm,
                  end_date: e.target.value,
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
                .sort(compareUnitNumbers)
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
                .sort(compareUnitNumbers)
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
