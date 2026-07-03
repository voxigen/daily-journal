'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import LogoIcon from '@/components/LogoIcon';

type Mode = 'login' | 'register' | 'magic';

const SUBTITLES: Record<Mode, string> = {
  login: 'Вход в дневник',
  register: 'Создать аккаунт',
  magic: 'Вход по ссылке на почту',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const router = useRouter();
  const supabase = createClient();

  // The auth callback bounces here with ?error=link when the emailed link is bad/expired.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'link') {
      setMode('magic');
      setError('Ссылка не сработала или устарела — запроси новую.');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSent(false);
    setLoading(true);

    if (mode === 'magic') {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setLoading(false);
      if (err) { setError(err.message); return; }
      setSent(true);
      return;
    }

    const { error: err } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (mode === 'register') {
      setError('');
      alert('Проверь почту — нужно подтвердить аккаунт, затем войди.');
      setMode('login');
      return;
    }
    router.push('/');
    router.refresh();
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setSent(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="auth-brand"><LogoIcon /></span>
        <h1 className="auth-title">Daily Journal</h1>
        <p className="auth-sub">{SUBTITLES[mode]}</p>

        {error && <div className="error-msg">{error}</div>}
        {sent && (
          <div className="info-msg">
            Ссылка отправлена на {email}. Открой письмо на этом же устройстве и в этом же браузере.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          {mode !== 'magic' && (
            <div className="auth-field">
              <label>Пароль</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
          )}
          <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 6 }}>
            {loading ? 'Загрузка…' : mode === 'login' ? 'Войти' : mode === 'register' ? 'Зарегистрироваться' : sent ? 'Отправить ещё раз' : 'Отправить ссылку'}
          </button>
        </form>

        {mode !== 'magic' && (
          <button className="auth-switch" onClick={() => switchMode('magic')}>
            Войти без пароля — по ссылке на почту
          </button>
        )}
        {mode !== 'login' && (
          <button className="auth-switch" onClick={() => switchMode('login')}>
            Войти с паролем
          </button>
        )}
        {mode === 'login' && (
          <button className="auth-switch" onClick={() => switchMode('register')}>
            Нет аккаунта? Зарегистрироваться
          </button>
        )}
      </div>
    </div>
  );
}
