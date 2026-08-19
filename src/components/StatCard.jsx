export default function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "",
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{Icon && <Icon size={20} />}</div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
    </div>
  );
}
