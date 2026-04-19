// Shared primitives for v2

const Placeholder = ({ label, w = '100%', h = 80, style = {} }) => (
  <div className="ph" style={{ width: w, height: h, ...style }}>{label}</div>
);

const Chip = ({ children, variant, style }) => (
  <span className={`chip ${variant || ''}`} style={style}>{children}</span>
);

const Stamp = ({ children }) => <span className="stamp">{children}</span>;

const Avatar = ({ label, size = 'md', ring = false, cat = false, style }) => (
  <div className={`avatar ${size} ${ring ? 'ring' : ''} ${cat ? 'cat' : ''}`} style={style}>{label}</div>
);

const Scribble = ({ children }) => <span className="scribble">{children}</span>;

const Btn = ({ children, primary, ghost, onClick, style }) => (
  <button
    className={`btn ${primary ? 'primary' : ''} ${ghost ? 'ghost' : ''}`}
    onClick={onClick}
    style={style}
  >{children}</button>
);

// Sketchy line chart
const LineChart = ({ points = [], w = 340, h = 80, color, refBand, labels }) => {
  if (!points.length) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const xy = (v, i) => [i * step, h - ((v - min) / span) * (h - 10) - 5];
  const d = points.map((v, i) => {
    const [x, y] = xy(v, i);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {refBand && (() => {
        const [lo, hi] = refBand;
        const y1 = h - ((hi - min) / span) * (h - 10) - 5;
        const y2 = h - ((lo - min) / span) * (h - 10) - 5;
        return <rect x={0} y={Math.min(y1, y2)} width={w} height={Math.abs(y2 - y1)} fill="var(--accent-2)" opacity="0.35" />;
      })()}
      <path d={d} fill="none" stroke={color || 'var(--ink)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((v, i) => {
        const [x, y] = xy(v, i);
        return <circle key={i} cx={x} cy={y} r="2.4" fill="var(--paper)" stroke={color || 'var(--ink)'} strokeWidth="1.5" />;
      })}
    </svg>
  );
};

const Bars = ({ values = [], w = 160, h = 60, color }) => {
  if (!values.length) return null;
  const bw = w / values.length - 4;
  const max = Math.max(...values);
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {values.map((v, i) => (
        <rect key={i} x={i * (bw + 4)} y={h - (v / max) * h} width={bw} height={(v / max) * h}
              fill={color || 'var(--accent)'} stroke="var(--line)" strokeWidth="1.5" />
      ))}
    </svg>
  );
};

const DashLabel = ({ children, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0 8px' }}>
    <span className="mono" style={{ color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>{children}</span>
    <div style={{ flex: 1, borderTop: '1.5px dashed var(--rule)' }} />
    {right && <span className="mono" style={{ color: 'var(--ink-soft)' }}>{right}</span>}
  </div>
);

const Tile = ({ k, v, u, warn, trend }) => (
  <div className={`tile ${warn ? 'warn' : ''}`}>
    <div className="k">{k}</div>
    <div className="v" style={warn ? { color: 'var(--danger)' } : {}}>{v}</div>
    {u && <div className="u">{u}</div>}
    {trend && <div style={{ marginTop: 4 }}><LineChart points={trend} w={120} h={28} color={warn ? 'var(--danger)' : 'var(--ink)'} /></div>}
  </div>
);

Object.assign(window, { Placeholder, Chip, Stamp, Avatar, Scribble, Btn, LineChart, Bars, DashLabel, Tile });
