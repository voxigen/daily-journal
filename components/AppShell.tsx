'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Props = {
  children: React.ReactNode;
  activeTab: 'today' | 'history';
  date: string;
};

export default function AppShell({ children, activeTab, date }: Props) {
  const router = useRouter();
  const supabase = createClient();

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <header className="app-header">
        <div>
          <h1>📓 Journal</h1>
          <div className="header-date">{date}</div>
        </div>
        <button className="logout-btn" onClick={logout}>Выйти</button>
      </header>

      <nav className="nav-tabs">
        <button
          className={`nav-tab${activeTab === 'today' ? ' active' : ''}`}
          onClick={() => router.push('/')}
        >
          Сегодня
        </button>
        <button
          className={`nav-tab${activeTab === 'history' ? ' active' : ''}`}
          onClick={() => router.push('/history')}
        >
          История
        </button>
      </nav>

      {children}
    </>
  );
}
