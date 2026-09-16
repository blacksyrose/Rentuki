import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardPaste,
  Clock3,
  Copy,
  Download,
  Eye,
  FileText,
  HelpCircle,
  Home,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  QrCode,
  ReceiptText,
  Share2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import jsPDF from "jspdf";
import unicodeFontUrl from "dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url";
import { db } from "../services/db";
import { currentMonth, dateLabel, money } from "../lib/utils";

const STORAGE_KEY = "rentuki_tenant_portal_key";

const previewSummary = {
  tenant: {
    id: "preview-tenant",
    first_name: "Irish",
    last_name: "Jane",
    phone: "+63 912 345 6789",
    email: "irishjane@gmail.com",
    status: "active",
  },
  property_name: "Rental Apartment",
  property_address: "Preview mode",
  current_tenancy: {
    id: "preview-tenancy",
    unit_number: "9",
    start_date: "2026-07-08",
    monthly_rent: 4000,
    payment_due_day: 8,
    status: "active",
  },
  billing: {
    billing_month: currentMonth(),
    amount_due: 4000,
    paid_amount: 4000,
    balance: 0,
    status: "paid",
  },
  billing_history: [
    {
      id: "preview-billing",
      tenancy_id: "preview-tenancy",
      billing_month: currentMonth(),
      due_date: `${currentMonth()}-08`,
      amount_due: 4000,
      paid_amount: 4000,
      balance: 0,
      status: "paid",
      unit_number: "9",
      monthly_rent: 4000,
      payment_due_day: 8,
      latest_payment_date: `${currentMonth()}-08`,
      payment_methods: ["GCash"],
    },
  ],
  payments: [],
  unit_history: [
    {
      id: "preview-history",
      unit_number: "9",
      monthly_rent: 4000,
      start_date: "2026-07-08",
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
  if (amountDue <= 0 || balance <= 0) return amountDue > 0 ? "Paid" : "Due";

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

function getBillingRecordStatus(record, paidOverride = null) {
  const amountDue = Number(record?.amount_due || 0);
  const paid =
    paidOverride !== null
      ? Number(paidOverride || 0)
      : Number(record?.payments_total || 0);
  const balance = Math.max(amountDue - paid, 0);

  if (record?.status === "waived") return "Waived";
  if (amountDue > 0 && balance <= 0) return "Paid";
  if (paid > 0) return "Partially Paid";

  const dueDate = String(record?.due_date || "");
  const today = new Date().toISOString().slice(0, 10);
  const billingMonth = String(record?.billing_month || "").slice(0, 7);

  if (billingMonth > currentMonth()) return "Upcoming";
  if (dueDate && dueDate < today) return "Overdue";
  if (dueDate === today) return "Due";
  return "Upcoming";
}

function billingStatusClass(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-");
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
      payment?.created_at ||
      "",
  ).slice(0, 7);
}

function getTenantUnitCode(payment) {
  const rawUnit =
    payment?.unit_number ||
    payment?.tenancies?.units?.unit_number ||
    "";

  const digits = String(rawUnit).replace(/[^0-9]/g, "");
  const unitNumber = digits.match(/[0-9]+$/)?.[0] || "00";

  return unitNumber.padStart(2, "0");
}

function getTenantPaymentGroupKey(payment) {
  return `unit:${getTenantUnitCode(payment)}`;
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
  if (payment?.receipt_number) return payment.receipt_number;

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

  const unitNumber = getTenantUnitCode(payment);

  return `${formatReceiptMonth(month)}${unitNumber}-${sequence}`;
}

function getTenantReceiptFileName(payment, tenant) {
  const receiptNumber = getTenantReceiptNumber(payment);
  const name = tenant?.last_name || tenant?.first_name || "Tenant";
  const safeName = String(name).replace(/[^a-z0-9]/gi, "") || "Tenant";

  return `${receiptNumber}_${safeName}`;
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

async function downloadTenantReceipt(
  payment,
  tenant,
  propertyHeader,
  payments,
  standaloneExpectedAmount = 0,
  previewWindow = null,
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

    const paymentType = String(
      payment?.payment_type || payment?.type || "rent",
    )
      .trim()
      .toLowerCase();
    const standalonePayments = (payments || [])
      .filter(
        (item) =>
          !isRent &&
          item.tenancy_id === payment.tenancy_id &&
          String(item?.payment_type || item?.type || "rent")
            .trim()
            .toLowerCase() === paymentType,
      )
      .sort(compareTenantPayments);
    const standalonePaymentIndex = standalonePayments.findIndex(
      (item) => item.id === payment.id,
    );
    const standalonePaidThroughPayment =
      standalonePaymentIndex >= 0
        ? standalonePayments
            .slice(0, standalonePaymentIndex + 1)
            .reduce((sum, item) => sum + Number(item.amount || 0), 0)
        : Number(payment.amount || 0);
    const balance = isRent
      ? Math.max(amountDue - paidThroughPayment, 0)
      : Math.max(
          Number(standaloneExpectedAmount || 0) - standalonePaidThroughPayment,
          0,
        );

    const receiptNumber = getTenantReceiptNumber(payment, payments);

    const remarks =
      String(payment?.notes || "").trim() ||
      (billingMonth
        ? `Rent Payment (${monthLabel(String(billingMonth).slice(0, 7))})`
        : `${formatPaymentType(
            payment?.payment_type || payment?.type,
          )} Payment`);

    const paymentMethod = paymentMethodClass(payment?.payment_method);

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

    const green = [111, 145, 119];
    const darkGreen = [86, 119, 94];
    const text = [45, 45, 45];
    const muted = [105, 105, 105];

    doc.setDrawColor(...green);
    doc.setLineWidth(0.45);
    doc.rect(8, 8, RECEIPT_WIDTH - 16, RECEIPT_HEIGHT - 16);

    doc.setFillColor(...green);
    doc.rect(14, 13, RECEIPT_WIDTH - 28, 18, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);

    doc.text("RENT RECEIPT", RECEIPT_WIDTH / 2, 21, {
      align: "center",
    });

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
      money(balance),
      rightX,
      56,
      valueOffset,
      70,
      green,
      text,
      true,
    );

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
      payment?.received_by || "",
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

    if (previewWindow) {
      previewWindow.location.href = doc.output("bloburl");
    } else {
      doc.save(`${getTenantReceiptFileName(payment, tenant)}.pdf`);
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

function TenantReceiptActions({
  payment,
  tenant,
  propertyHeader,
  payments,
  expectedAmount,
}) {
  const receiptDate = payment?.payment_date || payment?.billing_month || "";
  const receiptLabel = receiptDate ? dateLabel(receiptDate) : "this payment";

  return (
    <div className="portal-receipt-actions">
      <button
        type="button"
        className="portal-view-receipt"
        title="View receipt"
        aria-label={`View receipt for ${receiptLabel}`}
        onClick={() => {
          const receiptWindow = window.open("", "_blank");

          if (!receiptWindow) return;

          receiptWindow.document.title = "Preparing receipt…";
          downloadTenantReceipt(
            payment,
            tenant,
            propertyHeader,
            payments,
            expectedAmount,
            receiptWindow,
          ).catch(() => receiptWindow.close());
        }}
      >
        <Eye size={14} />
      </button>

      <button
        type="button"
        className="portal-download-receipt"
        title="Download receipt"
        aria-label={`Download receipt for ${receiptLabel}`}
        onClick={() =>
          downloadTenantReceipt(
            payment,
            tenant,
            propertyHeader,
            payments,
            expectedAmount,
          )
        }
      >
        <Download size={14} />
      </button>
    </div>
  );
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

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

      const data = await db.tenantPortal.summary(normalized, currentMonth());

      setSummary(data);
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

  // Billing records are now the source data for rental balances/statuses.
  const billingHistory = useMemo(
    () =>
      (Array.isArray(portalSummary?.billing_history)
        ? portalSummary.billing_history
        : []
      )
        .map((record) => ({
          ...record,
          paid_amount: Number(record?.paid_amount || 0),
          amount_due: Number(record?.amount_due || 0),
          balance: Number(record?.balance || 0),
        }))
        .sort((a, b) =>
          String(b.billing_month || "").localeCompare(
            String(a.billing_month || ""),
          ),
        ),
    [portalSummary?.billing_history],
  );

  const billingMonth = String(billing?.billing_month || currentMonth()).slice(
    0,
    7,
  );

  const currentBilling =
    billingHistory.find(
      (record) =>
        String(record?.billing_month || "").slice(0, 7) === billingMonth &&
        (!tenancy?.id ||
          String(record?.tenancy_id || "") === String(tenancy.id)),
    ) ||
    billingHistory.find(
      (record) =>
        String(record?.billing_month || "").slice(0, 7) === billingMonth,
    ) ||
    null;

  const amountDue = Number(currentBilling?.amount_due || 0);
  const currentMonthPaid = Number(currentBilling?.paid_amount || 0);
  const balance = Math.max(
    Number(currentBilling?.balance ?? amountDue - currentMonthPaid),
    0,
  );

  const totalUnpaid = billingHistory.reduce(
    (total, record) => total + Math.max(Number(record.balance || 0), 0),
    0,
  );

  const status = currentBilling
    ? getBillingRecordStatus(currentBilling, currentBilling.paid_amount)
    : "Upcoming";

  const paymentRows = useMemo(() => {
    const billingRows = billingHistory.map((record) => ({
      ...record,
      payment_type: "rent",
      payment_date: record.latest_payment_date,
      row_kind: "billing",
    }));

    const standalonePayments = payments.filter(
      (payment) =>
        String(payment?.payment_type || payment?.type || "rent")
          .trim()
          .toLowerCase() !== "rent",
    );

    const otherPaymentRows = standalonePayments.map((payment) => ({
      id: `payment-${payment.id}`,
      payment_type: payment.payment_type || payment.type,
      payment_date: payment.payment_date,
      billing_month: payment.billing_month,
      unit_number: payment.unit_number,
      // Deposits and advances are standalone transactions. They are not
      // monthly rent obligations, so they must not inherit monthly_rent as
      // an artificial amount due/balance.
      amount_due: null,
      paid_amount: Number(payment.amount || 0),
      balance: 0,
      payment_methods: payment.payment_method ? [payment.payment_method] : [],
      latest_payment: payment,
      row_kind: "standalone",
    }));

    return [...billingRows, ...otherPaymentRows].sort((first, second) => {
      const secondDate = String(
        second.payment_date || second.billing_month || "",
      );
      const firstDate = String(first.payment_date || first.billing_month || "");

      return secondDate.localeCompare(firstDate);
    });
  }, [billingHistory, payments]);

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
  const tenantName = [tenant.first_name, tenant.last_name].filter(Boolean).join(" ") || firstName;
  const initials = tenantName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "T";
  const propertyName = portalSummary.property_name || "Rental Apartment";
  const propertyAddress = portalSummary.property_address || "";
  const propertyPhone = portalSummary.property_phone || "";
  const qrUrl = portalSummary.payment_qr_url || portalSummary.qr_code_url || "";
  const contractDocument = portalSummary.contract_document || portalSummary.contract_number || "";
  const paymentRowsVisible = paymentRows.slice(0, 6);
  const historyVisible = showAllHistory ? history : history.slice(0, 3);
  const availableMethods = Array.from(
    new Set(payments.map((payment) => formatPaymentMethod(payment.payment_method)).filter((method) => method && method !== "—")),
  );

  const copyTenantId = async () => {
    if (!tenant?.id) return;
    try {
      await navigator.clipboard.writeText(String(tenant.id));
    } catch {
      // Clipboard access is optional.
    }
  };

  const shareQr = async () => {
    if (!qrUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${propertyName} payment QR`, url: qrUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(qrUrl);
      }
    } catch {
      // Sharing can be cancelled by the user.
    }
  };

  const saveQr = () => {
    if (!qrUrl) return;
    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `${propertyName.replace(/[^a-z0-9]+/gi, "-")}-payment-qr`;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="portal-page portal-dashboard-page">
      <header className="portal-topbar">
        <div className="portal-topbar-inner">
          <div className="portal-brand">
            <div className="portal-brand-mark"><Building2 size={20} /></div>
            <div>
              <strong>{propertyName}</strong>
              <span>Tenant Portal</span>
            </div>
          </div>

          <div className="portal-topbar-actions">
            <button type="button" className="portal-icon-button" aria-label="Notifications" title="Notifications">
              <Bell size={18} />
            </button>
            <div className="portal-profile-wrap">
              <button
                type="button"
                className="portal-profile-button"
                onClick={() => setProfileMenuOpen((value) => !value)}
                aria-expanded={profileMenuOpen}
              >
                <span className="portal-avatar">{initials}</span>
                <span className="portal-profile-name">{tenantName}</span>
                <ChevronDown size={15} />
              </button>
              {profileMenuOpen && (
                <div className="portal-profile-menu">
                  <div className="portal-profile-menu-head">
                    <strong>{tenantName}</strong>
                    <span>{tenant.email || "Tenant account"}</span>
                  </div>
                  <button type="button" onClick={signOut}>
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="portal-content portal-content-modern">
        <section className="portal-welcome-banner">
          <div className="portal-welcome-copy">
            <span>Welcome back,</span>
            <h1>{firstName}!</h1>
            <p>Here's an overview of your rental account.</p>
          </div>
          <div className="portal-welcome-avatar">{initials}</div>
          <div className="portal-welcome-art" aria-hidden="true">
            <Home size={120} strokeWidth={0.75} />
          </div>
        </section>

        <div className="portal-dashboard-grid">
          <div className="portal-dashboard-main">
            <section className="portal-card portal-tenant-info-card">
              <div className="portal-section-head">
                <div>
                  <span className="portal-eyebrow">ACCOUNT</span>
                  <h2>Tenant Information</h2>
                </div>
                <span className={`portal-status-badge ${String(tenant.status || "active").toLowerCase()}`}>
                  <span /> {String(tenant.status || "active").replace(/_/g, " ")}
                </span>
              </div>

              <div className="portal-tenant-grid">
                <div className="portal-info-item"><span className="portal-info-icon"><Building2 size={16} /></span><div><small>Name</small><strong>{tenantName}</strong></div></div>
                <div className="portal-info-item"><span className="portal-info-icon"><Phone size={16} /></span><div><small>Phone</small><strong>{tenant.phone || "—"}</strong></div></div>
                <div className="portal-info-item"><span className="portal-info-icon"><Mail size={16} /></span><div><small>Email</small><strong>{tenant.email || "—"}</strong></div></div>
                <div className="portal-info-item"><span className="portal-info-icon"><FileText size={16} /></span><div><small>Tenant ID</small><strong>{tenant.id ? `${String(tenant.id).slice(0, 8)}…` : "—"}</strong></div><button type="button" className="portal-inline-icon" onClick={copyTenantId} title="Copy tenant ID" aria-label="Copy tenant ID"><Copy size={13} /></button></div>
                <div className="portal-info-item"><span className="portal-info-icon"><ReceiptText size={16} /></span><div><small>Contract / Document</small><strong>{contractDocument || "Not assigned"}</strong></div></div>
              </div>
            </section>

            <section className="portal-summary-grid">
              <article className="portal-summary-card"><span className="portal-summary-icon"><Home size={18} /></span><div><small>Unit No.</small><strong>{tenancy?.unit_number ? `Unit ${tenancy.unit_number}` : "—"}</strong><span>{tenancy?.start_date ? `Since ${dateLabel(tenancy.start_date)}` : "No active unit"}</span></div></article>
              <article className="portal-summary-card"><span className="portal-summary-icon"><CircleDollarSign size={18} /></span><div><small>Monthly Rent</small><strong>{money(tenancy?.monthly_rent || 0)}</strong><span>{tenancy?.payment_due_day ? `Due every ${tenancy.payment_due_day}` : "No due date"}</span></div></article>
              <article className="portal-summary-card"><span className={`portal-summary-icon ${status.toLowerCase()}`}><WalletCards size={18} /></span><div><small>Current Balance</small><strong>{money(balance)}</strong><span className={`portal-summary-status ${status.toLowerCase().replace(/\s+/g, "-")}`}><i />{status}</span></div></article>
              <article className="portal-summary-card"><span className="portal-summary-icon soft"><ReceiptText size={18} /></span><div><small>Total Payments</small><strong>{payments.length}</strong><span>All recorded transactions</span></div></article>
              <article className="portal-summary-card"><span className="portal-summary-icon soft"><CheckCircle2 size={18} /></span><div><small>Total Paid</small><strong>{money(paid)}</strong><span>Across rental history</span></div></article>
              <article className="portal-summary-card"><span className="portal-summary-icon soft"><WalletCards size={18} /></span><div><small>Total Balance</small><strong>{money(totalUnpaid)}</strong><span>Total outstanding balance</span></div></article>
            </section>

            <section className="portal-card portal-payments-modern">
              <div className="portal-section-head">
                <div><span className="portal-eyebrow">TRANSACTIONS</span><h2>Payment History</h2><p>Rent, advance, and deposit payments, balances, statuses, and receipts.</p></div>
                {paymentRows.length > 6 && <button type="button" className="portal-text-button" onClick={() => setShowAllPayments((value) => !value)}>{showAllPayments ? "Show Less" : "View All"}</button>}
              </div>
              <div className="portal-table-wrap portal-table-modern-wrap">
                <table className="portal-table portal-table-modern">
                  <thead><tr><th>Payment Date</th><th>Rent Period</th><th>Unit</th><th>Type</th><th>Amount Due</th><th>Paid</th><th>Balance</th><th>Status</th><th>Method</th><th>Receipt</th></tr></thead>
                  <tbody>
                    {(showAllPayments ? paymentRows : paymentRowsVisible).map((record) => {
                      const standalone = record.row_kind === "standalone";
                      const rowStatus = standalone ? "Paid" : getBillingRecordStatus(record, record.paid_amount);
                      const receiptPayments = standalone ? [record.latest_payment].filter(Boolean) : payments.filter((payment) => record?.id && payment?.billing_record_id && String(payment.billing_record_id) === String(record.id)).sort((a, b) => String(b.payment_date || "").localeCompare(String(a.payment_date || "")));
                      const methods = Array.isArray(record.payment_methods) ? record.payment_methods.filter(Boolean) : [];
                      return <tr key={record.id}>
                        <td>{record.latest_payment_date || record.payment_date ? dateLabel(record.latest_payment_date || record.payment_date) : "—"}</td>
                        <td>{record.billing_month ? monthLabel(String(record.billing_month).slice(0, 7)) : "—"}</td>
                        <td>{record.unit_number ? `Unit ${record.unit_number}` : "—"}</td>
                        <td><span className={`portal-payment-pill type ${paymentTypeClass(record.payment_type)}`}>{formatPaymentType(record.payment_type)}</span></td>
                        <td><strong>{record.amount_due == null ? "—" : money(record.amount_due)}</strong></td>
                        <td><strong>{money(record.paid_amount)}</strong></td>
                        <td><strong className={record.balance > 0 ? "portal-billing-balance-due" : "portal-billing-balance-paid"}>{record.balance == null ? "—" : money(record.balance)}</strong></td>
                        <td><span className={`portal-payment-pill status ${billingStatusClass(rowStatus)}`}>{rowStatus}</span></td>
                        <td>{methods.length ? <div className="portal-billing-methods">{methods.map((method) => <span key={method} className={`portal-payment-pill method ${paymentMethodClass(method)}`}>{formatPaymentMethod(method)}</span>)}</div> : "—"}</td>
                        <td>{receiptPayments.length === 1 ? <TenantReceiptActions payment={receiptPayments[0]} tenant={tenant} propertyHeader={propertyAddress || propertyName} payments={payments} expectedAmount={record.amount_due || 0} /> : receiptPayments.length > 1 ? <details className="portal-receipt-list"><summary>Receipts ({receiptPayments.length})</summary><div className="portal-receipt-list-items">{receiptPayments.map((payment) => <div className="portal-receipt-list-item" key={payment.id}><span>{dateLabel(payment.payment_date)} · {money(payment.amount)}</span><TenantReceiptActions payment={payment} tenant={tenant} propertyHeader={propertyAddress || propertyName} payments={payments} expectedAmount={record.amount_due || 0} /></div>)}</div></details> : "—"}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
              {!paymentRows.length && <div className="portal-empty"><Clock3 size={20} /><strong>No payment history yet</strong><span>Recorded rental transactions will appear here.</span></div>}
            </section>

            <section className="portal-card portal-unit-history-modern">
              <div className="portal-section-head"><div><span className="portal-eyebrow">RENTAL HISTORY</span><h2>Unit History</h2><p>Previous and current rental assignments remain available for your records.</p></div>{history.length > 0 && <span className="portal-history-count">{history.length} {history.length === 1 ? "assignment" : "assignments"}</span>}</div>
              <div className="portal-timeline">
                {historyVisible.map((item, index) => { const isCurrent = index === 0 && !item.end_date; return <div className={`portal-timeline-item ${isCurrent ? "current" : ""}`} key={item.id}>
                  <span className="portal-timeline-dot" />
                  <div className="portal-timeline-card"><div><strong>Unit {item.unit_number}</strong><span>{dateLabel(item.start_date)} — {item.end_date ? dateLabel(item.end_date) : "Present"}</span></div><div className="portal-history-rent"><strong>{money(item.monthly_rent)} <small>/ month</small></strong><span className={isCurrent ? "current" : ""}>{isCurrent ? "Current" : item.status || "Past"}</span></div></div>
                </div>; })}
              </div>
              {!history.length && <div className="portal-empty"><Building2 size={20} /><strong>No rental history yet</strong><span>Your unit assignments will appear here.</span></div>}
              {history.length > 3 && <button type="button" className="portal-text-button portal-history-toggle" onClick={() => setShowAllHistory((value) => !value)}>{showAllHistory ? "Show Less" : "View Full History"}</button>}
            </section>

            {(maintenance.length > 0 || expenses.length > 0) && (
              <section className="portal-card portal-activity-modern">
                <div className="portal-section-head"><div><span className="portal-eyebrow">ACCOUNT ACTIVITY</span><h2>Maintenance & Expenses</h2><p>Existing records related to your tenancy.</p></div></div>
                <div className="portal-activity-grid">
                  {maintenance.length > 0 && <div className="portal-activity-column"><h3>Maintenance</h3><div className="portal-activity-list">{maintenance.map((item) => <div className="portal-activity-item" key={item.id}><div><strong>{item.title || item.issue || item.description || "Maintenance request"}</strong><span>{item.reported_date ? dateLabel(item.reported_date) : "Date not recorded"}{item.units?.unit_number || item.unit_number ? ` · Unit ${item.units?.unit_number || item.unit_number}` : ""}</span></div><span className="portal-activity-status">{item.status || "Recorded"}</span></div>)}</div></div>}
                  {expenses.length > 0 && <div className="portal-activity-column"><h3>Expenses</h3><div className="portal-activity-list">{expenses.map((item) => <div className="portal-activity-item" key={item.id}><div><strong>{item.description || item.category || item.name || "Expense"}</strong><span>{item.expense_date ? dateLabel(item.expense_date) : "Date not recorded"}{item.units?.unit_number || item.unit_number ? ` · Unit ${item.units?.unit_number || item.unit_number}` : ""}</span></div><strong className="portal-expense-amount">{money(item.amount)}</strong></div>)}</div></div>}
                </div>
              </section>
            )}
          </div>

          <aside className="portal-dashboard-sidebar">
            <section className="portal-card portal-qr-card">
              <div className="portal-section-head"><div><span className="portal-eyebrow">QUICK PAYMENT</span><h2>Pay Your Rent</h2><p>Scan the QR code to pay directly to your landlord.</p></div></div>
              <div className="portal-qr-frame">
                {qrUrl ? <img src={qrUrl} alt="Rental payment QR code" /> : <div className="portal-qr-empty"><QrCode size={54} /><strong>QR payment not configured</strong><span>Your landlord's payment QR code will appear here when it is added to the property settings.</span></div>}
              </div>
              <div className="portal-qr-brand"><strong>{propertyName}</strong><span>{propertyAddress || "Secure rental payment"}</span></div>
              {availableMethods.length > 0 && <div className="portal-payment-methods">{availableMethods.map((method) => <span key={method}>{method}</span>)}</div>}
              <div className="portal-info-callout"><ShieldCheck size={15} /><span>After payment, your transaction will be verified and reflected in your payment history.</span></div>
              <div className="portal-qr-actions"><button type="button" className="portal-primary portal-qr-primary" onClick={saveQr} disabled={!qrUrl}><Download size={15} /> Save QR Code</button><button type="button" className="portal-secondary" onClick={shareQr} disabled={!qrUrl}><Share2 size={15} /> Share QR Code</button></div>
            </section>

            <section className="portal-card portal-support-card">
              <div className="portal-support-icon"><HelpCircle size={19} /></div>
              <div><span className="portal-eyebrow">NEED HELP?</span><h2>Contact your landlord</h2><p>For payment concerns, maintenance requests, or account questions.</p></div>
              {propertyPhone ? <a href={`tel:${propertyPhone}`} className="portal-secondary portal-support-button"><Phone size={15} /> {propertyPhone}</a> : <span className="portal-support-unavailable">Contact details are not configured.</span>}
            </section>

            {error && <div className="portal-error portal-dashboard-error">{error}</div>}
            <div className="portal-summary-disclaimer"><strong>Notice:</strong> Records in this portal may be incomplete or inaccurate due to unrecorded transactions. Please contact your landlord if you notice any discrepancies.</div>
          </aside>
        </div>

        <footer className="portal-footer-modern"><span>© {new Date().getFullYear()} {propertyName}. All rights reserved.</span><div><span>Privacy Policy</span><span>Terms of Service</span><span>Contact Us</span></div></footer>
      </main>
    </div>
  );
}
