'use client';

import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
    { href: '/',           icon: '📓', label: 'Сегодня'  },
    { href: '/history',    icon: '📅', label: 'История'  },
    { href: '/templates',  icon: '🗂️', label: 'Шаблоны'  },
  ];

  return (
    <div className="app-wrap">
      <header className="app-header">
        <div className="header-left">
          <h1>Daily Journal</h1>
          {date && <div className="header-date">{date}</div>}
        </div>
        <button className="logout-btn" onClick={logout}>Выйти</button>
      </header>

      <main className="app-content">{children}</main>

      <nav className="bottom-nav">
        {nav.map((item) => (
          <button
            key={item.href}
            className={`nav-item${pathname === item.href ? ' active' : ''}`}
            onClick={() => router.push(item.href)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
