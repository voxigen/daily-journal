import { cookies } from 'next/headers';

// Reads the day-reset timezone chosen in Settings (stored as the `tz` cookie so
// server components can compute "today" in the user's zone). Undefined → UTC.
export async function getTz(): Promise<string | undefined> {
  try {
    const c = await cookies();
    return c.get('tz')?.value || undefined;
  } catch {
    return undefined;
  }
}
