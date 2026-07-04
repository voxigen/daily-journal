import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from './auth';

// Current user id from the session cookie (server components / actions), or null.
export async function getUserId(): Promise<string | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

// Same, but redirects to /login when there's no valid session.
export async function requireUserId(): Promise<string> {
  const uid = await getUserId();
  if (!uid) redirect('/login');
  return uid;
}
