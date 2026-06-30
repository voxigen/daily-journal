'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { NotebookPen, CalendarDays, LayoutGrid, LogOut, ChartColumnBig } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

type Props = { children: React.ReactNode; title?: string; subtitle?: string };

const NAV = [
  { href: '/',          Icon: NotebookPen,    label: 'Сегодня',    match: (p: string) => p === '/' || p.startsWith('/day') },
  { href: '/history',   Icon: CalendarDays,   label: 'История',    match: (p: string) => p === '/history' },
  { href: '/stats',     Icon: ChartColumnBig, label: 'Статистика', match: (p: string) => p === '/stats' },
  { href: '/templates', Icon: LayoutGrid,     label: 'Шаблоны',    match: (p: string) => p === '/templates' },
];

export default function AppShell({ children, title, subtitle }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark"><NotebookPen /></span>
          <span className="brand-name">Journal</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ href, Icon, label, match }) => (
            <button key={href} className={`side-link${match(pathname) ? ' active' : ''}`} onClick={() => router.push(href)}>
              <Icon /> {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="side-link" onClick={logout}><LogOut /> Выйти</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            {title && <h1>{title}</h1>}
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <div className="topbar-mobile-brand">
            <span className="brand-mark"><NotebookPen /></span>
            <span className="brand-name">{title ?? 'Journal'}</span>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <button className="icon-btn" onClick={logout} aria-label="Выйти"><LogOut className="icon" /></button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      <nav className="tabbar">
        {NAV.map(({ href, Icon, label, match }) => (
          <button key={href} className={`tab-link${match(pathname) ? ' active' : ''}`} onClick={() => router.push(href)}>
            <Icon />
            <span className="tab-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
