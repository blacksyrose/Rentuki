import { useState } from "react";
import jsPDF from "jspdf";
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
  const toast = useToast();

  const selectedPayment = (payments.data || []).find((payment) => payment.id === selected);

  const generateReceipt = () => {
    if (!selectedPayment) return;

    try {
      const property = properties.data?.[0] || {};
      const tenantName = `${selectedPayment.tenants?.first_name || ""} ${selectedPayment.tenants?.last_name || ""}`
        .trim()
        .replace(/\s+/g, " ") || "—";
      const unitNumber = selectedPayment.tenancies?.units?.unit_number || "—";
      const billingMonth = selectedPayment.billing_records?.billing_month || "";
      const amountDue = Number(selectedPayment.billing_records?.amount_due || 0);

      const billingPayments = (payments.data || [])
        .filter((payment) => payment.billing_record_id === selectedPayment.billing_record_id)
        .sort((a, b) => {
          const date = String(a.payment_date || "").localeCompare(String(b.payment_date || ""));
          if (date !== 0) return date;
          return String(a.created_at || "").localeCompare(String(b.created_at || ""));
        });

      const selectedIndex = billingPayments.findIndex((payment) => payment.id === selectedPayment.id);
      const paidThroughPayment = billingPayments
        .slice(0, selectedIndex + 1)
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const balance = Math.max(amountDue - paidThroughPayment, 0);

      const receiptNumber =
        selectedPayment.receipt_number ||
        `RCPT-${String(selectedPayment.payment_date || "").replace(/-/g, "")}-${String(selectedPayment.id || "").replace(/-/g, "").slice(-6)}`;

      const remarks =
        String(selectedPayment.notes || "").trim() ||
        (billingMonth ? `Rent Payment (${formatBillingMonth(billingMonth)})` : "Rent Payment");

      const paymentMethod = normalizePaymentMethod(selectedPayment.payment_method);

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [RECEIPT_WIDTH, RECEIPT_HEIGHT],
        compress: true,
      });

      const green = [111, 145, 119];
      const darkGreen = [86, 119, 94];
      const text = [45, 45, 45];
      const muted = [105, 105, 105];

      // Outer border.
      doc.setDrawColor(...green);
      doc.setLineWidth(0.45);
      doc.rect(8, 8, RECEIPT_WIDTH - 16, RECEIPT_HEIGHT - 16);

      // Header.
      doc.setFillColor(...green);
      doc.rect(14, 13, RECEIPT_WIDTH - 28, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("RENT RECEIPT", RECEIPT_WIDTH / 2, 21, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.1);
      const header = property.address
        ? `${property.address}`
        : property.name || "Rental Property";
      doc.text(fitText(doc, header, 100), RECEIPT_WIDTH / 2, 27, { align: "center" });

      // Fields are deliberately kept inside the border.
      const leftX = 20;
      const rightX = 94;
      const valueOffset = 25;

      drawField(doc, "Date:", dateLabel(selectedPayment.payment_date), leftX, 42, valueOffset, 61, green, text);
      drawField(doc, "Receipt No.:", receiptNumber, rightX, 42, valueOffset, 70, green, text);
      drawField(doc, "Tenant Name:", tenantName, leftX, 49, valueOffset, 61, green, text);
      drawField(doc, "Unit No.:", unitNumber, rightX, 49, valueOffset, 70, green, text);
      drawField(doc, "Amount:", formatMoney(selectedPayment.amount), leftX, 56, valueOffset, 61, green, text);
      drawField(doc, "Balance:", formatMoney(balance), rightX, 56, valueOffset, 70, green, text);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.setTextColor(...darkGreen);
      doc.text("Payment:", leftX, 65);

      drawCheckbox(doc, 47, 61, "Cash", paymentMethod === "cash", green, muted);
      drawCheckbox(doc, 76, 61, "G-Cash", paymentMethod === "gcash", green, muted);
      drawCheckbox(doc, 111, 61, "Maya / Bank", ["maya", "bank", "bank_transfer", "other"].includes(paymentMethod), green, muted);

      // The tenant-facing receipt intentionally uses Remarks/Notes only.
      drawLongField(doc, "Remarks:", remarks, leftX, 73, 168, green, text);
      drawLongField(doc, "Received by:", "Property Manager", leftX, 81, 168, green, text);

      doc.setTextColor(...muted);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(4.5);
      const footer = "This official receipt confirms the acknowledgment of the payment stated above. For inquiries or maintenance concerns, please contact the property manager.";
      doc.text(fitText(doc, footer, 145), RECEIPT_WIDTH / 2, 91, { align: "center" });

      const safeTenant = tenantName.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "Tenant";
      const safeDate = String(selectedPayment.payment_date || "").replace(/-/g, "");
      doc.save(`Receipt_${safeDate}_${safeTenant}.pdf`);
      toast.success("Receipt PDF created.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Unable to generate receipt.");
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Receipts</h1>
          <p>Generate printable PDF receipts from recorded payments.</p>
        </div>
      </div>

      <section className="panel receipt-tool">
        <label>
          Select payment
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Choose a payment…</option>
            {(payments.data || []).map((payment) => (
              <option key={payment.id} value={payment.id}>
                {dateLabel(payment.payment_date)} — {payment.tenants?.first_name} {payment.tenants?.last_name} — {formatMoney(payment.amount)}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" disabled={!selected} onClick={generateReceipt}>
          Generate PDF receipt
        </button>
      </section>

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Tenant</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {(payments.data || []).map((payment) => (
                <tr key={payment.id}>
                  <td>{dateLabel(payment.payment_date)}</td>
                  <td>{payment.tenants?.first_name} {payment.tenants?.last_name}</td>
                  <td><strong>{formatMoney(payment.amount)}</strong></td>
                  <td>{payment.payment_method}</td>
                  <td>{payment.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function normalizePaymentMethod(value) {
  const method = String(value || "cash").trim().toLowerCase();
  if (method === "g-cash") return "gcash";
  if (method === "bank transfer") return "bank_transfer";
  return method;
}

function formatMoney(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBillingMonth(value) {
  const month = String(value || "").slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return value || "";

  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function drawField(doc, label, value, x, y, valueOffset, lineEnd, green, text) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...green);
  doc.text(label, x, y);

  const valueX = x + valueOffset;
  const maxWidth = x + lineEnd - valueX - 2;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...text);
  doc.text(fitText(doc, String(value || "—"), maxWidth), valueX, y);

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
  if (doc.getTextWidth(result) <= maxWidth) return result;

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
