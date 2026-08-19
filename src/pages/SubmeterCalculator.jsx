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

const pdfMoney = (value) => `PHP ${Number(value || 0).toFixed(2)}`;

const number = (value, digits = 2) =>
  new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0);

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

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 20;
    let y = 22;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("RENTUKI", left, y);
    y += 8;

    doc.setFontSize(13);
    doc.text("SUBMETER BILL ALLOCATION", left, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 110, 125);
    doc.text("Electricity bill calculation and allocation", left, y);
    doc.setTextColor(23, 32, 51);
    y += 12;

    const line = () => {
      doc.setDrawColor(220, 225, 232);
      doc.line(left, y, pageWidth - left, y);
      y += 7;
    };

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("BILL OVERVIEW", left, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.text("Total Electricity Bill", left, y);
    doc.text(pdfMoney(result.totalBill), pageWidth - left, y, {
      align: "right",
    });
    y += 6;
    doc.text("Total Consumption", left, y);
    doc.text(`${number(result.totalConsumption)} kWh`, pageWidth - left, y, {
      align: "right",
    });
    y += 6;
    doc.text("Rate per kWh", left, y);
    doc.text(`PHP ${result.rate.toFixed(8)}`, pageWidth - left, y, {
      align: "right",
    });
    y += 4;
    line();

    const drawUnit = ({
      unit,
      tenant,
      previous,
      current,
      consumption,
      share,
      includeReadings,
    }) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(unit || "Unit", left, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      if (tenant) {
        doc.text(`Tenant: ${tenant}`, left, y);
        y += 5;
      }
      if (includeReadings) {
        doc.text("Previous Reading", left, y);
        doc.text(`${number(previous)} kWh`, pageWidth - left, y, {
          align: "right",
        });
        y += 5;
        doc.text("Current Reading", left, y);
        doc.text(`${number(current)} kWh`, pageWidth - left, y, {
          align: "right",
        });
        y += 5;
      }
      doc.text("Consumption", left, y);
      doc.text(`${number(consumption)} kWh`, pageWidth - left, y, {
        align: "right",
      });
      y += 5;
      doc.text("Amount to Pay", left, y);
      doc.setFont("helvetica", "bold");
      doc.text(pdfMoney(share), pageWidth - left, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 9;
      line();
    };

    drawUnit({
      unit: form.submeterUnit,
      tenant: form.submeterTenant,
      previous: result.previousReading,
      current: result.currentReading,
      consumption: result.submeterConsumption,
      share: result.submeterShare,
      includeReadings: true,
    });

    drawUnit({
      unit: form.otherUnit,
      tenant: form.otherTenant,
      consumption: result.otherConsumption,
      share: result.otherShare,
      includeReadings: false,
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("TOTAL ALLOCATED", left, y);
    doc.text(pdfMoney(result.allocatedTotal), pageWidth - left, y, {
      align: "right",
    });
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(35, 134, 77);
    doc.text("✓ Allocation matches total bill", left, y);
    doc.setTextColor(100, 110, 125);
    y += 12;
    doc.text(`Generated ${new Date().toLocaleString("en-PH")}`, left, y);
    doc.save(`submeter-billing-${new Date().toISOString().slice(0, 10)}.pdf`);
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
            Calculate shared electricity billing without saving anything to the
            database.
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
                <Calculator size={17} /> Calculator Inputs
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
              This calculator is temporary. Clearing the page removes the
              calculation from memory.
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
              <Calculator size={30} />
              <strong>Ready when you are</strong>
              <span>
                Enter the bill and meter readings to see the allocation.
              </span>
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

          <div className="print-footer">Rentuki • Submeter Bill Allocation</div>
        </section>
      </div>
    </div>
  );
}
