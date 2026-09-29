import { NextResponse, type NextRequest } from 'next/server';

export const VISITOR_COOKIE = 'dartler_vid';

/**
 * Assigns an opaque, non-identifying visitor id used only to count unique
 * visitors for the conversion-rate metric. It contains no personal data and is
 * never joined to a customer account.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|images/|favicon.ico|icon.svg|api/).*)'],
};
