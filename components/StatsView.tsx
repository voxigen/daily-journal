'use client';

import { useMemo } from 'react';
import AppShell from './AppShell';
import TemplateIcon from './TemplateIcon';
import { formatDuration, formatDateShort, addDays, mondayIndex, MONTHS_RU } from '@/lib/utils';
import { Flame, Clock, ListChecks, TrendingUp, ChartColumnBig, PieChart, CalendarDays, Scale } from 'lucide-react';

type TaskRow = {
  date: string;
  template_name?: string | null;
  template_color?: string | null;
  template_icon?: string | null;
  duration_minutes?: number | null;
};

type Props = { today: string; tasks: TaskRow[]; dayDates: string[]; kcalByDate?: Record<string, number>; weightByDate?: Record<string, number> };
type Cat = { name: string; color: string; icon: string; m: number; c: number };

const HEAT_WEEKS = 27;
const NO_CAT = 'Без категории';
// Weight line chart geometry (viewBox units)
const WC_W = 560, WC_H = 150, WC_M = 10;

export default function StatsView({ today, tasks, dayDates, kcalByDate = {}, weightByDate = {} }: Props) {
  const d = useMemo(() => {
    const byDay = new Map<string, { m: number; c: number }>();
    for (const t of tasks) {
      const cur = byDay.get(t.date) ?? { m: 0, c: 0 };
      cur.m += t.duration_minutes ?? 0;
      cur.c += 1;
      byDay.set(t.date, cur);
    }
    const active = new Set<string>([...Array.from(byDay.keys()), ...dayDates]);

    // streak (allow today to be empty if yesterday is active)
    let streak = 0;
    let cursor = active.has(today) ? today : addDays(today, -1);
    while (active.has(cursor)) { streak++; cursor = addDays(cursor, -1); }

    // totals
    let totalM = 0, totalC = 0;
    byDay.forEach((v) => { totalM += v.m; totalC += v.c; });

    // last 7 days
    let weekM = 0, weekC = 0;
    for (let i = 0; i < 7; i++) {
      const v = byDay.get(addDays(today, -i));
      if (v) { weekM += v.m; weekC += v.c; }
    }

    const activeDays = active.size;
    const avgM = activeDays ? Math.round(totalM / activeDays) : 0;

    // categories
    const catMap = new Map<string, Cat>();
    for (const t of tasks) {
      const key = t.template_name ?? NO_CAT;
      const cur = catMap.get(key) ?? {
        name: key,
        color: t.template_color ?? '#5a63d8',
        icon: t.template_icon ?? '',
        m: 0, c: 0,
      };
      cur.m += t.duration_minutes ?? 0;
      cur.c += 1;
      catMap.set(key, cur);
    }
    const cats = Array.from(catMap.values()).sort((a, b) => (b.m - a.m) || (b.c - a.c));
    const catTotalM = cats.reduce((s, c) => s + c.m, 0);
    const catTotalC = cats.reduce((s, c) => s + c.c, 0);
    const useTime = catTotalM > 0;

    // donut: top 6 + Другое
    const donutBase = useTime ? catTotalM : catTotalC;
    const val = (c: Cat) => (useTime ? c.m : c.c);
    let donut = cats.map((c) => ({ name: c.name, color: c.color, icon: c.icon, value: val(c) }));
    if (donut.length > 6) {
      const head = donut.slice(0, 6);
      const restVal = donut.slice(6).reduce((s, c) => s + c.value, 0);
      donut = [...head, { name: 'Другое', color: '#8b909a', icon: '', value: restVal }];
    }

    // last 14 days bars
    const bars: { date: string; m: number; c: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = addDays(today, -i);
      const v = byDay.get(date);
      bars.push({ date, m: v?.m ?? 0, c: v?.c ?? 0 });
    }
    const barMaxM = Math.max(1, ...bars.map((b) => b.m));
    const barMaxC = Math.max(1, ...bars.map((b) => b.c));
    const barsUseTime = bars.some((b) => b.m > 0);

    // heatmap: HEAT_WEEKS columns ending this week
    const startMon = addDays(today, -(mondayIndex(today) + (HEAT_WEEKS - 1) * 7));
    const cells: { date: string; level: number; future: boolean; m: number; c: number }[] = [];
    const monthLabels: { col: number; label: string }[] = [];
    let prevMonth = -1;
    for (let col = 0; col < HEAT_WEEKS; col++) {
      const colDate = addDays(startMon, col * 7);
      const month = new Date(colDate + 'T12:00:00').getMonth();
      if (month !== prevMonth) { monthLabels.push({ col, label: MONTHS_RU[month] }); prevMonth = month; }
      for (let row = 0; row < 7; row++) {
        const date = addDays(startMon, col * 7 + row);
        const future = date > today;
        const v = byDay.get(date);
        const score = v ? (v.m > 0 ? v.m : v.c * 30) : (active.has(date) ? 15 : 0);
        const level = score === 0 ? 0 : score < 30 ? 1 : score < 90 ? 2 : score < 180 ? 3 : 4;
        cells.push({ date, level, future, m: v?.m ?? 0, c: v?.c ?? 0 });
      }
    }

    // calories: last 14 days + average over all logged days
    const kcalBars: { date: string; kcal: number }[] = [];
    for (let i = 13; i >= 0; i--) { const date = addDays(today, -i); kcalBars.push({ date, kcal: kcalByDate[date] ?? 0 }); }
    const kcalMax = Math.max(1, ...kcalBars.map((b) => b.kcal));
    const kcalVals = Object.values(kcalByDate);
    const kcalAvg = kcalVals.length ? Math.round(kcalVals.reduce((s, v) => s + v, 0) / kcalVals.length) : 0;
    const kcalToday = kcalByDate[today] ?? 0;
    const kcalHas = kcalVals.length > 0;

    // weight trend: entries from the last 90 days (fall back to the newest
    // entries when tracking is sparse), time-scaled x, padded min/max y.
    const wEntries = Object.entries(weightByDate)
      .map(([date, w]) => ({ date, w }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    let wWin = wEntries.filter((e) => e.date >= addDays(today, -89));
    if (wWin.length < 2) wWin = wEntries.slice(-30);
    const wHas = wEntries.length > 0;
    const wLast = wHas ? wEntries[wEntries.length - 1].w : 0;
    let wMin = 0, wMax = 0;
    let wDelta: number | null = null;
    let wPts: { x: number; y: number; date: string; w: number }[] = [];
    if (wWin.length > 0) {
      wMin = Math.min(...wWin.map((e) => e.w));
      wMax = Math.max(...wWin.map((e) => e.w));
      if (wWin.length >= 2) wDelta = Math.round((wWin[wWin.length - 1].w - wWin[0].w) * 10) / 10;
      const pad = Math.max(0.4, (wMax - wMin) * 0.15);
      const lo = wMin - pad, hi = wMax + pad;
      const t0 = new Date(wWin[0].date + 'T12:00:00').getTime();
      const span = Math.max(1, new Date(wWin[wWin.length - 1].date + 'T12:00:00').getTime() - t0);
      wPts = wWin.map((e) => ({
        x: Math.round((WC_M + ((new Date(e.date + 'T12:00:00').getTime() - t0) / span) * (WC_W - 2 * WC_M)) * 10) / 10,
        y: Math.round((WC_M + (1 - (e.w - lo) / (hi - lo)) * (WC_H - 2 * WC_M)) * 10) / 10,
        date: e.date, w: e.w,
      }));
    }
    const wFirstDate = wWin[0]?.date ?? '';
    const wLastDate = wWin[wWin.length - 1]?.date ?? '';

    return {
      streak, totalM, totalC, weekM, weekC, activeDays, avgM,
      cats, catTotalM, catTotalC, useTime, donut, donutBase,
      bars, barMaxM, barMaxC, barsUseTime, cells, monthLabels,
      kcalBars, kcalMax, kcalAvg, kcalToday, kcalHas,
      wHas, wLast, wMin, wMax, wDelta, wPts, wFirstDate, wLastDate,
      hasData: tasks.length > 0 || dayDates.length > 0,
    };
  }, [tasks, dayDates, today, kcalByDate, weightByDate]);

  if (!d.hasData) {
    return (
      <AppShell title="Статистика">
        <div className="empty">
          <div className="empty-icon"><ChartColumnBig /></div>
          <div className="empty-title">Пока нечего показывать</div>
          <p>Записывай дела, и здесь появятся графики времени, категорий и активности</p>
        </div>
      </AppShell>
    );
  }

  // donut geometry
  const R = 54, SW = 16, C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <AppShell title="Статистика">
      {/* Key metrics */}
      <div className="metrics metrics-4">
        <div className="metric">
          <div className="metric-ico"><Flame className="icon-sm" style={{ color: 'var(--amber)' }} /></div>
          <div className="metric-val">{d.streak}</div>
          <div className="metric-lbl">{d.streak === 1 ? 'день подряд' : 'дней подряд'}</div>
        </div>
        <div className="metric">
          <div className="metric-ico"><Clock className="icon-sm" style={{ color: 'var(--accent)' }} /></div>
          <div className="metric-val">{d.weekM ? formatDuration(d.weekM) : '—'}</div>
          <div className="metric-lbl">за неделю</div>
        </div>
        <div className="metric">
          <div className="metric-ico"><ListChecks className="icon-sm" style={{ color: 'var(--green)' }} /></div>
          <div className="metric-val">{d.totalC}</div>
          <div className="metric-lbl">дел всего</div>
        </div>
        <div className="metric">
          <div className="metric-ico"><TrendingUp className="icon-sm" style={{ color: 'var(--blue)' }} /></div>
          <div className="metric-val">{d.avgM ? formatDuration(d.avgM) : '—'}</div>
          <div className="metric-lbl">в среднем за день</div>
        </div>
      </div>

      {/* Bars: last 14 days */}
      <div className="section">
        <div className="section-head"><span className="section-label"><ChartColumnBig /> Активность за 14 дней</span></div>
        <div className="chart-card">
          <div className="bars">
            {d.bars.map((b) => {
              const pct = d.barsUseTime ? (b.m / d.barMaxM) : (b.c / d.barMaxC);
              const h = b.m || b.c ? Math.max(4, Math.round(pct * 100)) : 0;
              const tip = `${formatDateShort(b.date)}: ${b.c} дел${b.m ? ', ' + formatDuration(b.m) : ''}`;
              return (
                <div className="bar-col" key={b.date} title={tip}>
                  <div className="bar-track">
                    <div className="bar" style={{ height: `${h}%` }} />
                  </div>
                  <div className="bar-lbl">{b.date.slice(8)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Calories: last 14 days */}
      {d.kcalHas && (
        <div className="section">
          <div className="section-head">
            <span className="section-label"><Flame /> Калории за 14 дней</span>
            <span className="section-aside">≈ {d.kcalAvg} ккал/день</span>
          </div>
          <div className="chart-card">
            <div className="field-stats">
              <div className="field-stat"><span className="v">{d.kcalToday}</span><span className="l">сегодня</span></div>
              <div className="field-stat"><span className="v">{d.kcalAvg}</span><span className="l">среднее/день</span></div>
            </div>
            <div className="bars">
              {d.kcalBars.map((b) => {
                const h = b.kcal ? Math.max(4, Math.round((b.kcal / d.kcalMax) * 100)) : 0;
                const tip = `${formatDateShort(b.date)}: ${b.kcal} ккал`;
                return (
                  <div className="bar-col" key={b.date} title={tip}>
                    <div className="bar-track"><div className="bar" style={{ height: `${h}%`, background: 'var(--amber)' }} /></div>
                    <div className="bar-lbl">{b.date.slice(8)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Weight trend */}
      {d.wHas && (
        <div className="section">
          <div className="section-head">
            <span className="section-label"><Scale /> Вес</span>
            {d.wDelta != null && (
              <span className="section-aside">{d.wDelta > 0 ? '+' : ''}{d.wDelta} кг за период</span>
            )}
          </div>
          <div className="chart-card">
            <div className="field-stats">
              <div className="field-stat"><span className="v">{d.wLast}</span><span className="l">сейчас, кг</span></div>
              {d.wDelta != null && (
                <div className="field-stat"><span className="v">{d.wDelta > 0 ? '+' : ''}{d.wDelta}</span><span className="l">за период, кг</span></div>
              )}
              <div className="field-stat"><span className="v">{d.wMin}–{d.wMax}</span><span className="l">мин–макс, кг</span></div>
            </div>
            {d.wPts.length >= 2 && (
              <>
                <svg className="wchart" viewBox={`0 0 ${WC_W} ${WC_H}`}>
                  <defs>
                    <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.26" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon
                    fill="url(#wgrad)"
                    points={`${d.wPts[0].x},${WC_H - 4} ${d.wPts.map((p) => `${p.x},${p.y}`).join(' ')} ${d.wPts[d.wPts.length - 1].x},${WC_H - 4}`}
                  />
                  <polyline
                    fill="none" stroke="var(--accent)" strokeWidth="2.5"
                    strokeLinejoin="round" strokeLinecap="round"
                    points={d.wPts.map((p) => `${p.x},${p.y}`).join(' ')}
                  />
                  {d.wPts.map((p) => (
                    <circle key={p.date} cx={p.x} cy={p.y} r="3.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.5">
                      <title>{`${formatDateShort(p.date)}: ${p.w} кг`}</title>
                    </circle>
                  ))}
                </svg>
                <div className="wchart-x">
                  <span>{formatDateShort(d.wFirstDate)}</span>
                  <span>{formatDateShort(d.wLastDate)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Donut by category */}
      <div className="section">
        <div className="section-head"><span className="section-label"><PieChart /> Распределение по категориям</span></div>
        <div className="chart-card donut-card">
          <svg className="donut" viewBox="0 0 140 140" width="140" height="140">
            <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-3)" strokeWidth={SW} />
            {d.donut.map((s, i) => {
              const frac = d.donutBase ? s.value / d.donutBase : 0;
              const dash = frac * C;
              const el = (
                <circle
                  key={i} cx="70" cy="70" r={R} fill="none"
                  stroke={s.color} strokeWidth={SW}
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-acc}
                  transform="rotate(-90 70 70)"
                  strokeLinecap="butt"
                />
              );
              acc += dash;
              return el;
            })}
            <text x="70" y="64" textAnchor="middle" className="donut-c1">
              {d.useTime ? formatDuration(d.catTotalM) : d.catTotalC}
            </text>
            <text x="70" y="82" textAnchor="middle" className="donut-c2">
              {d.useTime ? 'всего' : 'дел'}
            </text>
          </svg>
          <div className="legend">
            {d.donut.map((s, i) => {
              const frac = d.donutBase ? Math.round((s.value / d.donutBase) * 100) : 0;
              return (
                <div className="legend-row" key={i}>
                  <span className="legend-dot" style={{ background: s.color }} />
                  <span className="legend-name">{s.name}</span>
                  <span className="legend-val">{frac}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="section">
        <div className="section-head"><span className="section-label"><CalendarDays /> Карта активности</span></div>
        <div className="chart-card">
          <div className="heat-scroll">
            <div className="heat-inner">
              <div className="heat-months" style={{ gridTemplateColumns: `repeat(${HEAT_WEEKS}, 13px)` }}>
                {d.monthLabels.map((m) => (
                  <span key={m.col} className="heat-month" style={{ gridColumnStart: m.col + 1 }}>{m.label}</span>
                ))}
              </div>
              <div className="heat" style={{ gridTemplateColumns: `repeat(${HEAT_WEEKS}, 13px)` }}>
                {d.cells.map((cell, i) => (
                  <span
                    key={i}
                    className={`heat-cell l${cell.level}${cell.future ? ' future' : ''}`}
                    title={cell.future ? '' : `${formatDateShort(cell.date)}: ${cell.c} дел${cell.m ? ', ' + formatDuration(cell.m) : ''}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="heat-legend">
            <span>меньше</span>
            <span className="heat-cell l0" /><span className="heat-cell l1" /><span className="heat-cell l2" /><span className="heat-cell l3" /><span className="heat-cell l4" />
            <span>больше</span>
          </div>
        </div>
      </div>

      {/* Top categories */}
      <div className="section">
        <div className="section-head"><span className="section-label"><ListChecks /> Топ категорий</span></div>
        <div className="cat-list">
          {d.cats.map((c) => {
            const v = d.useTime ? c.m : c.c;
            const base = d.useTime ? (d.cats[0]?.m || 1) : (d.cats[0]?.c || 1);
            const pct = Math.max(3, Math.round((v / base) * 100));
            return (
              <div className="cat-row" key={c.name}>
                <span className="cat-icon">{c.icon ? <TemplateIcon icon={c.icon} color={c.color} /> : '•'}</span>
                <div className="cat-body">
                  <div className="cat-top">
                    <span className="cat-name">{c.name}</span>
                    <span className="cat-val">{c.m ? formatDuration(c.m) : `${c.c} дел`}</span>
                  </div>
                  <div className="cat-bar-track">
                    <div className="cat-bar" style={{ width: `${pct}%`, background: c.color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
