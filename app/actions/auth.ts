'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import { db, schema } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';
import { appUrl, sendVerifyEmail, sendResetEmail } from '@/lib/mail';

const { users, emailTokens } = schema;

const VERIFY_TTL = 24 * 60 * 60_000; // 24 часа
const RESET_TTL = 60 * 60_000; // 1 час

// Caddy sets X-Forwarded-For; first hop is the real client.
function clientIp(): string {
  return (headers().get('x-forwarded-for') || 'unknown').split(',')[0].trim();
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// Выдаёт одноразовый токен: старые той же цели гасим, в БД — только хэш.
async function issueToken(userId: string, purpose: 'verify' | 'reset', ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.delete(emailTokens).where(and(eq(emailTokens.userId, userId), eq(emailTokens.purpose, purpose)));
  await db.insert(emailTokens).values({
    tokenHash: sha256(token),
    userId,
    purpose,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  });
  return token;
}

export async function login(email: string, password: string): Promise<{ error?: string; needVerify?: boolean }> {
  if (!rateLimit(`login:${clientIp()}`, 10, 15 * 60_000)) {
    return { error: 'Слишком много попыток входа, подожди 15 минут' };
  }
  const e = email.trim().toLowerCase();
  const [u] = await db.select().from(users).where(eq(users.email, e)).limit(1);
  if (!u || !(await verifyPassword(password, u.passwordHash))) {
    return { error: 'Неверная почта или пароль' };
  }
  if (!u.emailVerified) {
    return { error: 'Почта ещё не подтверждена. Открой ссылку из письма', needVerify: true };
  }
  cookies().set(SESSION_COOKIE, await signSession(u.id), sessionCookieOptions);
  return {};
}

export async function register(email: string, password: string): Promise<{ error?: string; sent?: boolean }> {
  if (!rateLimit(`reg:${clientIp()}`, 5, 60 * 60_000)) {
    return { error: 'Слишком много регистраций, попробуй позже' };
  }
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { error: 'Неверный формат почты' };
  if (password.length < 6) return { error: 'Пароль минимум 6 символов' };

  const [existing] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users).where(eq(users.email, e)).limit(1);
  if (existing && existing.emailVerified) return { error: 'Эта почта уже зарегистрирована' };

  let userId: string;
  if (existing) {
    // Повторная регистрация неподтверждённого аккаунта: обновляем пароль и шлём
    // письмо заново (почта ещё ничья — владелец тот, кто пройдёт по ссылке).
    userId = existing.id;
    await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, userId));
  } else {
    const [u] = await db
      .insert(users)
      .values({ email: e, passwordHash: await hashPassword(password) })
      .returning({ id: users.id });
    userId = u.id;
  }

  const token = await issueToken(userId, 'verify', VERIFY_TTL);
  await sendVerifyEmail(e, appUrl(`/verify?token=${token}`));
  return { sent: true };
}

export async function resendVerify(email: string): Promise<{ sent: boolean }> {
  if (!rateLimit(`resend:${clientIp()}`, 3, 15 * 60_000)) return { sent: true };
  const e = email.trim().toLowerCase();
  const [u] = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users).where(eq(users.email, e)).limit(1);
  if (u && !u.emailVerified) {
    const token = await issueToken(u.id, 'verify', VERIFY_TTL);
    await sendVerifyEmail(e, appUrl(`/verify?token=${token}`));
  }
  return { sent: true };
}

export async function requestPasswordReset(email: string): Promise<{ sent: boolean }> {
  // Ответ всегда одинаковый — не раскрываем, есть ли такая почта.
  if (!rateLimit(`reset:${clientIp()}`, 5, 60 * 60_000)) return { sent: true };
  const e = email.trim().toLowerCase();
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, e)).limit(1);
  if (u) {
    const token = await issueToken(u.id, 'reset', RESET_TTL);
    await sendResetEmail(e, appUrl(`/reset?token=${token}`));
  }
  return { sent: true };
}

export async function resetPassword(token: string, password: string): Promise<{ error?: string }> {
  if (password.length < 6) return { error: 'Пароль минимум 6 символов' };
  const [t] = await db.select().from(emailTokens).where(eq(emailTokens.tokenHash, sha256(token))).limit(1);
  if (!t || t.purpose !== 'reset' || new Date(t.expiresAt) < new Date()) {
    return { error: 'Ссылка недействительна или устарела, запроси новую' };
  }
  // Сброс по ссылке из письма заодно доказывает владение почтой.
  await db.update(users)
    .set({ passwordHash: await hashPassword(password), emailVerified: true })
    .where(eq(users.id, t.userId));
  await db.delete(emailTokens).where(eq(emailTokens.userId, t.userId));
  cookies().set(SESSION_COOKIE, await signSession(t.userId), sessionCookieOptions);
  return {};
}

export async function logout() {
  cookies().delete(SESSION_COOKIE);
  redirect('/login');
}
