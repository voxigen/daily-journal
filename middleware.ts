import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

// Страницы, доступные без сессии: логин + ссылки из писем.
const PUBLIC_PATHS = ['/login', '/verify', '/reset'];
// Реальные защищённые маршруты приложения (точный путь или его поддерево).
const PROTECTED_PREFIXES = ['/day', '/history', '/stats', '/templates', '/learn', '/settings', '/api'];

function isKnownRoute(pathname: string): boolean {
  if (pathname === '/') return true;
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Несуществующие пути (напр. /console, /phpinfo.php от сканеров) НЕ редиректим
  // на /login: это возвращало 200 и выглядело как «доступный debug-эндпоинт».
  // Пропускаем дальше — Next не найдёт маршрут и отрисует not-found с 404.
  if (!isKnownRoute(pathname)) {
    return NextResponse.next();
  }

  const userId = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!userId && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (userId && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|manifest.json|sw.js|apple-touch-icon.png|icon-.*\\.png|offline|robots.txt).*)'],
};
