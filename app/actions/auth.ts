'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { rateLimit } from '@/lib/ratelimit';

const { users } = schema;

// Caddy sets X-Forwarded-For; first hop is the real client.
function clientIp(): string {
  return (headers().get('x-forwarded-for') || 'unknown').split(',')[0].trim();
}

export async function login(email: string, password: string): Promise<{ error?: string }> {
  if (!rateLimit(`login:${clientIp()}`, 10, 15 * 60_000)) {
    return { error: 'Слишком много попыток входа — подожди 15 минут' };
  }
  const e = email.trim().toLowerCase();
  const [u] = await db.select().from(users).where(eq(users.email, e)).limit(1);
  if (!u || !(await verifyPassword(password, u.passwordHash))) {
    return { error: 'Неверная почта или пароль' };
  }
  cookies().set(SESSION_COOKIE, await signSession(u.id), sessionCookieOptions);
  return {};
}

export async function register(email: string, password: string): Promise<{ error?: string }> {
  if (!rateLimit(`reg:${clientIp()}`, 5, 60 * 60_000)) {
    return { error: 'Слишком много регистраций — попробуй позже' };
  }
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { error: 'Неверный формат почты' };
  if (password.length < 6) return { error: 'Пароль минимум 6 символов' };
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, e)).limit(1);
  if (existing) return { error: 'Эта почта уже зарегистрирована' };
  const [u] = await db.insert(users).values({ email: e, passwordHash: await hashPassword(password) }).returning({ id: users.id });
  cookies().set(SESSION_COOKIE, await signSession(u.id), sessionCookieOptions);
  return {};
}

export async function logout() {
  cookies().delete(SESSION_COOKIE);
  redirect('/login');
}
