import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

// Страницы, доступные без сессии: логин + ссылки из писем.
const PUBLIC_PATHS = ['/login', '/verify', '/reset'];
// Реальные защищённые маршруты приложения (точный путь или его поддерево).
const PROTECTED_PREFIXES = ['/day', '/week', '/history', '/stats', '/templates', '/learn', '/settings', '/api'];

function isKnownRoute(pathname: string): boolean {
  if (pathname === '/') return true;
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

// Edge-safe лимитер в памяти: сервер один инстанс → одна карта на процесс.
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) buckets.forEach((b, k) => { if (now > b.resetAt) buckets.delete(k); });
  const b = buckets.get(key);
  if (!b || now > b.resetAt) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

function clientIp(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}

const isDev = process.env.NODE_ENV === 'development';

// script-src допускает 'unsafe-inline': pre-paint themeScript и регистрация SW —
// инлайновые. Пробовали nonce, но React в <head> пересоздаёт nonce'd-скрипт, и он
// не исполняется во время парсинга — тема переставала применяться до первой
// отрисовки. React и так экранирует любой вывод, так что reflected-XSS маловероятен.
function buildCsp(): string {
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  const connectSrc = isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'";
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    connectSrc,
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

function withSecurity(res: NextResponse, csp: string): NextResponse {
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  return res;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const csp = buildCsp();

  // Несуществующие пути (напр. /console, /phpinfo.php, /find?q=… от сканеров) —
  // голый 404 без рендера страницы. Это разом убирает и «доступный debug-эндпоинт»
  // (был редирект → 200), и «отражённый XSS» (Next зашивал URL с ?q= в инлайн-скрипт).
  if (!isKnownRoute(pathname)) {
    return withSecurity(new NextResponse('Not Found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } }), csp);
  }

  // Реальный отпор перебору: формы отправляются server-action'ами POST'ом на
  // /login и /reset. Больше лимита за окно — честный 429 на уровне edge,
  // ещё до БД. Дополняет проверки в самих экшенах (lib/ratelimit).
  if (request.method === 'POST' && (pathname === '/login' || pathname === '/reset')) {
    if (!rateLimit(`authpost:${clientIp(request)}`, 10, 15 * 60_000)) {
      return withSecurity(
        new NextResponse('Too Many Requests', { status: 429, headers: { 'content-type': 'text/plain; charset=utf-8', 'retry-after': '900' } }),
        csp,
      );
    }
  }

  const userId = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!userId && !PUBLIC_PATHS.includes(pathname)) {
    return withSecurity(NextResponse.redirect(new URL('/login', request.url)), csp);
  }
  if (userId && pathname === '/login') {
    return withSecurity(NextResponse.redirect(new URL('/', request.url)), csp);
  }

  return withSecurity(NextResponse.next(), csp);
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|manifest.json|sw.js|apple-touch-icon.png|icon-.*\\.png|offline|robots.txt).*)'],
};
