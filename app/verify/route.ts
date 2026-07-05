import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db, schema } from '@/lib/db';
import { signSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { appUrl } from '@/lib/mail';

// Ссылка из письма: подтверждает почту и сразу логинит.
// Редиректы строим от APP_URL — за Caddy req.url смотрит на внутренний хост.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  if (token) {
    const hash = createHash('sha256').update(token).digest('hex');
    const [t] = await db.select().from(schema.emailTokens).where(eq(schema.emailTokens.tokenHash, hash)).limit(1);
    if (t && t.purpose === 'verify' && new Date(t.expiresAt) >= new Date()) {
      await db.update(schema.users).set({ emailVerified: true }).where(eq(schema.users.id, t.userId));
      await db.delete(schema.emailTokens).where(eq(schema.emailTokens.tokenHash, hash));
      const res = NextResponse.redirect(appUrl('/'));
      res.cookies.set(SESSION_COOKIE, await signSession(t.userId), sessionCookieOptions);
      return res;
    }
  }
  return NextResponse.redirect(appUrl('/login?verify=failed'));
}
