import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { db } from "../services/db";
import { useAsync } from "../hooks/useData";
import { money } from "../lib/utils";
import { useToast } from "../components/Toast";

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

  const [open, setOpen] = useState(false);

  const [editingUnit, setEditingUnit] = useState(null);

  const [form, setForm] = useState(emptyForm());

  const toast = useToast();

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
    <div>
      <div className="page-head">
        <div>
          <h1>Unit Overview</h1>

          <p>
            Manage unit details, rental defaults, and utility account
            information.
          </p>
        </div>

        <button className="primary" onClick={openAdd}>
          <Plus size={17} />
          Add Unit
        </button>
      </div>

      <section className="unit-grid">
        {(data || []).map((u) => (
          <div className="unit-card" key={u.id}>
            <div className="unit-top">
              <strong>Unit {u.unit_number}</strong>

              <StatusBadge status={u.status} />
            </div>

            <p>{u.unit_type || "Apartment"}</p>

            <div className="unit-price">
              {money(u.default_rent)}

              <small>/ month default</small>
            </div>

            <div className="unit-foot">
              <span>Property</span>

              <span>
                {props.data?.find((p) => p.id === u.property_id)?.name || "—"}
              </span>
            </div>

            {/* -------------------------------------------------------- */}
            {/* Utility summary                                           */}
            {/* -------------------------------------------------------- */}

            <div
              style={{
                marginTop: "14px",
                paddingTop: "12px",
                borderTop: "1px solid var(--border, #e5e7eb)",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  marginBottom: "8px",
                }}
              >
                Utilities
              </div>

              {/* Electricity */}
              <div
                style={{
                  marginBottom: "10px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    marginBottom: "3px",
                  }}
                >
                  ⚡ Meralco
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    <strong>Meter:</strong>{" "}
                    {u.electricity_meter_type === "submeter"
                      ? "Submeter"
                      : "Direct"}
                  </div>

                  <div>
                    <strong>CAN:</strong> {u.electricity_can || "—"}
                  </div>

                  <div>
                    <strong>Bill Name:</strong> {u.electricity_bill_name || "—"}
                  </div>
                </div>
              </div>

              {/* Water */}
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    marginBottom: "3px",
                  }}
                >
                  💧 Maynilad
                </div>

                <div
                  style={{
                    fontSize: "12px",
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    <strong>CAN:</strong> {u.water_can || "—"}
                  </div>

                  <div>
                    <strong>Bill Name:</strong> {u.water_bill_name || "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------- */}
            {/* Edit                                                       */}
            {/* -------------------------------------------------------- */}

            <div
              style={{
                marginTop: "14px",
              }}
            >
              <button
                type="button"
                className="secondary"
                onClick={() => openEdit(u)}
              >
                <Pencil size={14} />
                Edit unit
              </button>
            </div>
          </div>
        ))}

        {!loading && !data?.length && (
          <div className="empty panel">No units yet. Add your first unit.</div>
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
            ⚡ Meralco
          </div>

          <label>
            Electricity meter type
            <select
              value={form.electricity_meter_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  electricity_meter_type: e.target.value,
                })
              }
            >
              <option value="direct">Direct Meralco Meter</option>

              <option value="submeter">Submeter</option>
            </select>
          </label>

          <label>
            Meralco CAN
            <input
              value={form.electricity_can}
              onChange={(e) =>
                setForm({
                  ...form,
                  electricity_can: e.target.value,
                })
              }
              placeholder="Customer Account Number"
            />
          </label>

          <label className="full-span">
            Meralco Bill Name
            <input
              value={form.electricity_bill_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  electricity_bill_name: e.target.value,
                })
              }
              placeholder="Name appearing on the Meralco bill"
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
              <strong>Submeter:</strong> This unit does not have its own direct
              Meralco meter. Store the building/master Meralco CAN and Bill Name
              here. Unit consumption can be calculated later from its submeter
              readings.
            </div>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Maynilad                                                       */}
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
            💧 Maynilad
          </div>

          <label>
            Maynilad CAN
            <input
              value={form.water_can}
              onChange={(e) =>
                setForm({
                  ...form,
                  water_can: e.target.value,
                })
              }
              placeholder="Customer Account Number"
            />
          </label>

          <label>
            Maynilad Bill Name
            <input
              value={form.water_bill_name}
              onChange={(e) =>
                setForm({
                  ...form,
                  water_bill_name: e.target.value,
                })
              }
              placeholder="Name appearing on the Maynilad bill"
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
              {editingUnit ? "Save changes" : "Save unit"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
