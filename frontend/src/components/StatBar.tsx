interface StatBarProps {
  label: string;
  count: number;
  max: number;
}

export default function StatBar({ label, count, max }: StatBarProps) {
  const width = max > 0 ? Math.max((count / max) * 100, count > 0 ? 8 : 0) : 0;

  return (
    <div className="stat-row">
      <div className="stat-row-top">
        <span>{label}</span>
        <strong>{count}</strong>
      </div>
      <div className="stat-track">
        <div className="stat-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
