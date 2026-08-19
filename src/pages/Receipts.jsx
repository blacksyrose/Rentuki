import { useMemo, useState } from "react";
import jsPDF from "jspdf";
import unicodeFontUrl from "dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url";
import { db } from "../services/db";
import { useAsync } from "../hooks/useData";
import { dateLabel } from "../lib/utils";
import { useToast } from "../components/Toast";

const RECEIPT_WIDTH = 180;
const RECEIPT_HEIGHT = 105;

export default function Receipts() {
  const payments = useAsync(() => db.payments.list(), []);
  const properties = useAsync(() => db.properties.list(), []);

  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const toast = useToast();

  const paymentList = payments.data || [];

  const selectedPayment = paymentList.find(
    (payment) => payment.id === selected,
  );

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return paymentList;

    return paymentList.filter((payment) => {
      const tenantName = `${payment.tenants?.first_name || ""} ${
        payment.tenants?.last_name || ""
      }`.trim();

      const unitNumber = payment.tenancies?.units?.unit_number || "";

      const receiptNumber = getReceiptNumber(payment, paymentList);

      const paymentType =
        payment.payment_type || payment.type || "Monthly Rent";

      const searchable = [
        receiptNumber,
        tenantName,
        unitNumber,
        payment.payment_method,
        paymentType,
        payment.notes,
        payment.amount,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [paymentList, search]);

  const openGenerateModal = (paymentId = "") => {
    setSelected(paymentId);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleGenerate = async () => {
    if (!selectedPayment) {
      toast.error("Please select a payment.");
      return;
    }

    await generateReceipt({
      payment: selectedPayment,
      payments: paymentList,
      properties: properties.data || [],
      toast,
    });

    setModalOpen(false);
  };

  return (
    <div className="receipts-page">
      
      {/* PAGE HEADER */}

      <div className="page-head receipts-page-head">
        <div>
          <h1>Receipts</h1>
          <p>Generate receipts and keep a permanent record.</p>
        </div>

        <div className="actions">
          <button
            className="primary receipts-generate-btn"
            onClick={() => openGenerateModal("")}
          >
            <PlusIcon />
            Generate receipt
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* SEARCH                                                           */}
      {/* ---------------------------------------------------------------- */}

      <section className="panel receipts-table-panel">
        <div className="receipts-search-row">
          <div className="search receipts-search">
            <SearchIcon />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search receipt, tenant, or unit..."
            />
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* RECEIPTS TABLE                                                    */}
        {/* ---------------------------------------------------------------- */}

        <div className="table-wrap">
          <table className="receipts-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Tenant</th>
                <th>Unit</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {payments.loading ? (
                <tr>
                  <td colSpan="8">
                    <div className="receipts-empty">Loading receipts...</div>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="receipts-empty">
                      <ReceiptEmptyIcon />
                      <strong>No receipts found</strong>
                      <span>Recorded payments will appear here.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const tenantName =
                    `${payment.tenants?.first_name || ""} ${
                      payment.tenants?.last_name || ""
                    }`.trim() || "—";

                  const unitNumber =
                    payment.tenancies?.units?.unit_number || "—";

                  const paymentType = formatPaymentType(
                    payment.payment_type || payment.type,
                  );

                  return (
                    <tr key={payment.id}>
                      {/* Receipt */}
                      <td>
                        <strong className="receipt-number">
                          {getReceiptNumber(payment, paymentList)}
                        </strong>
                      </td>

                      {/* Date */}
                      <td>{dateLabel(payment.payment_date)}</td>

                      {/* Tenant */}
                      <td>
                        <div className="receipt-tenant-cell">
                          <div className="receipt-avatar">
                            {getInitials(tenantName)}
                          </div>

                          <div>
                            <strong>{tenantName}</strong>
                          </div>
                        </div>
                      </td>

                      {/* Unit */}
                      <td>
                        <span className="receipt-unit">{unitNumber}</span>
                      </td>

                      {/* Amount */}
                      <td>
                        <strong className="receipt-amount">
                          {formatMoney(payment.amount)}
                        </strong>
                      </td>

                      {/* Method */}
                      <td>
                        <span className="receipt-method">
                          {formatPaymentMethod(payment.payment_method)}
                        </span>
                      </td>

                      {/* Type */}
                      <td>
                        <span className="receipt-type">{paymentType}</span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="receipt-row-actions">
                          <button
                            type="button"
                            className="receipt-view-btn"
                            title="View / generate receipt"
                            onClick={() => openGenerateModal(payment.id)}
                          >
                            <EyeIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* GENERATE RECEIPT MODAL                                           */}
      {/* ---------------------------------------------------------------- */}

      {modalOpen && (
        <div
          className="modal-backdrop receipts-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="modal receipts-modal">
            <div className="modal-head">
              <div>
                <h2>Generate receipt</h2>
                <p className="receipts-modal-subtitle">
                  Select a recorded payment to generate receipt.
                </p>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={closeModal}
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="modal-body">
              <div className="receipts-modal-form">
                <label>
                  Select payment
                  <select
                    value={selected}
                    onChange={(event) => setSelected(event.target.value)}
                  >
                    <option value="">Choose a payment...</option>

                    {paymentList.map((payment) => {
                      const tenantName =
                        `${payment.tenants?.first_name || ""} ${
                          payment.tenants?.last_name || ""
                        }`.trim();

                      return (
                        <option key={payment.id} value={payment.id}>
                          {dateLabel(payment.payment_date)} —{" "}
                          {tenantName || "Tenant"} —{" "}
                          {formatMoney(payment.amount)}
                        </option>
                      );
                    })}
                  </select>
                </label>

                {selectedPayment && (
                  <div className="receipt-preview-card">
                    <div className="receipt-preview-header">
                      <div className="receipt-preview-icon">
                        <ReceiptIcon />
                      </div>

                      <div>
                        <span>Receipt</span>
                        <strong>
                          {getReceiptNumber(selectedPayment, paymentList)}
                        </strong>
                      </div>
                    </div>

                    <div className="receipt-preview-grid">
                      <div>
                        <span>Tenant</span>
                        <strong>
                          {`${selectedPayment.tenants?.first_name || ""} ${
                            selectedPayment.tenants?.last_name || ""
                          }`.trim() || "—"}
                        </strong>
                      </div>

                      <div>
                        <span>Unit</span>
                        <strong>
                          {selectedPayment.tenancies?.units?.unit_number || "—"}
                        </strong>
                      </div>

                      <div>
                        <span>Date</span>
                        <strong>
                          {dateLabel(selectedPayment.payment_date)}
                        </strong>
                      </div>

                      <div>
                        <span>Amount</span>
                        <strong>{formatMoney(selectedPayment.amount)}</strong>
                      </div>

                      <div>
                        <span>Method</span>
                        <strong>
                          {formatPaymentMethod(selectedPayment.payment_method)}
                        </strong>
                      </div>

                      <div>
                        <span>Type</span>
                        <strong>
                          {formatPaymentType(
                            selectedPayment.payment_type || selectedPayment.type,
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-actions receipts-modal-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary"
                    disabled={!selectedPayment}
                    onClick={handleGenerate}
                  >
                    <PdfIcon />
                    Generate PDF receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* PDF GENERATION                                                             */
/* ========================================================================== */

async function generateReceipt({ payment, payments, properties, toast }) {
  try {
    const property = properties?.[0] || {};

    const tenantName =
      `${payment.tenants?.first_name || ""} ${payment.tenants?.last_name || ""}`
        .trim()
        .replace(/\s+/g, " ") || "—";

    const unitNumber = payment.tenancies?.units?.unit_number || "—";

    const billingMonth = payment.billing_records?.billing_month || "";

    const amountDue = Number(payment.billing_records?.amount_due || 0);

    const billingPayments = (payments || [])
      .filter(
        (item) =>
          payment.billing_record_id &&
          item.billing_record_id === payment.billing_record_id,
      )
      .sort((a, b) => {
        const date = String(a.payment_date || "").localeCompare(
          String(b.payment_date || ""),
        );

        if (date !== 0) return date;

        return String(a.created_at || "").localeCompare(
          String(b.created_at || ""),
        );
      });

    const selectedIndex = billingPayments.findIndex(
      (item) => item.id === payment.id,
    );

    const paidThroughPayment = billingPayments
      .slice(0, selectedIndex + 1)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const balance = Math.max(amountDue - paidThroughPayment, 0);

    const receiptNumber = getReceiptNumber(payment, payments);

    const remarks =
      String(payment.notes || "").trim() ||
      (billingMonth
        ? `Rent Payment (${formatBillingMonth(billingMonth)})`
        : "Rent Payment");

    const paymentMethod = normalizePaymentMethod(payment.payment_method);

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [RECEIPT_WIDTH, RECEIPT_HEIGHT],
      compress: true,
    });

    const fontBase64 = await loadFontBase64(unicodeFontUrl);
    doc.addFileToVFS("DejaVuSans.ttf", fontBase64);
    doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");

    const green = [111, 145, 119];
    const darkGreen = [86, 119, 94];
    const text = [45, 45, 45];
    const muted = [105, 105, 105];

    /* Outer border */
    doc.setDrawColor(...green);
    doc.setLineWidth(0.45);
    doc.rect(8, 8, RECEIPT_WIDTH - 16, RECEIPT_HEIGHT - 16);

    /* Header */
    doc.setFillColor(...green);
    doc.rect(14, 13, RECEIPT_WIDTH - 28, 18, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("RENT RECEIPT", RECEIPT_WIDTH / 2, 21, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.1);

    const header = property.address
      ? property.address
      : property.name || "Rental Property";

    doc.text(fitText(doc, header, 100), RECEIPT_WIDTH / 2, 27, {
      align: "center",
    });

    const leftX = 20;
    const rightX = 94;
    const valueOffset = 25;

    drawField(
      doc,
      "Date:",
      dateLabel(payment.payment_date),
      leftX,
      42,
      valueOffset,
      61,
      green,
      text,
    );

    drawField(
      doc,
      "Receipt No.:",
      receiptNumber,
      rightX,
      42,
      valueOffset,
      70,
      green,
      text,
    );

    drawField(
      doc,
      "Tenant Name:",
      tenantName,
      leftX,
      49,
      valueOffset,
      61,
      green,
      text,
    );

    drawField(
      doc,
      "Unit No.:",
      unitNumber,
      rightX,
      49,
      valueOffset,
      70,
      green,
      text,
    );

    drawField(
      doc,
      "Amount:",
      formatPdfMoney(payment.amount),
      leftX,
      56,
      valueOffset,
      61,
      green,
      text,
      true,
    );

    drawField(
      doc,
      "Balance:",
      formatPdfMoney(balance),
      rightX,
      56,
      valueOffset,
      70,
      green,
      text,
      true,
    );

    /* Payment method */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(...darkGreen);
    doc.text("Payment:", leftX, 65);

    drawCheckbox(doc, 47, 61, "Cash", paymentMethod === "cash", green, muted);

    drawCheckbox(
      doc,
      76,
      61,
      "G-Cash",
      paymentMethod === "gcash",
      green,
      muted,
    );

    drawCheckbox(
      doc,
      111,
      61,
      "Maribank",
      paymentMethod === "maribank",
      green,
      muted,
    );

    drawLongField(doc, "Remarks:", remarks, leftX, 73, 144, green, text);

    drawLongField(
      doc,
      "Received by:",
      "Erika Ferolino",
      leftX,
      81,
      144,
      green,
      text,
    );

    doc.setTextColor(...muted);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);

    const footer =
      "This official receipt confirms the acknowledgment of the payment stated above. For inquiries or maintenance concerns, please contact the landlord.";

    doc.text(fitText(doc, footer, 145), RECEIPT_WIDTH / 2, 91, {
      align: "center",
    });

    const safeTenant =
      tenantName.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "Tenant";

    const safeDate = String(payment.payment_date || "").replace(/-/g, "");

    doc.save(`Receipt_${safeDate}_${safeTenant}.pdf`);

    toast.success("Receipt PDF created.");
  } catch (error) {
    console.error(error);

    toast.error(error?.message || "Unable to generate receipt.");
  }
}

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

function getReceiptNumber(payment, payments = []) {
  const paymentDate = String(payment?.payment_date || "");
  const month = getPaymentMonth(payment);
  const paymentGroup = (payments || [])
    .filter((item) => {
      return (
        getPaymentMonth(item) === month &&
        getPaymentGroupKey(item) === getPaymentGroupKey(payment)
      );
    })
    .sort(comparePayments);

  const sequence = Math.max(
    paymentGroup.findIndex((item) => item.id === payment?.id) + 1,
    1,
  );

  const unitNumber = payment?.tenancies?.units?.unit_number || "-";

  return `RCPT-${formatReceiptMonth(paymentDate)}${unitNumber}-${sequence}`;
}

function getPaymentMonth(payment) {
  return String(
    payment?.payment_date || payment?.billing_records?.billing_month || "",
  ).slice(0, 7);
}

function getPaymentGroupKey(payment) {
  const tenancyId = payment?.tenancy_id || payment?.tenancies?.id;

  if (tenancyId) return `tenancy:${tenancyId}`;

  const tenantId = payment?.tenant_id || payment?.tenants?.id || "";
  const unitNumber = payment?.tenancies?.units?.unit_number || "";

  return `tenant:${tenantId}|unit:${unitNumber}`;
}

function comparePayments(first, second) {
  const date = String(first.payment_date || "").localeCompare(
    String(second.payment_date || ""),
  );

  if (date !== 0) return date;

  const created = String(first.created_at || "").localeCompare(
    String(second.created_at || ""),
  );

  if (created !== 0) return created;

  return String(first.id || "").localeCompare(String(second.id || ""));
}

function formatReceiptDate(value) {
  const date = String(value || "");

  if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
    return `${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}`;
  }

  return "000000";
}

function formatReceiptMonth(value) {
  const date = String(value || "");

  if (/^\d{4}-\d{2}/.test(date)) {
    return `${date.slice(2, 4)}${date.slice(5, 7)}`;
  }

  return "0000";
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "—";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatPaymentMethod(value) {
  const method = String(value || "Cash")
    .trim()
    .toLowerCase();

  if (method === "g-cash" || method === "gcash") {
    return "G-Cash";
  }

  if (
    ["bank transfer", "bank_transfer", "maribank", "maya", "other"].includes(
      method,
    )
  ) {
    return "Maribank";
  }

  return "Cash";
}

function formatPaymentType(value) {
  const type = String(value || "rent")
    .replace(/_/g, " ")
    .trim();

  if (!type) return "Rent";

  return type.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizePaymentMethod(value) {
  const method = String(value || "cash")
    .trim()
    .toLowerCase();

  if (method === "g-cash" || method === "gcash") return "gcash";
  if (
    ["bank transfer", "bank_transfer", "maribank", "maya", "other"].includes(
      method,
    )
  ) {
    return "maribank";
  }

  return "cash";
}

function formatMoney(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPdfMoney(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function loadFontBase64(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function formatBillingMonth(value) {
  const month = String(value || "").slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return value || "";
  }

  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function drawField(
  doc,
  label,
  value,
  x,
  y,
  valueOffset,
  lineEnd,
  green,
  text,
  currency = false,
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...green);
  doc.text(label, x, y);

  const valueX = x + valueOffset;
  const maxWidth = x + lineEnd - valueX - 2;

  doc.setFont(currency ? "DejaVuSans" : "helvetica", "normal");
  doc.setTextColor(...text);

  if (currency) {
    doc.text(fitText(doc, String(value || "₱0.00"), maxWidth), valueX, y);
  } else {
    doc.text(fitText(doc, String(value || "—"), maxWidth), valueX, y);
  }

  doc.setDrawColor(...green);
  doc.setLineWidth(0.22);

  doc.line(valueX, y + 1.8, x + lineEnd, y + 1.8);
}

function drawLongField(doc, label, value, x, y, lineEnd, green, text) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...green);
  doc.text(label, x, y);

  const valueX = x + 25;
  const maxWidth = x + lineEnd - valueX - 2;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...text);

  doc.text(fitText(doc, String(value || "—"), maxWidth), valueX, y);

  doc.setDrawColor(...green);
  doc.setLineWidth(0.22);

  doc.line(valueX, y + 1.8, x + lineEnd, y + 1.8);
}

function fitText(doc, value, maxWidth) {
  let result = String(value || "—");

  if (doc.getTextWidth(result) <= maxWidth) {
    return result;
  }

  while (result.length > 1 && doc.getTextWidth(`${result}…`) > maxWidth) {
    result = result.slice(0, -1);
  }

  return `${result}…`;
}

function drawCheckbox(doc, x, y, label, checked, green, muted) {
  doc.setDrawColor(...green);
  doc.setLineWidth(0.45);

  doc.rect(x, y, 3.4, 3.4);

  if (checked) {
    doc.setFillColor(...green);
    doc.rect(x, y, 3.4, 3.4, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);

    doc.text("✓", x + 0.55, y + 2.65);
  }

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  doc.text(label, x + 6, y + 2.65);
}

/* ========================================================================== */
/* ICONS                                                                      */
/* ========================================================================== */

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h2" />
      <path d="M8 17h6" />
    </svg>
  );
}

function ReceiptEmptyIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z" />
      <path d="M8 8h8" />
      <path d="M8 12h6" />
    </svg>
  );
}
