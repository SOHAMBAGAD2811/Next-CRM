'use client';

import { useEffect, useMemo, useState } from 'react';
import { dashboardApi, leadsApi, type DashboardData, type Lead } from '@/lib/api';
import LeadRow from '@/components/LeadRow';

type Period = 'week' | 'month' | 'quarter' | 'year';
type ChartMode = 'bar' | 'line';

type SeriesPoint = {
  label: string;
  current: number;
  previous: number;
};

type TrendHover = {
  x: number;
  y: number;
  label: string;
  current: number;
  previous: number;
};

type PieHover = {
  name: string;
  value: number;
  pct: number;
  color: string;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inRange(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function dayDiff(from: Date, to: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  return Math.floor((to.getTime() - from.getTime()) / ms);
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function buildSeries(leads: Lead[], period: Period, now = new Date()): SeriesPoint[] {
  const currentToday = startOfToday(now);

  if (period === 'week') {
    const weekdayOffset = (currentToday.getDay() + 6) % 7;
    const start = new Date(currentToday);
    start.setDate(currentToday.getDate() - weekdayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const prevStart = new Date(start);
    prevStart.setFullYear(start.getFullYear() - 1);
    const prevEnd = new Date(end);
    prevEnd.setFullYear(end.getFullYear() - 1);

    const points = WEEK_LABELS.map(label => ({ label, current: 0, previous: 0 }));

    for (const lead of leads) {
      const date = toDate(lead.created_at);
      const value = Number(lead.deal_value || 0);
      if (!date || value <= 0) continue;

      if (inRange(date, start, end)) {
        const idx = dayDiff(start, startOfToday(date));
        if (idx >= 0 && idx < 7) points[idx].current += value;
      }

      if (inRange(date, prevStart, prevEnd)) {
        const idx = dayDiff(prevStart, startOfToday(date));
        if (idx >= 0 && idx < 7) points[idx].previous += value;
      }
    }

    return points;
  }

  if (period === 'month') {
    const year = currentToday.getFullYear();
    const month = currentToday.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const points = Array.from({ length: daysInMonth }, (_, i) => ({
      label: `${i + 1}`,
      current: 0,
      previous: 0,
    }));

    for (const lead of leads) {
      const date = toDate(lead.created_at);
      const value = Number(lead.deal_value || 0);
      if (!date || value <= 0) continue;

      if (date.getFullYear() === year && date.getMonth() === month) {
        points[date.getDate() - 1].current += value;
      }
      if (date.getFullYear() === year - 1 && date.getMonth() === month) {
        const idx = date.getDate() - 1;
        if (idx < points.length) points[idx].previous += value;
      }
    }

    return points;
  }

  if (period === 'quarter') {
    const year = currentToday.getFullYear();
    const qStart = Math.floor(currentToday.getMonth() / 3) * 3;

    const points = [0, 1, 2].map(i => ({
      label: MONTH_LABELS[qStart + i],
      current: 0,
      previous: 0,
    }));

    for (const lead of leads) {
      const date = toDate(lead.created_at);
      const value = Number(lead.deal_value || 0);
      if (!date || value <= 0) continue;

      const monthIdx = date.getMonth() - qStart;
      if (monthIdx < 0 || monthIdx > 2) continue;

      if (date.getFullYear() === year) points[monthIdx].current += value;
      if (date.getFullYear() === year - 1) points[monthIdx].previous += value;
    }

    return points;
  }

  const year = currentToday.getFullYear();
  const points = MONTH_LABELS.map(label => ({ label, current: 0, previous: 0 }));

  for (const lead of leads) {
    const date = toDate(lead.created_at);
    const value = Number(lead.deal_value || 0);
    if (!date || value <= 0) continue;

    const month = date.getMonth();
    if (date.getFullYear() === year) points[month].current += value;
    if (date.getFullYear() === year - 1) points[month].previous += value;
  }

  return points;
}

function formatMoneyShort(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${Math.round(value)}`;
}

function chartPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function donutSlicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
) {
  const safeEnd = endAngle - startAngle >= 360 ? startAngle + 359.999 : endAngle;
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, safeEnd);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, safeEnd);
  const largeArc = safeEnd - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export default function DashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [period, setPeriod]   = useState<Period>('month');
  const [chartMode, setChartMode] = useState<ChartMode>('bar');
  const [trendHover, setTrendHover] = useState<TrendHover | null>(null);
  const [pieHover, setPieHover] = useState<PieHover | null>(null);

  useEffect(() => {
    Promise.all([
      dashboardApi.get(),
      leadsApi.list({ sort: 'created_at', order: 'asc' }),
    ])
      .then(([dash, leads]) => {
        setData(dash);
        setAllLeads(leads);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const trendSeries = useMemo(() => buildSeries(allLeads, period), [allLeads, period]);

  const maxChartValue = useMemo(
    () => Math.max(1, ...trendSeries.flatMap(p => [p.current, p.previous])),
    [trendSeries]
  );

  const valueShare = useMemo(() => {
    const ranked = [...allLeads]
      .map(l => ({ name: l.name, value: Number(l.deal_value || 0) }))
      .filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value);

    const top = ranked.slice(0, 5);
    const others = ranked.slice(5).reduce((sum, item) => sum + item.value, 0);

    const slices = [...top];
    if (others > 0) slices.push({ name: 'Others', value: others });

    return {
      slices,
      total: slices.reduce((sum, s) => sum + s.value, 0),
    };
  }, [allLeads]);

  const chartWidth = Math.max(680, trendSeries.length * (period === 'month' ? 28 : 54));
  const chartHeight = 250;
  const padding = { left: 56, right: 24, top: 22, bottom: 44 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const step = trendSeries.length ? innerWidth / trendSeries.length : innerWidth;

  const currentPoints = trendSeries.map((p, i) => ({
    x: padding.left + step * i + step / 2,
    y: padding.top + innerHeight - (p.current / maxChartValue) * innerHeight,
  }));
  const previousPoints = trendSeries.map((p, i) => ({
    x: padding.left + step * i + step / 2,
    y: padding.top + innerHeight - (p.previous / maxChartValue) * innerHeight,
  }));

  const PIE_COLORS = ['#ff4d00', '#4d7cff', '#00c896', '#f5c518', '#1a1a1a', '#888'];

  const pieSlices = useMemo(() => {
    let angleCursor = -90;
    return valueShare.slices.map((slice, idx) => {
      const pct = valueShare.total ? (slice.value / valueShare.total) * 100 : 0;
      const sweep = (pct / 100) * 360;
      const start = angleCursor;
      const end = angleCursor + sweep;
      angleCursor = end;

      return {
        ...slice,
        pct,
        color: PIE_COLORS[idx % PIE_COLORS.length],
        start,
        end,
      };
    });
  }, [valueShare.slices, valueShare.total]);

  if (loading) return (
    <>
      <div className="topbar"><div className="topbar-title">Dashboard</div></div>
      <div className="page"><div className="loading-state">Loading dashboard data...</div></div>
    </>
  );

  if (error) return (
    <>
      <div className="topbar"><div className="topbar-title">Dashboard</div></div>
      <div className="page">
        <div style={{ padding: 20, border: 'var(--border)', background: '#fff0eb', fontFamily: 'var(--mono)', fontSize: 13 }}>
          ⚠ Cannot connect to API: {error}
          <br /><br />Make sure Flask is running at <strong>{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}</strong>
        </div>
      </div>
    </>
  );

  const { kpis, sentiment_distribution: sent, top_leads, at_risk } = data!;
  const sentTotal = Object.values(sent).reduce((a, b) => a + b, 0) || 1;

  return (
    <>
      <div className="topbar">
        <div className="topbar-title">Dashboard</div>
        <div className="topbar-right">
          {kpis.at_risk_count > 0 && (
            <span className="notif-badge">{kpis.at_risk_count} AT-RISK</span>
          )}
          <a href="/leads" className="btn btn-primary">+ Add Lead</a>
        </div>
      </div>

      <div className="page">
        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card green">
            <div className="kpi-label">Total Leads</div>
            <div className="kpi-value">{kpis.total_leads}</div>
            <span className="kpi-delta up">↑ Active pipeline</span>
          </div>
          <div className="kpi-card blue">
            <div className="kpi-label">Pipeline Value</div>
            <div className="kpi-value">₹{(kpis.pipeline_value / 100000).toFixed(1)}L</div>
            <span className="kpi-delta up">Open deals</span>
          </div>
          <div className="kpi-card purple">
            <div className="kpi-label">Forecasted Value</div>
            <div className="kpi-value">₹{(kpis.forecasted_value / 100000).toFixed(1)}L</div>
            <span className="kpi-delta up">Expected revenue</span>
          </div>
          <div className="kpi-card yellow">
            <div className="kpi-label">Conversion Rate</div>
            <div className="kpi-value">{kpis.conversion_rate}%</div>
            <span className="kpi-delta up">Lead → Closed</span>
          </div>
          <div className="kpi-card red">
            <div className="kpi-label">Churn Risk</div>
            <div className="kpi-value">{kpis.at_risk_count}</div>
            <span className="kpi-delta down">Accounts flagged</span>
          </div>
        </div>

        <div className="grid-2">
          <div className="panel mb-6">
            <div className="panel-header">
              <div className="panel-title">Lead Value Trend</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="form-select" style={{ width: 128, padding: '6px 8px', fontSize: 12 }} value={period} onChange={e => setPeriod(e.target.value as Period)}>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="quarter">Quarter</option>
                  <option value="year">Year</option>
                </select>
                <select className="form-select" style={{ width: 96, padding: '6px 8px', fontSize: 12 }} value={chartMode} onChange={e => setChartMode(e.target.value as ChartMode)}>
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                </select>
              </div>
            </div>
            <div className="panel-body" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 10 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="legend-dot" style={{ background: 'var(--blue)' }} />Current</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="legend-dot" style={{ background: 'var(--gray4)' }} />Previous Year</span>
              </div>
              {trendSeries.length === 0 ? (
                <div className="empty-state" style={{ padding: '22px 0' }}>No value history yet.</div>
              ) : (
                <div className="chart-scroll-wrap">
                  <svg width={chartWidth} height={chartHeight} role="img" aria-label="Lead value trend chart">
                    {[0, 1, 2, 3, 4].map(t => {
                      const y = padding.top + (innerHeight / 4) * t;
                      const val = maxChartValue * (1 - t / 4);
                      return (
                        <g key={t}>
                          <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="#d7d3cb" strokeWidth="1" />
                          <text x={padding.left - 8} y={y + 4} textAnchor="end" style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: '#666' }}>
                            {formatMoneyShort(val)}
                          </text>
                        </g>
                      );
                    })}

                    {chartMode === 'bar' && trendSeries.map((p, i) => {
                      const groupX = padding.left + step * i + step / 2;
                      const barW = Math.max(6, Math.min(14, step * 0.28));
                      const prevH = (p.previous / maxChartValue) * innerHeight;
                      const currH = (p.current / maxChartValue) * innerHeight;
                      const prevY = padding.top + innerHeight - prevH;
                      const currY = padding.top + innerHeight - currH;

                      return (
                        <g key={p.label}>
                          <rect x={groupX - barW - 2} y={prevY} width={barW} height={Math.max(1, prevH)} fill="#888" opacity="0.6" />
                          <rect x={groupX + 2} y={currY} width={barW} height={Math.max(1, currH)} fill="#4d7cff" />
                          <rect
                            x={groupX - barW - 4}
                            y={padding.top}
                            width={barW * 2 + 8}
                            height={innerHeight}
                            fill="transparent"
                            onMouseEnter={() => setTrendHover({
                              x: groupX,
                              y: Math.min(prevY, currY) - 10,
                              label: p.label,
                              current: p.current,
                              previous: p.previous,
                            })}
                            onMouseLeave={() => setTrendHover(null)}
                          />
                        </g>
                      );
                    })}

                    {chartMode === 'line' && (
                      <>
                        <path d={chartPath(previousPoints)} fill="none" stroke="#888" strokeWidth="2" strokeDasharray="5 4" />
                        <path d={chartPath(currentPoints)} fill="none" stroke="#4d7cff" strokeWidth="3" />
                        {currentPoints.map((p, i) => (
                          <g key={`curr-${i}`}>
                            <circle cx={p.x} cy={p.y} r="3" fill="#4d7cff" />
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="9"
                              fill="transparent"
                              onMouseEnter={() => setTrendHover({
                                x: p.x,
                                y: p.y - 12,
                                label: trendSeries[i].label,
                                current: trendSeries[i].current,
                                previous: trendSeries[i].previous,
                              })}
                              onMouseLeave={() => setTrendHover(null)}
                            />
                          </g>
                        ))}
                        {previousPoints.map((p, i) => (
                          <g key={`prev-${i}`}>
                            <circle cx={p.x} cy={p.y} r="2.5" fill="#888" />
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r="8"
                              fill="transparent"
                              onMouseEnter={() => setTrendHover({
                                x: p.x,
                                y: p.y - 12,
                                label: trendSeries[i].label,
                                current: trendSeries[i].current,
                                previous: trendSeries[i].previous,
                              })}
                              onMouseLeave={() => setTrendHover(null)}
                            />
                          </g>
                        ))}
                      </>
                    )}

                    {trendSeries.map((p, i) => {
                      const x = padding.left + step * i + step / 2;
                      const hideDense = period === 'month' && i % 3 !== 0;
                      if (hideDense) return null;

                      return (
                        <text key={`lbl-${p.label}-${i}`} x={x} y={chartHeight - 14} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: '#666' }}>
                          {p.label}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              )}

              {trendHover && (
                <div
                  className="chart-tooltip"
                  style={{
                    left: Math.max(8, Math.min(chartWidth - 190, trendHover.x - 84)),
                    top: Math.max(6, trendHover.y - 64),
                  }}
                >
                  <div className="chart-tooltip-title">{trendHover.label}</div>
                  <div className="chart-tooltip-row">
                    <span>Current</span>
                    <strong>₹{Math.round(trendHover.current).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="chart-tooltip-row">
                    <span>Prev year</span>
                    <strong>₹{Math.round(trendHover.previous).toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="panel mb-6">
            <div className="panel-header"><div className="panel-title">Value Share by Leads</div></div>
            <div className="panel-body" style={{ position: 'relative' }}>
              {valueShare.total <= 0 ? (
                <div className="empty-state" style={{ padding: '22px 0' }}>No deal values yet.</div>
              ) : (
                <>
                  <div className="donut-wrap">
                    <svg width="220" height="220" viewBox="0 0 220 220" role="img" aria-label="Lead value share pie chart">
                      <g transform="translate(110 110)">
                        {pieSlices.map(slice => (
                          <path
                            key={slice.name}
                            className="pie-slice"
                            d={donutSlicePath(0, 0, 90, 44, slice.start, slice.end)}
                            fill={slice.color}
                            onMouseEnter={() => setPieHover({
                              name: slice.name,
                              value: slice.value,
                              pct: slice.pct,
                              color: slice.color,
                            })}
                            onMouseLeave={() => setPieHover(null)}
                          />
                        ))}
                        <circle cx="0" cy="0" r="44" fill="var(--white)" stroke="var(--black)" strokeWidth="2" />
                        <text x="0" y="-4" textAnchor="middle" style={{ fontSize: 10, fontFamily: 'var(--mono)', fill: '#666' }}>TOTAL</text>
                        <text x="0" y="16" textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: '#0a0a0a' }}>{formatMoneyShort(valueShare.total)}</text>
                      </g>
                    </svg>
                  </div>

                  <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
                    {pieSlices.map((slice) => {
                      const pct = slice.pct.toFixed(1);
                      const color = slice.color;
                      return (
                        <div
                          key={slice.name}
                          className="pie-legend-row"
                          onMouseEnter={() => setPieHover({ name: slice.name, value: slice.value, pct: slice.pct, color: slice.color })}
                          onMouseLeave={() => setPieHover(null)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span className="legend-dot" style={{ background: color }} />
                            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slice.name}</span>
                          </div>
                          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--gray4)' }}>
                            {pct}% · ₹{slice.value.toLocaleString('en-IN')}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {pieHover && (
                    <div className="chart-tooltip" style={{ right: 10, top: 12, left: 'auto', minWidth: 190 }}>
                      <div className="chart-tooltip-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="legend-dot" style={{ background: pieHover.color }} />
                        {pieHover.name}
                      </div>
                      <div className="chart-tooltip-row">
                        <span>Share</span>
                        <strong>{pieHover.pct.toFixed(1)}%</strong>
                      </div>
                      <div className="chart-tooltip-row">
                        <span>Value</span>
                        <strong>₹{Math.round(pieHover.value).toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid-3">
          {/* Top Leads */}
          <div className="panel mb-6">
            <div className="panel-header">
              <div className="panel-title">Top Leads by AI Score</div>
              <a href="/leads" style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>VIEW ALL →</a>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th><th>Score</th><th>Stage</th><th>Sentiment</th><th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {top_leads.map(l => <LeadRow key={l.id} lead={l} compact />)}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sentiment dist */}
          <div className="panel mb-6">
            <div className="panel-header"><div className="panel-title">Sentiment Mix</div></div>
            <div className="panel-body">
              {(['Positive', 'Neutral', 'Negative'] as const).map(s => {
                const pct = Math.round((sent[s] / sentTotal) * 100);
                const color = s === 'Positive' ? 'var(--green)' : s === 'Negative' ? 'var(--accent)' : 'var(--yellow)';
                return (
                  <div key={s} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: 'var(--mono)', marginBottom: 6 }}>
                      <span style={{ color: 'var(--gray4)' }}>{s}</span>
                      <span style={{ fontWeight: 600, color }}>{pct}% ({sent[s]})</span>
                    </div>
                    <div style={{ height: 10, background: '#e0ddd6', border: '1px solid #ccc', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.6s' }} />
                    </div>
                  </div>
                );
              })}

              <div style={{ marginTop: 24, borderTop: '1.5px solid #e0ddd6', paddingTop: 16 }}>
                <div className="panel-title" style={{ marginBottom: 12 }}>At-Risk Accounts</div>
                {at_risk.length === 0
                  ? <div className="empty-state">No at-risk accounts 🎉</div>
                  : at_risk.slice(0, 3).map(l => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div className="avatar" style={{ width: 30, height: 30, background: 'var(--accent)', color: 'white', fontSize: 10 }}>
                        {l.name.split(' ').map(x => x[0]).join('')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{l.name}</div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--gray4)' }}>{l.company}</div>
                      </div>
                      <div style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>
                        {l.churn_risk_pct}%
                      </div>
                    </div>
                  ))
                }
                {at_risk.length > 0 && (
                  <a href="/churn" className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                    View All At-Risk →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights panel */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">✦ AI Quick Insights</div>
            <span className="notif-badge" style={{ fontSize: 10, padding: '2px 8px' }}>LIVE</span>
          </div>
          <div className="panel-body">
            {top_leads[0] && (
              <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1.5px solid #e0ddd6' }}>
                <div className="avatar" style={{ width: 22, height: 22, background: 'var(--black)', color: 'var(--accent)', fontSize: 11 }}>✦</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Lead <strong>{top_leads[0].name}</strong> (Score: {top_leads[0].ai_score}) hasn't been contacted in{' '}
                  {top_leads[0].days_since_contact ?? '?'} days — high conversion probability window may be closing.
                </div>
              </div>
            )}
            {at_risk.length > 0 && (
              <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1.5px solid #e0ddd6' }}>
                <div className="avatar" style={{ width: 22, height: 22, background: 'var(--black)', color: 'var(--accent)', fontSize: 11 }}>✦</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  <strong>{at_risk.length} accounts</strong> are flagged as churn risk. Highest risk:{' '}
                  <strong>{at_risk[0]?.name}</strong> at {at_risk[0]?.churn_risk_pct}%. Consider immediate outreach.
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, padding: '12px 0' }}>
              <div className="avatar" style={{ width: 22, height: 22, background: 'var(--black)', color: 'var(--accent)', fontSize: 11 }}>✦</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                Pipeline value is <strong>₹{(kpis.pipeline_value / 100000).toFixed(1)}L</strong> with a{' '}
                <strong>{kpis.conversion_rate}%</strong> conversion rate. 
                {' '}<a href="/assistant" style={{ color: 'var(--accent)', fontWeight: 700 }}>Ask AI Assistant for deeper analysis →</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
