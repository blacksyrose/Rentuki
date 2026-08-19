import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { CheckCircle2, Download, Upload, X } from "lucide-react";
import { csvDownload } from "../lib/utils";
import { db, importExpenses, importPayments } from "../services/db";
import { useAsync } from "../hooks/useData";
import { useToast } from "../components/Toast";

const IMPORT_TYPES = [
  { value: "tenants", label: "Tenants", singular: "Tenant" },
  { value: "units", label: "Units", singular: "Unit" },
  { value: "payments", label: "Payments", singular: "Payment" },
  { value: "expenses", label: "Expenses", singular: "Expense" },
];

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value]),
  );
}

function splitName(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return { first_name: "", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned = String(value)
    .replace(/[₱$\s,]/g, "")
    .trim();

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : NaN;
}

function toIsoDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return "";
}

function parseTenantRows(rows) {
  const errors = [];
  const normalized = [];

  rows.forEach((rawRow, index) => {
    const row = normalizeRow(rawRow);
    const rowNumber = index + 2;
    const name = row.name || row.full_name || row.tenant_name || "";

    if (!String(name).trim()) {
      errors.push(`Row ${rowNumber}: name is required.`);
      return;
    }

    const { first_name, last_name } = splitName(name);
    const status = String(row.status || "active").trim().toLowerCase();
    const allowedStatuses = ["active", "moving", "moved_out", "historical"];

    normalized.push({
      sourceRow: rowNumber,
      first_name,
      last_name,
      phone: String(row.phone || "").trim() || null,
      email: String(row.email || "").trim() || null,
      address: String(row.address || "").trim() || null,
      status: allowedStatuses.includes(status) ? status : "active",
      notes: String(row.notes || "").trim() || null,
    });
  });

  return { errors, rows: normalized };
}

function parseUnitRows(rows) {
  const errors = [];
  const normalized = [];

  rows.forEach((rawRow, index) => {
    const row = normalizeRow(rawRow);
    const rowNumber = index + 2;
    const unitNumber = row.unit || row.unit_number || "";
    const rent = parseNumber(row.rent || row.default_rent || row.monthly_rent);

    if (!String(unitNumber).trim()) {
      errors.push(`Row ${rowNumber}: unit number is required.`);
      return;
    }

    if (!Number.isFinite(rent) || rent < 0) {
      errors.push(`Row ${rowNumber}: rent must be a valid non-negative number.`);
      return;
    }

    const statusMap = {
      vacant: "available",
      available: "available",
      occupied: "occupied",
      reserved: "reserved",
      maintenance: "maintenance",
      unavailable: "unavailable",
    };

    const rawStatus = String(row.status || "available").trim().toLowerCase();

    normalized.push({
      sourceRow: rowNumber,
      unit_number: String(unitNumber).trim(),
      unit_type: String(row.type || row.unit_type || "Apartment").trim(),
      default_rent: rent,
      status: statusMap[rawStatus] || "available",
      property_id: row.property_id || null,
    });
  });

  return { errors, rows: normalized };
}

function parsePaymentRows(rows) {
  const errors = [];
  const normalized = [];

  rows.forEach((rawRow, index) => {
    const row = normalizeRow(rawRow);
    const rowNumber = index + 2;
    const date = toIsoDate(row.date || row.payment_date);
    const amount = parseNumber(row.amount);
    const tenant = String(row.tenant || row.tenant_name || "").trim();

    if (!date) errors.push(`Row ${rowNumber}: payment date must be a valid date.`);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Row ${rowNumber}: amount must be greater than zero.`);
    }
    if (!tenant && !row.tenant_id) {
      errors.push(`Row ${rowNumber}: tenant or tenant_id is required.`);
    }

    normalized.push({
      ...row,
      date,
      amount,
      tenant,
      method: String(row.method || row.payment_method || "Cash").trim(),
      reference: String(row.reference || row.reference_number || "").trim(),
      notes: String(row.notes || row.remark || row.remarks || "").trim(),
    });
  });

  return { errors, rows: normalized };
}

function parseExpenseRows(rows) {
  const errors = [];
  const normalized = [];

  rows.forEach((rawRow, index) => {
    const row = normalizeRow(rawRow);
    const rowNumber = index + 2;
    const date = toIsoDate(row.date || row.expense_date);
    const amount = parseNumber(row.amount);

    if (!date) errors.push(`Row ${rowNumber}: expense date must be a valid date.`);
    if (!row.category) errors.push(`Row ${rowNumber}: category is required.`);
    if (!Number.isFinite(amount) || amount < 0) {
      errors.push(`Row ${rowNumber}: amount must be a valid non-negative number.`);
    }

    normalized.push({
      ...row,
      date,
      amount,
      category: String(row.category || "Other").trim(),
      description: String(row.description || "Imported expense").trim(),
      unit: String(row.unit || "").trim(),
      vendor: String(row.vendor || "").trim(),
    });
  });

  return { errors, rows: normalized };
}

function validateRows(type, rows) {
  switch (type) {
    case "units":
      return parseUnitRows(rows);
    case "payments":
      return parsePaymentRows(rows);
    case "expenses":
      return parseExpenseRows(rows);
    case "tenants":
    default:
      return parseTenantRows(rows);
  }
}

export default function Reports() {
  const tenants = useAsync(() => db.tenants.list(), []);
  const units = useAsync(() => db.units.list(), []);
  const payments = useAsync(() => db.payments.list(), []);
  const expenses = useAsync(() => db.expenses.list(), []);

  const toast = useToast();
  const fileInputRef = useRef(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState("tenants");
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [importing, setImporting] = useState(false);

  const exportRows = (name, data) => {
    csvDownload(data, `${name}.csv`);
  };

  const resetImport = () => {
    setRows([]);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeImport = () => {
    if (importing) return;
    setImportOpen(false);
    resetImport();
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoadingFile(true);
    setFileName(file.name);
    setRows([]);

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
      });

      if (!workbook.SheetNames.length) {
        throw new Error("The file does not contain a worksheet.");
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: true,
      });

      if (!parsed.length) {
        throw new Error("The selected file does not contain any data rows.");
      }

      setRows(parsed.slice(0, 500));
      toast.success(
        `${parsed.length} row${parsed.length === 1 ? "" : "s"} loaded for preview.`,
      );
    } catch (error) {
      setRows([]);
      toast.error(error.message || "Unable to read the selected file.");
    } finally {
      setLoadingFile(false);
    }
  };

  const importTenants = async (validatedRows) => {
    const existing = [...(tenants.data || [])];
    let imported = 0;
    let skipped = 0;

    for (const row of validatedRows) {
      const duplicate = existing.some((tenant) => {
        const sameEmail =
          row.email &&
          tenant.email &&
          row.email.toLowerCase() === tenant.email.toLowerCase();
        const samePhone =
          row.phone &&
          tenant.phone &&
          row.phone.replace(/\D/g, "") === tenant.phone.replace(/\D/g, "");
        return sameEmail || samePhone;
      });

      if (duplicate) {
        skipped += 1;
        continue;
      }

      const created = await db.tenants.create({
        first_name: row.first_name,
        last_name: row.last_name,
        phone: row.phone,
        email: row.email,
        address: row.address,
        status: row.status,
        notes: row.notes,
      });

      existing.push(created);
      imported += 1;
    }

    return { imported, skipped };
  };

  const importUnits = async (validatedRows) => {
    const existing = [...(units.data || [])];
    let imported = 0;
    let skipped = 0;

    for (const row of validatedRows) {
      const duplicate = existing.some(
        (unit) => String(unit.unit_number).trim() === row.unit_number,
      );

      if (duplicate) {
        skipped += 1;
        continue;
      }

      const created = await db.units.create({
        property_id: row.property_id || undefined,
        unit_number: row.unit_number,
        unit_type: row.unit_type,
        default_rent: row.default_rent,
        status: row.status,
      });

      existing.push(created);
      imported += 1;
    }

    return { imported, skipped };
  };

  const importRows = async () => {
    if (!rows.length) {
      toast.error("Please select a CSV or XLSX file first.");
      return;
    }

    const validation = validateRows(importType, rows);
    if (validation.errors.length) {
      toast.error(validation.errors[0]);
      return;
    }

    setImporting(true);

    try {
      let result;

      if (importType === "tenants") {
        result = await importTenants(validation.rows);
        toast.success(
          result.imported
            ? `${result.imported} tenant${result.imported === 1 ? "" : "s"} imported successfully${result.skipped ? `. ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped.` : "."}`
            : `No new tenants imported. ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped.`,
        );
      } else if (importType === "units") {
        result = await importUnits(validation.rows);
        toast.success(
          result.imported
            ? `${result.imported} unit${result.imported === 1 ? "" : "s"} imported successfully${result.skipped ? `. ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped.` : "."}`
            : `No new units imported. ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped.`,
        );
      } else if (importType === "payments") {
        result = await importPayments(validation.rows);
        const parts = [];
        if (result.importedCount) {
          parts.push(`${result.importedCount} payment${result.importedCount === 1 ? "" : "s"} imported`);
        }
        if (result.skippedCount) {
          parts.push(`${result.skippedCount} duplicate${result.skippedCount === 1 ? "" : "s"} skipped`);
        }
        if (result.errorCount) {
          parts.push(`${result.errorCount} row${result.errorCount === 1 ? "" : "s"} failed`);
        }
        toast[result.errorCount && !result.importedCount ? "error" : "success"](
          parts.join(". ") || "No payments were imported.",
        );
      } else {
        result = await importExpenses(validation.rows);
        const parts = [];
        if (result.importedCount) {
          parts.push(`${result.importedCount} expense${result.importedCount === 1 ? "" : "s"} imported`);
        }
        if (result.errorCount) {
          parts.push(`${result.errorCount} row${result.errorCount === 1 ? "" : "s"} failed`);
        }
        toast[result.errorCount && !result.importedCount ? "error" : "success"](
          parts.join(". ") || "No expenses were imported.",
        );
      }

      await Promise.all([
        tenants.refresh(),
        units.refresh(),
        payments.refresh(),
        expenses.refresh(),
      ]);

      closeImport();
    } catch (error) {
      toast.error(error.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const validation = rows.length ? validateRows(importType, rows) : null;
  const importLabel = IMPORT_TYPES.find((item) => item.value === importType);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Reports & Import</h1>
          <p>Export operational data and safely import existing spreadsheet records.</p>
        </div>
        <button className="secondary" onClick={() => setImportOpen(true)}>
          <Upload size={16} /> Import CSV/XLSX
        </button>
      </div>

      <div className="report-grid">
        <div className="panel">
          <h2>Tenant report</h2>
          <p>Active and historical tenants with rental history.</p>
          <button
            className="secondary"
            onClick={() =>
              exportRows(
                "tenant-report",
                (tenants.data || []).map((tenant) => ({
                  name: `${tenant.first_name} ${tenant.last_name}`.trim(),
                  phone: tenant.phone || "",
                  email: tenant.email || "",
                  status: tenant.status,
                  tenancies: tenant.tenancies?.length || 0,
                })),
              )
            }
          >
            <Download size={15} /> Export CSV
          </button>
        </div>

        <div className="panel">
          <h2>Unit report</h2>
          <p>Current unit inventory and default rent.</p>
          <button
            className="secondary"
            onClick={() =>
              exportRows(
                "unit-report",
                (units.data || []).map((unit) => ({
                  unit: unit.unit_number,
                  type: unit.unit_type,
                  rent: unit.default_rent,
                  status: unit.status,
                })),
              )
            }
          >
            <Download size={15} /> Export CSV
          </button>
        </div>

        <div className="panel">
          <h2>Payment report</h2>
          <p>All recorded payment transactions.</p>
          <button
            className="secondary"
            onClick={() =>
              exportRows(
                "payment-report",
                (payments.data || []).map((payment) => ({
                  date: payment.payment_date,
                  tenant: `${payment.tenants?.first_name || ""} ${payment.tenants?.last_name || ""}`.trim(),
                  amount: payment.amount,
                  method: payment.payment_method,
                  reference: payment.reference_number || "",
                  remarks: payment.notes || "",
                })),
              )
            }
          >
            <Download size={15} /> Export CSV
          </button>
        </div>

        <div className="panel">
          <h2>Expense report</h2>
          <p>Expenses by date, category and unit.</p>
          <button
            className="secondary"
            onClick={() =>
              exportRows(
                "expense-report",
                (expenses.data || []).map((expense) => ({
                  date: expense.expense_date,
                  category: expense.category,
                  description: expense.description,
                  amount: expense.amount,
                  unit: expense.units?.unit_number || "",
                  vendor: expense.vendor || "",
                })),
              )
            }
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {importOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: "min(900px, 95vw)", maxHeight: "90vh", overflow: "auto" }}>
            <div className="modal-head">
              <div>
                <h2>Import CSV/XLSX</h2>
                <p>Preview your spreadsheet before writing anything to Supabase.</p>
              </div>
              <button className="icon-button" onClick={closeImport} disabled={importing}>
                <X size={20} />
              </button>
            </div>

            <div className="form-grid">
              <label>
                Import type
                <select
                  value={importType}
                  onChange={(event) => {
                    setImportType(event.target.value);
                    resetImport();
                  }}
                  disabled={importing}
                >
                  {IMPORT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </label>

              <label>
                Spreadsheet
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFile}
                  disabled={loadingFile || importing}
                />
              </label>
            </div>

            {fileName && (
              <div className="panel" style={{ marginTop: 16 }}>
                <strong>Selected file:</strong> {fileName}
              </div>
            )}

            {loadingFile && (
              <div className="panel" style={{ marginTop: 16 }}>Reading spreadsheet…</div>
            )}

            {rows.length > 0 && (
              <>
                <div className="panel" style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                    <div>
                      <strong>{rows.length} row{rows.length === 1 ? "" : "s"} loaded</strong>
                      <p style={{ margin: "4px 0 0" }}>Review the first rows before importing.</p>
                    </div>
                    {!validation?.errors?.length && (
                      <span className="status-badge success"><CheckCircle2 size={14} /> Valid</span>
                    )}
                  </div>
                </div>

                {validation?.errors?.length > 0 && (
                  <div className="panel" style={{ marginTop: 16, borderColor: "#ef4444" }}>
                    <strong>Validation errors</strong>
                    <ul>{validation.errors.slice(0, 10).map((error) => <li key={error}>{error}</li>)}</ul>
                  </div>
                )}

                <div className="panel" style={{ marginTop: 16, overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>{Object.keys(rows[0]).map((key) => <th key={key}>{key}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 10).map((row, index) => (
                        <tr key={index}>
                          {Object.keys(rows[0]).map((key) => <td key={key}>{String(row[key] ?? "")}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="secondary" onClick={closeImport} disabled={importing}>Cancel</button>
              <button
                className="primary"
                onClick={importRows}
                disabled={importing || loadingFile || !rows.length || Boolean(validation?.errors?.length)}
              >
                {importing ? "Importing…" : `Import ${rows.length || 0} ${importLabel?.label || "Records"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
