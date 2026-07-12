import React from 'react';

type Point = Record<string, string | number>;

export function FinanceLineChart({
  data,
  height = 220,
}: {
  data: Point[];
  height?: number;
}) {
  const width = 760;
  const pad = 38;
  const keys = [
    { key: 'revenue', label: '确认收入', color: '#4f46e5' },
    { key: 'cost', label: '摊销成本', color: '#f59e0b' },
    { key: 'profit', label: '毛利润', color: '#16a34a' },
  ];
  const values = data.flatMap((row) => keys.map((x) => Number(row[x.key] || 0)));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const range = max - min || 1;
  const x = (i: number) =>
    pad + (i * (width - pad * 2)) / Math.max(1, data.length - 1);
  const y = (value: number) =>
    height - pad - ((value - min) / range) * (height - pad * 2);

  if (!data.length) {
    return <div style={{ color: '#999', padding: 32, textAlign: 'center' }}>暂无趋势数据</div>;
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12 }}>
        {keys.map((item) => (
          <span key={item.key}>
            <i style={{ display: 'inline-block', width: 10, height: 3, background: item.color, marginRight: 5 }} />
            {item.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, display: 'block' }} role="img" aria-label="收入、成本和利润趋势图">
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const yy = pad + p * (height - pad * 2);
          const value = max - p * range;
          return (
            <g key={p}>
              <line x1={pad} y1={yy} x2={width - pad} y2={yy} stroke="#eef0f5" />
              <text x={pad - 5} y={yy + 4} textAnchor="end" fontSize="10" fill="#8b90a0">{value.toFixed(0)}</text>
            </g>
          );
        })}
        {keys.map((series) => (
          <polyline
            key={series.key}
            fill="none"
            stroke={series.color}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={data.map((row, i) => `${x(i)},${y(Number(row[series.key] || 0))}`).join(' ')}
          />
        ))}
        <text x={pad} y={height - 8} fontSize="10" fill="#8b90a0">{String(data[0]?.date || '')}</text>
        <text x={width - pad} y={height - 8} textAnchor="end" fontSize="10" fill="#8b90a0">{String(data[data.length - 1]?.date || '')}</text>
      </svg>
    </div>
  );
}
