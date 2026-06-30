'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { NotebookPen, CalendarDays, LayoutGrid, LogOut } from 'lucide-react';

type Props = { children: React.ReactNode; date?: string };

export default function AppShell({ children, date }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const nav = [
    { href: '/',          Icon: NotebookPen,  label: 'Сегодня', match: (p: string) => p === '/' || p.startsWith('/day') },
    { href: '/history',   Icon: CalendarDays, label: 'История', match: (p: string) => p === '/history' },
    { href: '/templates', Icon: LayoutGrid,   label: 'Шаблоны', match: (p: string) => p === '/templates' },
  ];

  return (
    <div className="app-wrap">
      <header className="app-header">
        <div className="header-left">
          <span className="header-mark"><NotebookPen /></span>
          <div className="header-titles">
            <h1>Daily Journal</h1>
            {date && <div className="header-date">{date}</div>}
          </div>
        </div>
        <button className="logout-btn" onClick={logout} aria-label="Выйти">
          <LogOut className="icon" />
        </button>
      </header>

      <main className="app-content">{children}</main>

      <nav className="bottom-nav">
        {nav.map(({ href, Icon, label, match }) => (
          <button
            key={href}
            className={`nav-item${match(pathname) ? ' active' : ''}`}
            onClick={() => router.push(href)}
          >
            <Icon />
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
