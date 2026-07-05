'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from './AppShell';
import TemplateIcon from './TemplateIcon';
import { formatDuration, formatDateShort } from '@/lib/utils';
import { ChevronLeft, Clock, Hash, CalendarClock, TrendingUp, ChartColumnBig, ListChecks } from 'lucide-react';

type Field = { name: string; placeholder: string; type: string };
type Template = { id: string; name: string; color: string; icon: string; fields: Field[] };
type TaskLite = {
  date: string;
  title: string;
  duration_minutes?: number | null;
  fields_data?: Record<string, string> | null;
  created_at?: string;
};

type Props = { template: Template; tasks: TaskLite[]; today: string };

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000);
}

function relativeDay(date: string, today: string): string {
  const diff = daysBetween(date, today);
  if (diff <= 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 7) return `${diff} дн. назад`;
  return formatDateShort(date);
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Sparkline({ series, color }: { series: { label: string; value: number }[]; color: string }) {
  const W = 320, H = 120, padX = 8, padTop = 16, padBottom = 22;
  const vals = series.map((s) => s.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const n = series.length;
  const x = (i: number) => (n === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1));
  const y = (v: number) => padTop + (1 - (v - min) / range) * (H - padTop - padBottom);
  const base = H - padBottom;

  const pts = series.map((s, i) => `${x(i).toFixed(1)},${y(s.value).toFixed(1)}`);
  const linePath = pts.map((p, i) => (i === 0 ? `M${p}` : `L${p}`)).join(' ');
  const areaPath = `M${x(0).toFixed(1)},${base} ${pts.map((p) => `L${p}`).join(' ')} L${x(n - 1).toFixed(1)},${base} Z`;

  const lastI = n - 1;

  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img">
      <line x1={padX} y1={base} x2={W - padX} y2={base} stroke="var(--border)" strokeWidth="1" />
      {n > 1 && <path d={areaPath} fill={color} opacity="0.12" />}
      {n > 1 && <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {series.map((s, i) => (
        <circle key={i} cx={x(i)} cy={y(s.value)} r={i === lastI ? 4.5 : 3} fill={i === lastI ? color : 'var(--surface)'} stroke={color} strokeWidth="2" />
      ))}
      <text x={padX} y={H - 6} className="spark-axis" textAnchor="start">{series[0]?.label}</text>
      {n > 1 && <text x={W - padX} y={H - 6} className="spark-axis" textAnchor="end">{series[lastI]?.label}</text>}
    </svg>
  );
}

export default function TemplateDashboard({ template, tasks, today }: Props) {
  const router = useRouter();
  const color = template.color || 'var(--accent)';

  const d = useMemo(() => {
    const count = tasks.length;
    let totalM = 0;
    for (const t of tasks) totalM += t.duration_minutes ?? 0;
    const avgM = count ? Math.round(totalM / count) : 0;
    const last30 = tasks.filter((t) => daysBetween(t.date, today) < 30 && daysBetween(t.date, today) >= 0).length;
    const lastDate = tasks.length ? tasks[tasks.length - 1].date : null;

    // session-time bars (last 14 with duration)
    const withTime = tasks.filter((t) => (t.duration_minutes ?? 0) > 0).slice(-14);
    const barMax = Math.max(1, ...withTime.map((t) => t.duration_minutes ?? 0));

    // numeric field series
    const numericFields = template.fields.filter((f) => f.type === 'number');
    const fieldSeries = numericFields.map((f) => {
      const series: { label: string; value: number }[] = [];
      for (const t of tasks) {
        const raw = t.fields_data?.[f.name];
        const v = raw != null && raw !== '' ? parseFloat(raw.replace(',', '.')) : NaN;
        if (!Number.isNaN(v)) series.push({ label: formatDateShort(t.date), value: v });
      }
      const vals = series.map((s) => s.value);
      return {
        field: f,
        series,
        latest: vals.length ? vals[vals.length - 1] : null,
        avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
        max: vals.length ? Math.max(...vals) : null,
        min: vals.length ? Math.min(...vals) : null,
      };
    }).filter((fs) => fs.series.length > 0);

    const recent = [...tasks].reverse().slice(0, 25);

    return { count, totalM, avgM, last30, lastDate, withTime, barMax, fieldSeries, recent };
  }, [tasks, template, today]);

  return (
    <AppShell title={template.name}>
      <button className="back-link" onClick={() => router.push('/templates')}>
        <ChevronLeft /> Шаблоны
      </button>

      <div className="dash-hero">
        <span className="dash-hero-icon" style={{ background: `${color}1f` }}><TemplateIcon icon={template.icon} color={color} /></span>
        <div>
          <div className="dash-hero-name" style={{ color }}>{template.name}</div>
          <div className="dash-hero-meta">
            {template.fields.length ? template.fields.map((f) => f.name).join(' · ') : 'Без полей'}
          </div>
        </div>
      </div>

      {d.count === 0 ? (
        <div className="empty">
          <div className="empty-icon"><ChartColumnBig /></div>
          <div className="empty-title">Пока нет записей</div>
          <p>Добавь дело по этому шаблону на вкладке «Сегодня», и здесь появится статистика</p>
        </div>
      ) : (
        <>
          <div className="metrics metrics-4">
            <div className="metric">
              <div className="metric-ico"><Hash className="icon-sm" style={{ color }} /></div>
              <div className="metric-val">{d.count}</div>
              <div className="metric-lbl">всего раз</div>
            </div>
            <div className="metric">
              <div className="metric-ico"><Clock className="icon-sm" style={{ color: 'var(--accent)' }} /></div>
              <div className="metric-val">{d.totalM ? formatDuration(d.totalM) : '—'}</div>
              <div className="metric-lbl">всего времени</div>
            </div>
            <div className="metric">
              <div className="metric-ico"><TrendingUp className="icon-sm" style={{ color: 'var(--green)' }} /></div>
              <div className="metric-val">{d.avgM ? formatDuration(d.avgM) : '—'}</div>
              <div className="metric-lbl">в среднем за раз</div>
            </div>
            <div className="metric">
              <div className="metric-ico"><CalendarClock className="icon-sm" style={{ color: 'var(--blue)' }} /></div>
              <div className="metric-val">{d.last30}</div>
              <div className="metric-lbl">за 30 дней</div>
            </div>
          </div>

          {d.withTime.length > 0 && (
            <div className="section">
              <div className="section-head"><span className="section-label"><ChartColumnBig /> Время по записям</span></div>
              <div className="chart-card">
                <div className="bars">
                  {d.withTime.map((t, i) => {
                    const h = Math.max(4, Math.round(((t.duration_minutes ?? 0) / d.barMax) * 100));
                    return (
                      <div className="bar-col" key={i} title={`${formatDateShort(t.date)}: ${formatDuration(t.duration_minutes ?? 0)}`}>
                        <div className="bar-track"><div className="bar" style={{ height: `${h}%`, background: color }} /></div>
                        <div className="bar-lbl">{t.date.slice(8)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {d.fieldSeries.map((fs) => (
            <div className="section" key={fs.field.name}>
              <div className="section-head"><span className="section-label"><TrendingUp /> {fs.field.name}</span></div>
              <div className="chart-card">
                <div className="field-stats">
                  <div className="field-stat"><span className="v">{fs.latest != null ? fmtNum(fs.latest) : '—'}</span><span className="l">текущее</span></div>
                  <div className="field-stat"><span className="v">{fs.avg != null ? fmtNum(fs.avg) : '—'}</span><span className="l">среднее</span></div>
                  <div className="field-stat"><span className="v">{fs.max != null ? fmtNum(fs.max) : '—'}</span><span className="l">максимум</span></div>
                </div>
                {fs.series.length > 1 ? (
                  <Sparkline series={fs.series} color={color} />
                ) : (
                  <div className="spark-single">Пока одна запись. График появится после второй</div>
                )}
              </div>
            </div>
          ))}

          <div className="section">
            <div className="section-head"><span className="section-label"><ListChecks /> Записи</span></div>
            <div className="task-list">
              {d.recent.map((t, i) => {
                const fields = t.fields_data ? Object.entries(t.fields_data).filter(([, v]) => v) : [];
                return (
                  <div className="task-row clickable" key={i} onClick={() => router.push(`/day/${t.date}`)}>
                    <span className="task-dot" style={{ background: color }} />
                    <div className="task-body">
                      <div className="task-top">
                        <span className="task-title">{t.title}</span>
                        <span className="entry-date">{relativeDay(t.date, today)}</span>
                      </div>
                      {fields.length > 0 && (
                        <div className="task-sub">
                          {fields.map(([k, v]) => (
                            <span key={k} className="task-field"><b>{k}:</b> {v}</span>
                          ))}
                        </div>
                      )}
                      {t.duration_minutes ? (
                        <span className="task-time"><Clock /> {formatDuration(t.duration_minutes)}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
