import type { ChoiceCount } from '../types';

interface ChoiceChartProps {
  items: ChoiceCount[];
}

export default function ChoiceChart({ items }: ChoiceChartProps) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const max = items.reduce((best, item) => Math.max(best, item.count), 1);

  return (
    <div className="choice-chart">
      {items.map((item) => {
        const barHeight = item.count > 0 ? Math.max((item.count / max) * 100, 12) : 6;
        const share = total ? Math.round((item.count / total) * 100) : 0;

        return (
          <article className="choice-chart-item" key={item.label}>
            <div className="choice-chart-visual">
              <div className="choice-chart-bar" style={{ height: `${barHeight}%` }} />
            </div>
            <div className="choice-chart-meta">
              <strong>{item.count}</strong>
              <span>{share}%</span>
            </div>
            <p>{item.label}</p>
          </article>
        );
      })}
    </div>
  );
}
