import { NextRequest, NextResponse } from 'next/server';

const PUBLIC = ['/login', '/setup'];
const PUBLIC_API = ['/api/auth/'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) return NextResponse.next();

  const hasKey = !!req.cookies.get('qa_api_key')?.value;

  // Allow public API paths (login, logout, setup)
  if (PUBLIC_API.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Public pages: redirect to home if already logged in
  if (PUBLIC.some(p => pathname.startsWith(p))) {
    if (hasKey) return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }

  // All other routes require auth
  if (!hasKey) {
    const url = new URL('/login', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
