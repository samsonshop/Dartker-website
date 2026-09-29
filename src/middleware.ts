import { NextResponse, type NextRequest } from 'next/server';

export const VISITOR_COOKIE = 'dartler_vid';

/**
 * Header carrying the requested path through to server components.
 *
 * Layouts cannot read the current pathname, but the auth guards need it to build
 * a `?next=` that returns the visitor to the page they actually asked for.
 */
export const PATHNAME_HEADER = 'x-pathname';

/**
 * Assigns an opaque, non-identifying visitor id used only to count unique
 * visitors for the conversion-rate metric. It contains no personal data and is
 * never joined to a customer account.
 */
export function middleware(request: NextRequest) {
  // Forwarding a modified request header is what makes the path readable from
  // `headers()` inside a server component.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

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
