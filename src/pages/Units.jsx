import { useEffect, useState } from "react";
import { Building2, Droplets, Pencil, Plus, Zap } from "lucide-react";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { db } from "../services/db";
import { useAsync } from "../hooks/useData";
import { compareUnitNumbers, money } from "../lib/utils";
import { useToast } from "../components/Toast";
import { useSearchParams } from "react-router-dom";

const emptyForm = () => ({
  property_id: "",
  unit_number: "",
  floor: "",
  unit_type: "Apartment",
  default_rent: "",
  status: "available",
  notes: "",

  electricity_meter_type: "direct",
  electricity_can: "",
  electricity_bill_name: "",

  water_can: "",
  water_bill_name: "",
});

export default function Units() {
  const { data, loading, refresh } = useAsync(() => db.units.list(), []);

  const props = useAsync(() => db.properties.list(), []);

  // Load active tenancies separately so the redesigned unit cards can show
  // the current tenant without changing the existing units API.
  const tenancies = useAsync(() => db.tenancies.list(), []);

  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const [editingUnit, setEditingUnit] = useState(null);

  const [form, setForm] = useState(emptyForm());

  const toast = useToast();

  useEffect(() => {
    if (searchParams.get("create") !== "unit") return;

    openAdd();
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  /* ---------------------------------------------------------------------- */
  /* Helpers                                                                */
  /* ---------------------------------------------------------------------- */

  const resetForm = () => {
    setForm(emptyForm());
    setEditingUnit(null);
  };

  const closeModal = () => {
    setOpen(false);
    resetForm();
  };

  /* ---------------------------------------------------------------------- */
  /* Open Add                                                               */
  /* ---------------------------------------------------------------------- */

  const openAdd = () => {
    resetForm();

    /*
     * If there is only one property,
     * automatically select it.
     */
    if (props.data?.length === 1) {
      setForm({
        ...emptyForm(),
        property_id: props.data[0].id,
      });
    }

    setOpen(true);
  };

  /* ---------------------------------------------------------------------- */
  /* Open Edit                                                              */
  /* ---------------------------------------------------------------------- */

  const openEdit = (unit) => {
    setEditingUnit(unit);

    setForm({
      property_id: unit.property_id || "",

      unit_number: unit.unit_number || "",

      floor: unit.floor || "",

      unit_type: unit.unit_type || "Apartment",

      default_rent: unit.default_rent ?? "",

      status: unit.status || "available",

      notes: unit.notes || "",

      electricity_meter_type:
        unit.electricity_meter_type ||
        (String(unit.unit_number) === "8" || String(unit.unit_number) === "9"
          ? "submeter"
          : "direct"),

      electricity_can: unit.electricity_can || "",

      electricity_bill_name: unit.electricity_bill_name || "",

      water_can: unit.water_can || "",

      water_bill_name: unit.water_bill_name || "",
    });

    setOpen(true);
  };

  /* ---------------------------------------------------------------------- */
  /* Save                                                                   */
  /* ---------------------------------------------------------------------- */

  const save = async (e) => {
    e.preventDefault();

    try {
      if (!form.property_id) {
        throw new Error("Please select a property.");
      }

      if (!String(form.unit_number || "").trim()) {
        throw new Error("Unit number is required.");
      }

      const rent = Number(form.default_rent);

      if (!Number.isFinite(rent) || rent < 0) {
        throw new Error("Default monthly rent must be a valid number.");
      }

      const payload = {
        property_id: form.property_id,

        unit_number: String(form.unit_number).trim(),

        floor: String(form.floor || "").trim() || null,

        unit_type: String(form.unit_type || "Apartment").trim(),

        default_rent: rent,

        status: form.status,

        notes: String(form.notes || "").trim() || null,

        electricity_meter_type: form.electricity_meter_type,

        electricity_can: String(form.electricity_can || "").trim() || null,

        electricity_bill_name:
          String(form.electricity_bill_name || "").trim() || null,

        water_can: String(form.water_can || "").trim() || null,

        water_bill_name: String(form.water_bill_name || "").trim() || null,
      };

      if (editingUnit) {
        await db.units.update(editingUnit.id, payload);

        toast.success(`Unit ${payload.unit_number} updated.`);
      } else {
        await db.units.create(payload);

        toast.success(`Unit ${payload.unit_number} created.`);
      }

      closeModal();
      await refresh();
    } catch (error) {
      toast.error(error?.message || "Unable to save unit.");
    }
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="units-page">
      <div className="page-head units-page-head">
        <div>
          <h1>Unit Overview</h1>
          <p>
            Overview of unit availability, utilities information, and individual
            rent rates.
          </p>
        </div>
      </div>

      <section className="unit-grid unit-directory-grid">
        {[...(data || [])].sort(compareUnitNumbers).map((u) => {
          const activeTenancy = (tenancies.data || []).find(
            (t) => t.unit_id === u.id && t.status === "active",
          );

          const tenant = activeTenancy?.tenants;
          const tenantName = tenant
            ? `${tenant.first_name || ""} ${tenant.last_name || ""}`.trim()
            : "Vacant";

          return (
            <article className="unit-card unit-directory-card" key={u.id}>
              <div className="unit-card-header">
                <div className="unit-card-icon">
                  <Building2 size={18} />
                </div>

                <span className={`unit-status-badge ${u.status}`}>
                  {u.status === "available"
                    ? "Available"
                    : u.status === "reserved"
                      ? "Reserved"
                      : u.status === "maintenance"
                        ? "Maintenance"
                        : u.status === "unavailable"
                          ? "Unavailable"
                          : "Occupied"}
                </span>
              </div>

              <div className="unit-card-title">
                <span className="unit-number-label">
                  UNIT {String(u.unit_number).padStart(2, "0")}
                </span>
                <h2>{u.unit_type || "Apartment"}</h2>
              </div>

              <div className="unit-card-divider" />

              <div className="unit-card-meta">
                <div>
                  <span>Current tenant</span>
                  <strong className={tenant ? "" : "is-vacant"}>
                    {tenantName}
                  </strong>
                </div>

                <div>
                  <span>Monthly rent</span>
                  <strong>
                    {money(activeTenancy?.monthly_rent ?? u.default_rent)}
                  </strong>
                </div>
              </div>

              <div className="unit-utilities">
                <div className="unit-utilities-title">
                  <span>Utilities</span>
                </div>

                <div className="unit-utility-row">
                  <div className="unit-utility-name">
                    <span className="unit-utility-icon electricity">
                      <Zap size={13} />
                    </span>
                    <strong>Meralco</strong>
                  </div>

                  <div className="unit-utility-value">
                    <span>{u.electricity_can || "No CAN"}</span>
                    <small>{u.electricity_bill_name || "No bill name"}</small>
                  </div>
                </div>

                <div className="unit-utility-row">
                  <div className="unit-utility-name">
                    <span className="unit-utility-icon water">
                      <Droplets size={13} />
                    </span>
                    <strong>Maynilad</strong>
                  </div>

                  <div className="unit-utility-value">
                    <span>{u.water_can || "No CAN"}</span>
                    <small>{u.water_bill_name || "No bill name"}</small>
                  </div>
                </div>
              </div>

              <div className="unit-card-actions">
                <button
                  type="button"
                  className="secondary unit-edit-btn"
                  onClick={() => openEdit(u)}
                >
                  <Pencil size={14} />
                  Edit unit
                </button>
              </div>
            </article>
          );
        })}

        {!loading && !data?.length && (
          <div className="panel unit-empty-state">
            <EmptyState
              icon={Building2}
              title="No units yet"
              message="Add your first unit to get started."
            />
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Add / Edit Modal                                                   */}
      {/* ------------------------------------------------------------------ */}

      <Modal
        open={open}
        onClose={closeModal}
        title={
          editingUnit ? `Edit Unit ${editingUnit.unit_number}` : "Add unit"
        }
      >
        <form className="form-grid" onSubmit={save}>
          {/* -------------------------------------------------------------- */}
          {/* Basic information                                               */}
          {/* -------------------------------------------------------------- */}

          <div
            className="full-span"
            style={{
              fontWeight: 700,
              fontSize: "14px",
              marginBottom: "-4px",
            }}
          >
            Unit Information
          </div>

          <label>
            Property
            <select
              required
              value={form.property_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  property_id: e.target.value,
                })
              }
            >
              <option value="">Select property</option>

              {(props.data || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Unit number
            <input
              required
              value={form.unit_number}
              onChange={(e) =>
                setForm({
                  ...form,
                  unit_number: e.target.value,
                })
              }
            />
          </label>

          <label>
            Floor
            <input
              value={form.floor}
              onChange={(e) =>
                setForm({
                  ...form,
                  floor: e.target.value,
                })
              }
              placeholder="e.g. 1"
            />
          </label>

          <label>
            Unit type
            <input
              value={form.unit_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  unit_type: e.target.value,
                })
              }
              placeholder="Apartment"
            />
          </label>

          <label>
            Default monthly rent
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.default_rent}
              onChange={(e) =>
                setForm({
                  ...form,
                  default_rent: e.target.value,
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
              <option value="available">Available</option>

              <option value="reserved">Reserved</option>

              <option value="maintenance">Maintenance</option>

              <option value="unavailable">Unavailable</option>

              <option value="occupied">Occupied</option>
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

          {/* -------------------------------------------------------------- */}
          {/* Meralco                                                        */}
          {/* -------------------------------------------------------------- */}

          <div
            className="full-span"
            style={{
              fontWeight: 700,
              fontSize: "14px",
              marginTop: "8px",
              marginBottom: "-4px",
            }}
          >
            Meralco
          </div>

          <label>
            Meter Type
            <select
              value={form.electricity_meter_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  electricity_meter_type: e.target.value,
                })
              }
            >
              <option value="direct">Direct</option>

              <option value="submeter">Submeter</option>
            </select>
          </label>

          <label>
            Customer Account Number (CAN)
            <input
              value={form.electricity_can}
              onChange={(e) =>
                setForm({
                  ...form,
                  electricity_can: e.target.value,
                })
              }
            />
          </label>

          <label className="full-span">
            Bill Name
            <input
              value={form.electricity_bill_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  electricity_bill_name: e.target.value,
                })
              }
            />
          </label>

          {form.electricity_meter_type === "submeter" && (
            <div
              className="full-span"
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                background: "#fff7ed",
                fontSize: "12px",
              }}
            >
              <strong>Submeter:</strong> This unit does not have its own meter.
              Store the building/master Meralco CAN and Bill Name here. Unit
              consumption can be calculated later from its submeter readings.
            </div>
          )}

          {/* Maynilad */}

          <div
            className="full-span"
            style={{
              fontWeight: 700,
              fontSize: "14px",
              marginTop: "8px",
              marginBottom: "-4px",
            }}
          >
            Maynilad
          </div>

          <label>
            Customer Account Number (CAN)
            <input
              value={form.water_can}
              onChange={(e) =>
                setForm({
                  ...form,
                  water_can: e.target.value,
                })
              }
            />
          </label>

          <label>
            Bill Name
            <input
              value={form.water_bill_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  water_bill_name: e.target.value,
                })
              }
            />
          </label>

          {/* -------------------------------------------------------------- */}
          {/* Actions                                                         */}
          {/* -------------------------------------------------------------- */}

          <div className="form-actions full-span">
            <button type="button" className="secondary" onClick={closeModal}>
              Cancel
            </button>

            <button className="primary" type="submit">
              {editingUnit ? "Save changes" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
