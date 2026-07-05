'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, register, resendVerify, requestPasswordReset } from '@/app/actions/auth';
import LogoIcon from '@/components/LogoIcon';

type Mode = 'login' | 'register' | 'reset';
type Sent = '' | 'verify' | 'reset';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [sent, setSent] = useState<Sent>('');
  const [needVerify, setNeedVerify] = useState(false);
  const [dateLine, setDateLine] = useState('');
  const router = useRouter();

  // «Шапка альманаха» — сегодняшняя дата; на клиенте, чтобы не разошлась с SSR.
  useEffect(() => {
    setDateLine(new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()));
    // Прилетели с /verify по битой или устаревшей ссылке
    if (new URLSearchParams(window.location.search).get('verify') === 'failed') {
      setError('Ссылка подтверждения недействительна или устарела. Войди и запроси письмо ещё раз.');
    }
  }, []);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError('');
    setInfo('');
    setNeedVerify(false);
  }

  function backToLogin() {
    setSent('');
    switchMode('login');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setNeedVerify(false);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (res.error) { setError(res.error); setNeedVerify(!!res.needVerify); return; }
        router.push('/');
        router.refresh();
      } else if (mode === 'register') {
        const res = await register(email, password);
        if (res.error) { setError(res.error); return; }
        setSent('verify');
      } else {
        await requestPasswordReset(email);
        setSent('reset');
      }
    } catch {
      setError('Сервер недоступен, попробуй ещё раз через минуту.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);
    try {
      await resendVerify(email);
      setError('');
      setNeedVerify(false);
      setInfo('Письмо отправлено ещё раз. Проверь почту и папку «Спам».');
    } catch {
      setError('Сервер недоступен, попробуй ещё раз через минуту.');
    } finally {
      setLoading(false);
    }
  }

  const submitLabel =
    mode === 'login' ? (loading ? 'Входим…' : 'Войти')
    : mode === 'register' ? (loading ? 'Создаём…' : 'Создать аккаунт')
    : (loading ? 'Отправляем…' : 'Отправить ссылку');

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-top">
          <span className="auth-brand"><LogoIcon /></span>
          <span className="auth-date">{dateLine}</span>
        </div>
        <h1 className="auth-title">Almanax</h1>

        <div className="auth-rule" />

        {sent === 'verify' ? (
          <div className="auth-note">
            <p><b>Проверь почту.</b> Мы отправили ссылку для подтверждения на <b>{email}</b>. Если письма нет, загляни в «Спам».</p>
            {info && <div className="info-msg" style={{ marginTop: 14 }}>{info}</div>}
            <div className="auth-note-row">
              <button className="link-btn" onClick={handleResend} disabled={loading}>Отправить ещё раз</button>
              <button className="auth-back" onClick={backToLogin}>← Ко входу</button>
            </div>
          </div>
        ) : sent === 'reset' ? (
          <div className="auth-note">
            <p><b>Проверь почту.</b> Если <b>{email}</b> зарегистрирована, туда придёт ссылка для сброса пароля. Она действует один час.</p>
            <div className="auth-note-row">
              <button className="auth-back" onClick={backToLogin}>← Ко входу</button>
            </div>
          </div>
        ) : (
          <>
            {mode === 'reset' ? (
              <div className="auth-tabs">
                <button className="auth-tab" onClick={() => switchMode('login')}>← Вход</button>
                <span className="auth-tab active static">Сброс пароля</span>
              </div>
            ) : (
              <div className="auth-tabs" role="tablist">
                <button
                  role="tab" aria-selected={mode === 'login'}
                  className={`auth-tab${mode === 'login' ? ' active' : ''}`}
                  onClick={() => switchMode('login')}
                >
                  Вход
                </button>
                <button
                  role="tab" aria-selected={mode === 'register'}
                  className={`auth-tab${mode === 'register' ? ' active' : ''}`}
                  onClick={() => switchMode('register')}
                >
                  Регистрация
                </button>
              </div>
            )}

            {error && (
              <div className="error-msg">
                {error}
                {needVerify && (
                  <button className="link-btn" style={{ display: 'block', marginTop: 6 }} onClick={handleResend} disabled={loading}>
                    Отправить письмо ещё раз
                  </button>
                )}
              </div>
            )}
            {info && <div className="info-msg">{info}</div>}

            <form onSubmit={handleSubmit}>
              <div className="auth-field">
                <label htmlFor="auth-email">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              {mode !== 'reset' && (
                <div className="auth-field">
                  <div className="auth-label-row">
                    <label htmlFor="auth-pass">Пароль</label>
                    {mode === 'login' && (
                      <button type="button" className="auth-forgot" onClick={() => switchMode('reset')}>
                        Забыли пароль?
                      </button>
                    )}
                  </div>
                  <input
                    id="auth-pass"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </div>
              )}
              <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                {submitLabel}
              </button>
            </form>

            <p className="auth-hint">
              {mode === 'register' ? 'Пароль не короче 6 символов. Понадобится подтвердить почту.'
                : mode === 'reset' ? 'Пришлём на почту ссылку, по ней задашь новый пароль.'
                : ' '}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
