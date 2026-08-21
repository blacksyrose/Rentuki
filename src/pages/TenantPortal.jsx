import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  ClipboardPaste,
  CircleDollarSign,
  Clock3,
  Download,
  KeyRound,
  LogOut,
  ReceiptText,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import jsPDF from "jspdf";
import unicodeFontUrl from "dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url";
import { db } from "../services/db";
import { currentMonth, dateLabel, money } from "../lib/utils";

const STORAGE_KEY = "rentuki_tenant_portal_key";

const previewSummary = {
  property_name: "Rental Management System",
  property_address:
    "13 B Saging St. Talanay, Batasan Hills, Quezon City, Metro Manila, Philippines, 1126",
  tenant: {
    first_name: "Erika",
    last_name: "Ferolino",
  },
  current_tenancy: {
    unit_number: "204",
    monthly_rent: 15000,
    payment_due_day: 5,
    start_date: "2026-01-05",
  },
  billing: {
    amount_due: 15000,
    status: "due",
    payments_total: 0,
  },
  payments: [
    {
      id: "preview-payment-1",
      payment_date: "2026-07-05",
      amount: 15000,
      payment_method: "GCash",
      payment_type: "rent",
      billing_month: "2026-07-01",
      unit_number: "204",
    },
  ],
  unit_history: [
    {
      id: "preview-tenancy-1",
      unit_number: "204",
      start_date: "2026-01-05",
      monthly_rent: 15000,
      status: "active",
    },
  ],
  maintenance: [],
  expenses: [],
};

function monthLabel(value) {
  const date = new Date(`${value}-01T00:00:00`);
  return date.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function hasObjectData(value) {
  return value && typeof value === "object" && Object.keys(value).length > 0;
}

function formatPaymentMethod(value) {
  const method = String(value || "")
    .trim()
    .toLowerCase();

  if (method === "gcash" || method === "g-cash") return "G-Cash";

  if (
    ["maribank", "bank transfer", "bank_transfer", "maya", "other"].includes(
      method,
    )
  ) {
    return "Maribank";
  }

  if (method === "cash") return "Cash";

  return value ? String(value) : "—";
}

function paymentMethodClass(value) {
  const method = String(value || "")
    .trim()
    .toLowerCase();

  if (method === "gcash" || method === "g-cash") return "gcash";

  if (
    ["maribank", "bank transfer", "bank_transfer", "maya", "other"].includes(
      method,
    )
  ) {
    return "maribank";
  }

  if (method === "cash") return "cash";

  return "other";
}

function formatPaymentType(value) {
  const type = String(value || "rent")
    .replace(/_/g, " ")
    .trim();

  return type
    ? type.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Rent";
}

function paymentTypeClass(value) {
  const type = String(value || "rent")
    .trim()
    .toLowerCase();

  if (type === "deposit") return "deposit";
  if (type === "advance") return "advance";
  if (type === "rent") return "rent";

  return "other";
}

function getDueDateForCurrentMonth(day) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const requestedDay = Number(day);

  if (!Number.isFinite(requestedDay) || requestedDay < 1) return null;

  const lastDay = new Date(year, month + 1, 0).getDate();

  return new Date(year, month, Math.min(requestedDay, lastDay));
}

function getCurrentPaymentStatus({ balance, amountDue, billing, tenancy }) {
  if (amountDue <= 0 || balance <= 0) {
    return amountDue > 0 ? "Paid" : "Due";
  }

  const dueDate = getDueDateForCurrentMonth(tenancy?.payment_due_day);

  if (dueDate) {
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    if (today > dueDate) return "Overdue";
  }

  if (billing?.status) {
    const normalized = String(billing.status)
      .replaceAll("_", " ")
      .toLowerCase();

    if (normalized === "overdue") return "Overdue";
  }

  return "Due";
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

function getTenantPaymentMonth(payment) {
  return String(
    payment?.payment_date ||
      payment?.billing_records?.billing_month ||
      payment?.billing_month ||
      "",
  ).slice(0, 7);
}

function getTenantPaymentGroupKey(payment) {
  const tenancyId = payment?.tenancy_id || payment?.tenancies?.id;

  if (tenancyId) return `tenancy:${tenancyId}`;

  const tenantId = payment?.tenant_id || payment?.tenants?.id || "";

  const unitNumber =
    payment?.unit_number || payment?.tenancies?.units?.unit_number || "";

  return `tenant:${tenantId}|unit:${unitNumber}`;
}

function compareTenantPayments(first, second) {
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

function getTenantReceiptNumber(payment, payments = []) {
  const month = getTenantPaymentMonth(payment);

  const paymentGroup = (payments || [])
    .filter(
      (item) =>
        getTenantPaymentMonth(item) === month &&
        getTenantPaymentGroupKey(item) === getTenantPaymentGroupKey(payment),
    )
    .sort(compareTenantPayments);

  const sequence = Math.max(
    paymentGroup.findIndex((item) => item.id === payment?.id) + 1,
    1,
  );

  const unitNumber =
    payment?.unit_number || payment?.tenancies?.units?.unit_number || "-";

  return `RCPT-${formatReceiptMonth(month)}${unitNumber}-${sequence}`;
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

function fitReceiptText(doc, value, maxWidth) {
  let result = String(value || "—");

  if (doc.getTextWidth(result) <= maxWidth) {
    return result;
  }

  while (result.length > 1 && doc.getTextWidth(`${result}…`) > maxWidth) {
    result = result.slice(0, -1);
  }

  return `${result}…`;
}

function drawReceiptField(
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

  doc.text(
    fitReceiptText(
      doc,
      currency ? String(value || "₱0.00") : String(value || "—"),
      maxWidth,
    ),
    valueX,
    y,
  );

  doc.setDrawColor(...green);
  doc.setLineWidth(0.22);
  doc.line(valueX, y + 1.8, x + lineEnd, y + 1.8);
}

function drawReceiptLongField(doc, label, value, x, y, lineEnd, green, text) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...green);
  doc.text(label, x, y);

  const valueX = x + 25;
  const maxWidth = x + lineEnd - valueX - 2;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...text);

  doc.text(fitReceiptText(doc, String(value || "—"), maxWidth), valueX, y);

  doc.setDrawColor(...green);
  doc.setLineWidth(0.22);
  doc.line(valueX, y + 1.8, x + lineEnd, y + 1.8);
}

function drawReceiptCheckbox(doc, x, y, label, checked, green, muted) {
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
/*
 * This intentionally mirrors the PDF layout used by the admin Receipts page.
 * The tenant portal only supplies the selected tenant/payment data.
 */
async function downloadTenantReceipt(
  payment,
  tenant,
  propertyHeader,
  payments,
) {
  try {
    const tenantName =
      `${tenant?.first_name || ""} ${tenant?.last_name || ""}`
        .trim()
        .replace(/\s+/g, " ") || "—";

    const unitNumber =
      payment?.unit_number || payment?.tenancies?.units?.unit_number || "—";

    const billingMonth =
      payment?.billing_records?.billing_month || payment?.billing_month || "";

    const isRent =
      String(payment?.payment_type || payment?.type || "rent").toLowerCase() ===
      "rent";

    const billingPayments = (payments || [])
      .filter(
        (item) =>
          isRent &&
          payment?.billing_record_id &&
          item.billing_record_id === payment.billing_record_id,
      )
      .sort(compareTenantPayments);

    const selectedIndex = billingPayments.findIndex(
      (item) => item.id === payment.id,
    );

    const amountDue = Number(
      payment?.billing_records?.amount_due || payment?.amount_due || 0,
    );

    const paidThroughPayment =
      selectedIndex >= 0
        ? billingPayments
            .slice(0, selectedIndex + 1)
            .reduce((sum, item) => sum + Number(item.amount || 0), 0)
        : Number(payment.amount || 0);

    const balance = isRent ? Math.max(amountDue - paidThroughPayment, 0) : 0;

    const receiptNumber = getTenantReceiptNumber(payment, payments);

    const remarks =
      String(payment?.notes || "").trim() ||
      (billingMonth
        ? `Rent Payment (${monthLabel(String(billingMonth).slice(0, 7))})`
        : `${formatPaymentType(
            payment?.payment_type || payment?.type,
          )} Payment`);

    const paymentMethod = paymentMethodClass(payment?.payment_method);

    /*
     * Use the SAME property source as the Admin > Receipts page.
     *
     * Admin Receipts does:
     *   const property = properties?.[0] || {};
     *   const header = property.address
     *     ? property.address
     *     : property.name || "Rental Property";
     *
     * The tenant summary RPC does not always include property_address,
     * which is why relying only on portalSummary.property_address can
     * result in "Property address not recorded".
     */
    let property = {};

    try {
      const propertyList = await db.properties.list();
      property = propertyList?.[0] || {};
    } catch (propertyError) {
      console.warn(
        "Unable to load property information for tenant receipt:",
        propertyError,
      );
    }

    const header =
      property?.address ||
      property?.property_address ||
      propertyHeader ||
      property?.name ||
      "Rental Property";

    // Exact receipt dimensions used by Admin > Receipts.
    const RECEIPT_WIDTH = 180;
    const RECEIPT_HEIGHT = 105;

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [RECEIPT_WIDTH, RECEIPT_HEIGHT],
      compress: true,
    });

    const fontBase64 = await loadFontBase64(unicodeFontUrl);

    doc.addFileToVFS("DejaVuSans.ttf", fontBase64);
    doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");

    // Exact colors used by Admin > Receipts.
    const green = [111, 145, 119];
    const darkGreen = [86, 119, 94];
    const text = [45, 45, 45];
    const muted = [105, 105, 105];

    /* Outer border — same as Admin Receipts */
    doc.setDrawColor(...green);
    doc.setLineWidth(0.45);
    doc.rect(8, 8, RECEIPT_WIDTH - 16, RECEIPT_HEIGHT - 16);

    /* Header — same position, size, and spacing as Admin Receipts */
    doc.setFillColor(...green);
    doc.rect(14, 13, RECEIPT_WIDTH - 28, 18, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);

    doc.text("RENT RECEIPT", RECEIPT_WIDTH / 2, 21, {
      align: "center",
    });

    /*
     * IMPORTANT:
     * This intentionally uses property.address first, exactly like
     * the Admin Receipts PDF. The property name is only a fallback.
     */
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.1);

    doc.text(fitReceiptText(doc, header, 100), RECEIPT_WIDTH / 2, 27, {
      align: "center",
    });

    const leftX = 20;
    const rightX = 94;
    const valueOffset = 25;

    drawReceiptField(
      doc,
      "Date:",
      payment?.payment_date
        ? dateLabel(payment.payment_date)
        : "Date not recorded",
      leftX,
      42,
      valueOffset,
      61,
      green,
      text,
    );

    drawReceiptField(
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

    drawReceiptField(
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

    drawReceiptField(
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

    drawReceiptField(
      doc,
      "Amount:",
      money(payment?.amount),
      leftX,
      56,
      valueOffset,
      61,
      green,
      text,
      true,
    );

    drawReceiptField(
      doc,
      "Balance:",
      isRent ? money(balance) : "—",
      rightX,
      56,
      valueOffset,
      70,
      green,
      text,
      isRent,
    );

    /* Payment method — exact Admin Receipts positions */
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.setTextColor(...darkGreen);

    doc.text("Payment:", leftX, 65);

    drawReceiptCheckbox(
      doc,
      47,
      61,
      "Cash",
      paymentMethod === "cash",
      green,
      muted,
    );

    drawReceiptCheckbox(
      doc,
      76,
      61,
      "G-Cash",
      paymentMethod === "gcash",
      green,
      muted,
    );

    drawReceiptCheckbox(
      doc,
      111,
      61,
      "Maribank",
      paymentMethod === "maribank",
      green,
      muted,
    );

    drawReceiptLongField(doc, "Remarks:", remarks, leftX, 73, 144, green, text);

    drawReceiptLongField(
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

    doc.text(fitReceiptText(doc, footer, 145), RECEIPT_WIDTH / 2, 91, {
      align: "center",
    });

    const safeTenant =
      tenantName.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "Tenant";

    const safeDate = formatReceiptDate(
      payment?.payment_date || payment?.billing_records?.billing_month,
    );

    doc.save(`Receipt_${safeDate}_${safeTenant}.pdf`);
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export default function TenantPortal() {
  const isPreview =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("preview") === "1";

  const [accessKey, setAccessKey] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const [keyInput, setKeyInput] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(Boolean(accessKey));
  const [error, setError] = useState("");

  const loadSummary = async (key) => {
    const normalized = normalizeKey(key);

    if (!normalized) {
      setSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Load the current month first. This also gives us the tenant's
      // complete unit history, which lets us determine how far back
      // to retrieve payment records.
      const currentData = await db.tenantPortal.summary(
        normalized,
        currentMonth(),
      );

      const unitHistory = Array.isArray(currentData?.unit_history)
        ? currentData.unit_history
        : [];

      const earliestStart = unitHistory
        .map((item) => String(item.start_date || "").slice(0, 7))
        .filter(Boolean)
        .sort()[0];

      const startMonth = earliestStart || currentMonth();

      const months = [];

      const cursor = new Date(`${startMonth}-01T00:00:00`);

      const end = new Date(`${currentMonth()}-01T00:00:00`);

      while (cursor <= end) {
        months.push(
          `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(
            2,
            "0",
          )}`,
        );

        cursor.setMonth(cursor.getMonth() + 1);
      }

      // Retrieve each historical month through the same protected RPC.
      // The access key is still validated server-side for every request.
      const historicalData = await Promise.all(
        months
          .filter((selectedMonth) => selectedMonth !== currentMonth())
          .map((selectedMonth) =>
            db.tenantPortal.summary(normalized, selectedMonth),
          ),
      );

      const allPayments = [
        ...(currentData?.payments || []),
        ...historicalData.flatMap((data) => data?.payments || []),
      ];

      const uniquePayments = Array.from(
        new Map(
          allPayments.map((payment, index) => [
            payment.id || `${payment.payment_date}-${payment.amount}-${index}`,
            payment,
          ]),
        ).values(),
      ).sort((a, b) => {
        const dateCompare = String(b.payment_date || "").localeCompare(
          String(a.payment_date || ""),
        );

        if (dateCompare !== 0) return dateCompare;

        return String(b.created_at || "").localeCompare(
          String(a.created_at || ""),
        );
      });

      setSummary({
        ...currentData,
        payments: uniquePayments,
      });

      setAccessKey(normalized);

      try {
        sessionStorage.setItem(STORAGE_KEY, normalized);
      } catch {
        // Ignore storage failures.
      }
    } catch (e) {
      setSummary(null);
      setError(e.message || "Unable to load your rental summary.");

      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage failures.
      }

      setAccessKey("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isPreview) return;

    if (!accessKey) {
      setLoading(false);
      return;
    }

    loadSummary(accessKey);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessKey, isPreview]);

  const signOut = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }

    setAccessKey("");
    setSummary(null);
    setKeyInput("");
    setError("");
  };

  const submit = (event) => {
    event.preventDefault();

    const normalized = normalizeKey(keyInput);

    if (!normalized) {
      setError("Please enter your access key.");
      return;
    }

    setLoading(true);
    setAccessKey(normalized);
  };

  const portalSummary = isPreview ? previewSummary : summary;

  const tenant = portalSummary?.tenant || {};

  const tenancy = hasObjectData(portalSummary?.current_tenancy)
    ? portalSummary.current_tenancy
    : null;

  const billing = hasObjectData(portalSummary?.billing)
    ? portalSummary.billing
    : null;

  const payments = useMemo(() => {
    const sources = [
      ...(Array.isArray(portalSummary?.payments) ? portalSummary.payments : []),

      ...(Array.isArray(portalSummary?.other_payments)
        ? portalSummary.other_payments
        : []),

      ...(Array.isArray(portalSummary?.standalone_payments)
        ? portalSummary.standalone_payments
        : []),
    ];

    return Array.from(
      new Map(
        sources.map((payment, index) => [
          payment.id ||
            `${payment.payment_date}-${payment.amount}-${payment.payment_type || payment.type || "rent"}-${index}`,
          payment,
        ]),
      ).values(),
    );
  }, [
    portalSummary?.payments,
    portalSummary?.other_payments,
    portalSummary?.standalone_payments,
  ]);

  const history = Array.isArray(portalSummary?.unit_history)
    ? portalSummary.unit_history
    : [];

  const maintenanceSource = Array.isArray(portalSummary?.maintenance)
    ? portalSummary.maintenance
    : Array.isArray(portalSummary?.maintenance_requests)
      ? portalSummary.maintenance_requests
      : [];

  const expensesSource = Array.isArray(portalSummary?.expenses)
    ? portalSummary.expenses
    : [];

  const maintenance = maintenanceSource.filter((item) => {
    const itemTenantId = item.tenant_id || item.tenants?.id;

    const itemTenancyId = item.tenancy_id || item.tenancies?.id;

    const itemUnitNumber = item.unit_number || item.units?.unit_number;

    if (itemTenantId || itemTenancyId || itemUnitNumber) {
      return (
        (!itemTenantId || itemTenantId === tenant?.id) &&
        (!itemTenancyId || itemTenancyId === tenancy?.id) &&
        (!itemUnitNumber ||
          !tenancy?.unit_number ||
          String(itemUnitNumber) === String(tenancy.unit_number))
      );
    }

    return true;
  });

  const expenses = expensesSource.filter((item) => {
    const itemTenantId = item.tenant_id || item.tenants?.id;

    const itemTenancyId = item.tenancy_id || item.tenancies?.id;

    const itemUnitNumber = item.unit_number || item.units?.unit_number;

    if (itemTenantId || itemTenancyId || itemUnitNumber) {
      return (
        (!itemTenantId || itemTenantId === tenant?.id) &&
        (!itemTenancyId || itemTenancyId === tenancy?.id) &&
        (!itemUnitNumber ||
          !tenancy?.unit_number ||
          String(itemUnitNumber) === String(tenancy.unit_number))
      );
    }

    return true;
  });

  const paid = useMemo(
    () =>
      payments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0,
      ),
    [payments],
  );

  const amountDue = Number(billing?.amount_due || 0);

  const balance = Math.max(
    amountDue -
      Number(
        portalSummary?.billing?.payments_total ??
          portalSummary?.billing?.paid ??
          0,
      ),
    0,
  );

  const paymentRows = useMemo(
    () =>
      payments.slice().sort((a, b) => {
        const dateCompare = String(b.payment_date || "").localeCompare(
          String(a.payment_date || ""),
        );

        if (dateCompare !== 0) return dateCompare;

        return String(b.created_at || "").localeCompare(
          String(a.created_at || ""),
        );
      }),
    [payments],
  );

  const status = getCurrentPaymentStatus({
    balance,
    amountDue,
    billing,
    tenancy,
  });

  if (!isPreview && (!accessKey || !summary)) {
    return (
      <div className="portal-page portal-login-page">
        <div className="portal-login-shell">
          <section className="portal-login-card portal-login-card-simple">
            <div className="portal-login-heading">
              <div className="portal-login-icon">
                <ShieldCheck size={28} />
              </div>

              <span className="portal-login-title">Rental Summary</span>

              <p className="portal-login-subtitle">Private tenant access</p>
            </div>

            <div className="portal-login-info">
              <ShieldCheck size={15} />

              <span>
                Enter the private access key provided by your property
                administrator.
              </span>
            </div>

            <form onSubmit={submit} className="portal-form">
              <label>
                Access key
                <div className="portal-input-wrap">
                  <KeyRound size={18} />

                  <input
                    autoFocus
                    value={keyInput}
                    onChange={(event) => {
                      setKeyInput(event.target.value.toUpperCase());
                      setError("");
                    }}
                    placeholder="TENANT-XXXX-XXXX"
                    autoComplete="off"
                    spellCheck="false"
                  />

                  <button
                    type="button"
                    className="portal-paste-button"
                    aria-label="Paste access key"
                    title="Paste access key"
                    onClick={async () => {
                      try {
                        const pasted = await navigator.clipboard.readText();

                        setKeyInput(pasted.toUpperCase());

                        setError("");
                      } catch {
                        setError(
                          "Clipboard access is unavailable. Please paste the key manually.",
                        );
                      }
                    }}
                  >
                    <ClipboardPaste size={17} />
                  </button>
                </div>
              </label>

              {error && <div className="portal-error">{error}</div>}

              <button
                className="portal-primary"
                type="submit"
                disabled={loading}
              >
                {loading ? "Checking key…" : "Access Portal"}
              </button>
            </form>

            <p className="portal-private-note">
              🔒 Your access key is private and should not be shared.
            </p>
          </section>
        </div>
      </div>
    );
  }

  const firstName = tenant.first_name || tenant.full_name || "Tenant";

  const propertyName = portalSummary.property_name || "Rentuki";

  const propertyHeader = portalSummary.property_address || propertyName;

  return (
    <div className="portal-page portal-dashboard-page">
      <header className="portal-topbar">
        <div className="portal-topbar-inner">
          <div className="portal-brand">
            <div className="portal-brand-mark">
              <Building2 size={21} />
            </div>

            <div>
              <strong>{propertyName}</strong>
              <span>Tenant Portal</span>
            </div>
          </div>

          <div className="portal-topbar-actions">
            <button className="portal-signout" onClick={signOut}>
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="portal-content portal-content-simple">
        <section className="portal-hero portal-hero-simple">
          <div className="portal-welcome">
            <span>Welcome back</span>

            <strong>{firstName}</strong>
          </div>

          <div>
            <span>Current unit</span>

            <Building2 size={17} />

            <strong>
              {tenancy?.unit_number
                ? `Unit ${tenancy.unit_number}`
                : "No active unit"}
            </strong>

            <small>
              {tenancy?.start_date
                ? `Since ${dateLabel(tenancy.start_date)}`
                : "Rental history remains available below"}
            </small>
          </div>

          <div>
            <span>Monthly rent</span>

            <CircleDollarSign size={17} />

            <strong>{money(tenancy?.monthly_rent || 0)}</strong>

            <small>
              {tenancy?.payment_due_day
                ? `Due every ${tenancy.payment_due_day}`
                : "No active tenancy"}
            </small>
          </div>

          <div>
            <span>Current balance</span>

            <CircleDollarSign size={17} />

            <strong>{money(balance)}</strong>

            <small
              className={`portal-balance-status ${status
                .toLowerCase()
                .replaceAll(" ", "-")}`}
            >
              <span /> {status}
            </small>
          </div>
        </section>

        <section className="portal-overview-stats">
          <div className="portal-overview-stat">
            <span>Total payments</span>

            <strong>{payments.length}</strong>

            <small>All recorded transactions</small>
          </div>

          <div className="portal-overview-stat">
            <span>Total paid</span>

            <strong>{money(paid)}</strong>

            <small>Across your rental history</small>
          </div>

          <div className="portal-overview-stat">
            <span>Current amount due</span>

            <strong>{money(balance)}</strong>

            <small>{status}</small>
          </div>
        </section>

        <div className="portal-summary-disclaimer">
          <strong>Summary notice:</strong> Records in this portal may be
          incomplete or inaccurate due to unrecorded transactions. Please
          contact your landlord if you notice any discrepancies.
        </div>

        {error && (
          <div className="portal-error portal-dashboard-error">{error}</div>
        )}

        <section className="portal-card portal-payments-card portal-payments-simple">
          <div className="portal-card-head">
            <div className="portal-card-icon">
              <ReceiptText size={18} />
            </div>

            <div>
              <h2>Payment history</h2>

              <p>
                All recorded transactions, payment types, methods, and receipts.
              </p>
            </div>
          </div>

          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Date</th>

                  <th>Rent period</th>

                  <th>Unit</th>

                  <th>Paid</th>

                  <th>Method</th>

                  <th>Type</th>

                  <th>Receipt</th>
                </tr>
              </thead>

              <tbody>
                {paymentRows.map((payment) => (
                  <tr key={payment.id}>
                    <td>{dateLabel(payment.payment_date)}</td>

                    <td>
                      {payment.billing_month
                        ? monthLabel(String(payment.billing_month).slice(0, 7))
                        : "—"}
                    </td>

                    <td>
                      {payment.unit_number
                        ? `Unit ${payment.unit_number}`
                        : "—"}
                    </td>

                    <td>
                      <strong>{money(payment.amount)}</strong>
                    </td>

                    <td>
                      <span
                        className={`portal-payment-pill method ${paymentMethodClass(
                          payment.payment_method,
                        )}`}
                      >
                        {formatPaymentMethod(payment.payment_method)}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`portal-payment-pill type ${paymentTypeClass(
                          payment.payment_type || payment.type,
                        )}`}
                      >
                        {formatPaymentType(
                          payment.payment_type || payment.type,
                        )}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className="portal-download-receipt"
                        title="Download receipt"
                        aria-label={`Download receipt for ${
                          payment.payment_type || payment.type || "payment"
                        }`}
                        onClick={() =>
                          downloadTenantReceipt(
                            payment,
                            tenant,
                            propertyHeader,
                            payments,
                          )
                        }
                      >
                        <Download size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!payments.length && (
            <div className="portal-empty">
              <Clock3 size={20} />

              <strong>No payments recorded</strong>

              <span>Your complete payment history will appear here.</span>
            </div>
          )}
        </section>

        {(maintenance.length > 0 || expenses.length > 0) && (
          <section className="portal-card portal-activity-card">
            <div className="portal-card-head">
              <div className="portal-card-icon soft-blue">
                <Wrench size={18} />
              </div>

              <div>
                <h2>Maintenance & expenses</h2>

                <p>
                  Records related to your tenancy that are available in the
                  system.
                </p>
              </div>
            </div>

            <div className="portal-activity-grid">
              {maintenance.length > 0 && (
                <div className="portal-activity-column">
                  <h3>Maintenance</h3>

                  <div className="portal-activity-list">
                    {maintenance.map((item) => (
                      <div className="portal-activity-item" key={item.id}>
                        <div>
                          <strong>
                            {item.title ||
                              item.issue ||
                              item.description ||
                              "Maintenance request"}
                          </strong>

                          <span>
                            {item.reported_date
                              ? dateLabel(item.reported_date)
                              : "Date not recorded"}

                            {item.units?.unit_number || item.unit_number
                              ? ` · Unit ${
                                  item.units?.unit_number || item.unit_number
                                }`
                              : ""}
                          </span>
                        </div>

                        <span className="portal-activity-status">
                          {item.status || "Recorded"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {expenses.length > 0 && (
                <div className="portal-activity-column">
                  <h3>Expenses</h3>

                  <div className="portal-activity-list">
                    {expenses.map((item) => (
                      <div className="portal-activity-item" key={item.id}>
                        <div>
                          <strong>
                            {item.description ||
                              item.category ||
                              item.name ||
                              "Expense"}
                          </strong>

                          <span>
                            {item.expense_date
                              ? dateLabel(item.expense_date)
                              : "Date not recorded"}

                            {item.units?.unit_number || item.unit_number
                              ? ` · Unit ${
                                  item.units?.unit_number || item.unit_number
                                }`
                              : ""}
                          </span>
                        </div>

                        <strong className="portal-expense-amount">
                          {money(item.amount)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="portal-card portal-history-card">
          <div className="portal-card-head">
            <div className="portal-card-icon soft-purple">
              <Building2 size={18} />
            </div>

            <div>
              <h2>Unit history</h2>

              <p>
                Previous rental assignments remain available for your records.
              </p>
            </div>
          </div>

          <div className="portal-history-list">
            {history.map((item) => (
              <div className="portal-history-item" key={item.id}>
                <div>
                  <strong>Unit {item.unit_number}</strong>

                  <span>
                    {dateLabel(item.start_date)} —{" "}
                    {item.end_date ? dateLabel(item.end_date) : "Present"}
                  </span>
                </div>

                <div className="portal-history-rent">
                  <strong>{money(item.monthly_rent)}</strong>

                  <span>{item.status}</span>
                </div>
              </div>
            ))}
          </div>

          {!history.length && (
            <div className="portal-empty">
              <Building2 size={20} />

              <strong>No rental history yet</strong>

              <span>Your unit assignments will appear here.</span>
            </div>
          )}
        </section>

        <footer className="portal-support-note">
          <strong>
            For payment concerns, maintenance requests, or account questions,
            contact your landlord.
          </strong>
        </footer>
      </main>
    </div>
  );
}
