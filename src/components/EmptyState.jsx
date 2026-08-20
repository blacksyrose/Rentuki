export default function EmptyState({ icon: Icon, title, message, className = "" }) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={20} strokeWidth={1.8} />
        </div>
      )}
      <strong>{title}</strong>
      {message && <span>{message}</span>}
    </div>
  );
}
