'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetPassword } from '@/app/actions/auth';
import LogoIcon from '@/components/LogoIcon';

// Страница из письма «сброс пароля»: /reset?token=…
export default function ResetPage() {
  const [token, setToken] = useState<string | null>(null); // null — ещё не прочитали URL
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      if (res.error) { setError(res.error); return; }
      router.push('/');
      router.refresh();
    } catch {
      setError('Сервер недоступен, попробуй ещё раз через минуту.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-top">
          <span className="auth-brand"><LogoIcon /></span>
        </div>
        <h1 className="auth-title">Новый пароль</h1>

        <div className="auth-rule" />

        {token === '' ? (
          <div className="auth-note">
            <p>Ссылка неполная. Открой её из письма целиком или запроси новую на странице входа.</p>
            <div className="auth-note-row">
              <button className="auth-back" onClick={() => router.push('/login')}>← Ко входу</button>
            </div>
          </div>
        ) : (
          <>
            {error && <div className="error-msg">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="reset-pass">Пароль</label>
                <input
                  id="reset-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <button className="btn btn-primary btn-block" type="submit" disabled={loading || token === null} style={{ marginTop: 8 }}>
                {loading ? 'Сохраняем…' : 'Сохранить и войти'}
              </button>
            </form>
            <p className="auth-hint">Минимум 6 символов. После сохранения сразу войдёшь в дневник.</p>
          </>
        )}
      </div>
    </div>
  );
}
