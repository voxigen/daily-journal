import { type NextRequest } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getUserId } from '@/lib/session';

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
}

// Serve a user's own day photo from the disk volume. URL: /api/uploads/<uid>/<date>/<file>
export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string[] }> }) {
  const uid = await getUserId();
  if (!uid) return new Response('Unauthorized', { status: 401 });

  const parts = (await params).file;
  if (parts[0] !== uid) return new Response('Forbidden', { status: 403 });

  const safe = parts.map((p) => p.replace(/[^a-zA-Z0-9._-]/g, ''));
  try {
    const data = await fs.readFile(path.join(uploadsDir(), ...safe));
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
