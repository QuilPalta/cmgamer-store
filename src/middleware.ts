import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'cmgamer_admin_session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const sessionCookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (sessionCookie !== 'authenticated') {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/admin/login';
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
