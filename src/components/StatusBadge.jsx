const tone = (s) =>
  ({
    paid: "success",
    active: "success",
    occupied: "success",
    completed: "success",
    overdue: "danger",
    urgent: "danger",
    moving: "warning",
    partial: "warning",
    "partially paid": "warning",
    due: "warning",
    reserved: "info",
    maintenance: "info",
    upcoming: "muted",
    vacant: "muted",
    historical: "muted",
    "moved out": "muted",
    open: "danger",
    "in progress": "warning",
    cancelled: "muted",
  })[String(s || "").toLowerCase()] || "muted";
export default function StatusBadge({ status }) {
  return <span className={`badge ${tone(status)}`}>{status}</span>;
}
