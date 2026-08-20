import { useMemo, useState } from "react";
import {
  Calculator,
  CheckCircle2,
  FileDown,
  Printer,
  RotateCcw,
  Zap,
} from "lucide-react";
import { jsPDF } from "jspdf";
import EmptyState from "../components/EmptyState";

const INITIAL_FORM = {
  totalBill: "",
  totalConsumption: "",
  submeterUnit: "Unit 9",
  submeterTenant: "",
  previousReading: "",
  currentReading: "",
  otherUnit: "Unit 8",
  otherTenant: "",
};

const money = (value) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const number = (value, digits = 2) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);

const pdfMoney = (value) => `PHP ${Number(value || 0).toFixed(2)}`;

function calculate(form) {
  const totalBill = Number(form.totalBill);
  const totalConsumption = Number(form.totalConsumption);
  const previousReading = Number(form.previousReading);
  const currentReading = Number(form.currentReading);

  const hasInputs = [
    form.totalBill,
    form.totalConsumption,
    form.previousReading,
    form.currentReading,
  ].some((value) => String(value).trim() !== "");

  if (!hasInputs) return null;

  const submeterConsumption = currentReading - previousReading;
  const otherConsumption = totalConsumption - submeterConsumption;
  const rate = totalConsumption > 0 ? totalBill / totalConsumption : 0;
  const submeterShare = submeterConsumption * rate;
  // Keep the displayed allocation exactly equal to the total bill after cent rounding.
  const otherShare = totalBill - Math.round(submeterShare * 100) / 100;
  const allocatedTotal = Math.round((submeterShare + otherShare) * 100) / 100;
  const difference = Math.round((allocatedTotal - totalBill) * 100) / 100;

  return {
    totalBill,
    totalConsumption,
    previousReading,
    currentReading,
    submeterConsumption,
    otherConsumption,
    rate,
    submeterShare: Math.round(submeterShare * 100) / 100,
    otherShare: Math.round(otherShare * 100) / 100,
    allocatedTotal,
    difference,
  };
}

function validate(result) {
  if (!result) return "Enter the bill and meter readings to calculate.";
  if (!Number.isFinite(result.totalBill) || result.totalBill < 0)
    return "Total bill must be a valid amount of ₱0 or more.";
  if (!Number.isFinite(result.totalConsumption) || result.totalConsumption <= 0)
    return "Total consumption must be greater than 0 kWh.";
  if (
    !Number.isFinite(result.previousReading) ||
    !Number.isFinite(result.currentReading)
  )
    return "Previous and current meter readings are required.";
  if (result.currentReading < result.previousReading)
    return "Current meter reading cannot be lower than the previous reading.";
  if (result.submeterConsumption > result.totalConsumption)
    return "Submeter consumption cannot be greater than total consumption.";
  return "";
}

function buildSubmeterPdf(form, result) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 14;
  const contentWidth = pageWidth - left * 2;
  let y = 18;
  const colors = {
    ink: [23, 32, 51],
    muted: [122, 135, 153],
    line: [229, 234, 241],
    card: [248, 250, 252],
    green: [35, 134, 77],
    greenFill: [251, 254, 252],
    greenLine: [220, 232, 223],
    blueFill: [251, 252, 254],
    blueLine: [229, 234, 241],
  };
  const setText = (color) => doc.setTextColor(...color);
  const roundedBox = (x, top, width, height, fill, stroke) => {
    doc.setFillColor(...fill);
    doc.setDrawColor(...stroke);
    doc.roundedRect(x, top, width, height, 2.5, 2.5, "FD");
  };

  setText(colors.muted);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("BILL OVERVIEW", left, y);
  setText(colors.ink);
  doc.setFontSize(18);
  doc.text("SUBMETER BILL ALLOCATION", left, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  setText(colors.muted);
  doc.text("Electricity bill calculation and allocation", left, y + 13);
  y += 22;

  doc.setDrawColor(...colors.line);
  doc.line(left, y, pageWidth - left, y);
  y += 7;

  const summaryGap = 3;
  const summaryWidth = (contentWidth - summaryGap * 2) / 3;
  const summaryItems = [
    ["TOTAL BILL", pdfMoney(result.totalBill)],
    ["TOTAL CONSUMPTION", `${number(result.totalConsumption)} kWh`],
    ["RATE PER KWH", `PHP ${result.rate.toFixed(8)}`],
  ];
  summaryItems.forEach(([label, value], index) => {
    const x = left + index * (summaryWidth + summaryGap);
    roundedBox(x, y, summaryWidth, 18, colors.card, colors.line);
    setText(colors.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(label, x + 3, y + 6);
    setText(colors.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(value, x + 3, y + 13);
  });
  y += 25;

  const drawUnit = ({
    unit,
    tenant,
    previous,
    current,
    consumption,
    share,
    includeReadings,
    fill,
    stroke,
  }) => {
    const unitHeight = includeReadings ? 37 : tenant ? 38 : 35;
    roundedBox(left, y, contentWidth, unitHeight, fill, stroke);
    const boxTop = y;
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setText(colors.muted);
    doc.text(includeReadings ? "SUBMETER" : "REMAINING CONSUMPTION", left + 4, y);
    y += 6;
    setText(colors.ink);
    doc.setFontSize(11);
    doc.text(unit || "Unit", left + 4, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    if (tenant) {
      setText(colors.muted);
      doc.text(tenant, left + 4, y + 5);
    }
    const amountColor = Number(share) < 0 ? [185, 28, 28] : colors.ink;
    setText(amountColor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(pdfMoney(share), pageWidth - left - 4, boxTop + 9, { align: "right" });
    y = boxTop + (tenant ? 19 : 16);

    if (includeReadings) {
      const readingWidth = (contentWidth - 12) / 3;
      const readings = [
        ["PREVIOUS", `${number(previous)} kWh`],
        ["CURRENT", `${number(current)} kWh`],
        ["CONSUMPTION", `${number(consumption)} kWh`],
      ];
      readings.forEach(([label, value], index) => {
        const x = left + 4 + index * (readingWidth + 2);
        roundedBox(x, boxTop + 21, readingWidth, 13, [255, 255, 255], colors.line);
        setText(colors.muted);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.text(label, x + 3, boxTop + 26);
        setText(colors.ink);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(value, x + 3, boxTop + 31);
      });
    } else {
      roundedBox(left + 4, boxTop + 21, contentWidth - 8, 13, [255, 255, 255], colors.line);
      setText(colors.muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text("CONSUMPTION", left + 7, boxTop + 26);
      setText(colors.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(`${number(consumption)} kWh`, left + 7, boxTop + 31);

    }
    y = boxTop + unitHeight + 8;
  };

  drawUnit({
    unit: form.submeterUnit,
    tenant: form.submeterTenant,
    previous: result.previousReading,
    current: result.currentReading,
    consumption: result.submeterConsumption,
    share: result.submeterShare,
    includeReadings: true,
    fill: colors.greenFill,
    stroke: colors.greenLine,
  });

  drawUnit({
    unit: form.otherUnit,
    tenant: form.otherTenant,
    consumption: result.otherConsumption,
    share: result.otherShare,
    includeReadings: false,
    fill: colors.blueFill,
    stroke: colors.blueLine,
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(colors.ink);
  doc.text("TOTAL ALLOCATED", left + 4, y);
  doc.setFontSize(13);
  doc.text(pdfMoney(result.allocatedTotal), pageWidth - left - 4, y, { align: "right" });
  y += 9;

  roundedBox(left, y, contentWidth, 16, [233, 248, 239], [233, 248, 239]);
  setText(colors.green);
  doc.setDrawColor(...colors.green);
  doc.setLineWidth(0.45);
  doc.circle(left + 7, y + 8, 2.2, "S");
  doc.line(left + 5.9, y + 8, left + 6.7, y + 8.8);
  doc.line(left + 6.7, y + 8.8, left + 8.2, y + 7.1);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Allocation matches total bill", left + 12, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`${pdfMoney(result.allocatedTotal)} allocated from ${pdfMoney(result.totalBill)}`, left + 12, y + 12);
  y += 25;
  doc.setDrawColor(...colors.line);
  doc.line(left, y, pageWidth - left, y);
  setText(colors.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Generated ${new Date().toLocaleString("en-PH")}`, left, y + 13);
  doc.save(`submeter-billing-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function SubmeterCalculator() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [showErrors, setShowErrors] = useState(false);

  const result = useMemo(() => calculate(form), [form]);
  const error = validate(result);
  const ready = Boolean(result && !error);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setShowErrors(false);
  };

  const clear = () => {
    setForm(INITIAL_FORM);
    setShowErrors(false);
  };

  const buildPdf = () => {
    if (!ready) {
      setShowErrors(true);
      return;
    }
    buildSubmeterPdf(form, result);
  };

  const printPage = () => {
    if (!ready) {
      setShowErrors(true);
      return;
    }
    window.print();
  };

  return (
    <div className="submeter-page">
      <div className="page-head no-print">
        <div>
          <h1>Submeter Calculator</h1>
          <p>
            Calculate shared electricity billing.
          </p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={clear} type="button">
            <RotateCcw size={16} /> Clear
          </button>
          <button
            className="secondary"
            onClick={printPage}
            type="button"
            disabled={!ready}
          >
            <Printer size={16} /> Print
          </button>
          <button
            className="primary"
            onClick={buildPdf}
            type="button"
            disabled={!ready}
          >
            <FileDown size={16} /> Save PDF
          </button>
        </div>
      </div>

      <div className="submeter-layout">
        <section className="panel no-print">
          <div className="panel-head">
            <div>
              <h2>
                <Calculator size={17} /> Bill Allocation
              </h2>
              <p>
                Enter the current electricity bill and the submeter reading.
              </p>
            </div>
          </div>

          <div className="submeter-form">
            <label>
              Total Electricity Bill
              <div className="input-prefix">
                <span>₱</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.totalBill}
                  onChange={update("totalBill")}
                  placeholder="0.00"
                />
              </div>
            </label>
            <label>
              Total Consumption
              <div className="input-suffix">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.totalConsumption}
                  onChange={update("totalConsumption")}
                  placeholder="0"
                />
                <span>kWh</span>
              </div>
            </label>

            <div className="submeter-section-title">
              <Zap size={15} /> Submeter Unit
            </div>
            <label>
              Unit
              <input
                value={form.submeterUnit}
                onChange={update("submeterUnit")}
                placeholder="Unit 9"
              />
            </label>
            <label>
              Tenant / Recipient <span className="optional">Optional</span>
              <input
                value={form.submeterTenant}
                onChange={update("submeterTenant")}
                placeholder="e.g. Irish Jane Pascual"
              />
            </label>
            <label>
              Previous Meter Reading
              <div className="input-suffix">
                <input
                  type="number"
                  step="0.01"
                  value={form.previousReading}
                  onChange={update("previousReading")}
                  placeholder="0"
                />
                <span>kWh</span>
              </div>
            </label>
            <label>
              Current Meter Reading
              <div className="input-suffix">
                <input
                  type="number"
                  step="0.01"
                  value={form.currentReading}
                  onChange={update("currentReading")}
                  placeholder="0"
                />
                <span>kWh</span>
              </div>
            </label>

            <div className="submeter-section-title">Other Unit</div>
            <label>
              Unit
              <input
                value={form.otherUnit}
                onChange={update("otherUnit")}
                placeholder="Unit 8"
              />
            </label>
            <label>
              Tenant / Recipient <span className="optional">Optional</span>
              <input
                value={form.otherTenant}
                onChange={update("otherTenant")}
                placeholder="e.g. Shirley Divina"
              />
            </label>
          </div>

          {showErrors && error && <div className="submeter-error">{error}</div>}

          <div className="calculator-note">
            <strong>No database changes</strong>
            <span>
              This calculates the exact consumption of each tenant.
            </span>
          </div>
        </section>

        <section className="panel allocation-panel" id="submeter-print-area">
          <div className="allocation-heading">
            <div>
              <span className="eyebrow">RESULT</span>
              <h2>Bill Allocation</h2>
              <p>Automatically calculated from the values on the left.</p>
            </div>
            <div className="allocation-icon">
              <Calculator size={20} />
            </div>
          </div>

          {!ready ? (
            <div className="submeter-empty">
              <EmptyState
                icon={Calculator}
                title="Ready when you are"
                message="Enter the bill and meter readings to see the allocation."
              />
            </div>
          ) : (
            <>
              <div className="allocation-summary">
                <div>
                  <span>Total Bill</span>
                  <strong>{money(result.totalBill)}</strong>
                </div>
                <div>
                  <span>Total Consumption</span>
                  <strong>{number(result.totalConsumption)} kWh</strong>
                </div>
                <div>
                  <span>Rate per kWh</span>
                  <strong>₱{result.rate.toFixed(8)}</strong>
                </div>
              </div>

              <div className="allocation-unit">
                <div className="allocation-unit-head">
                  <div>
                    <span className="unit-label">SUBMETER</span>
                    <h3>{form.submeterUnit || "Unit"}</h3>
                    {form.submeterTenant && <p>{form.submeterTenant}</p>}
                  </div>
                  <strong>{money(result.submeterShare)}</strong>
                </div>
                <div className="reading-grid">
                  <div>
                    <span>Previous</span>
                    <strong>{number(result.previousReading)} kWh</strong>
                  </div>
                  <div>
                    <span>Current</span>
                    <strong>{number(result.currentReading)} kWh</strong>
                  </div>
                  <div>
                    <span>Consumption</span>
                    <strong>{number(result.submeterConsumption)} kWh</strong>
                  </div>
                </div>
              </div>

              <div className="allocation-unit secondary-unit">
                <div className="allocation-unit-head">
                  <div>
                    <span className="unit-label">REMAINING CONSUMPTION</span>
                    <h3>{form.otherUnit || "Other Unit"}</h3>
                    {form.otherTenant && <p>{form.otherTenant}</p>}
                  </div>
                  <strong>{money(result.otherShare)}</strong>
                </div>
                <div className="reading-grid one-row">
                  <div>
                    <span>Consumption</span>
                    <strong>{number(result.otherConsumption)} kWh</strong>
                  </div>
                </div>
              </div>

              <div className="allocation-total">
                <span>Total Allocated</span>
                <strong>{money(result.allocatedTotal)}</strong>
              </div>

              <div className="allocation-check">
                <CheckCircle2 size={17} />
                <div>
                  <strong>Allocation matches total bill</strong>
                  <span>
                    {money(result.allocatedTotal)} allocated from{" "}
                    {money(result.totalBill)}
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="print-footer"> • Submeter Bill Allocation</div>
        </section>
      </div>
    </div>
  );
}
