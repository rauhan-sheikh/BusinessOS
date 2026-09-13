import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic routing guard.
 *
 * This reads the session cookie only - it does not query the database. Next's
 * own guidance is explicit that Proxy "should not be used as a full session
 * management or authorization solution", and that because it runs on every
 * route including prefetches, you should "only read the session from the cookie
 * (optimistic checks), and avoid database checks to prevent performance
 * issues". The previous implementation called auth.api.getSession here, so
 * every navigation and every prefetch cost a session lookup.
 *
 * Real authorization is unaffected: (app)/layout.tsx resolves and validates the
 * session server-side, and every API route and service checks membership and
 * permissions itself. A forged cookie gets past this redirect and no further.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/parties",
  "/transactions",
  "/invoices",
  "/payments",
  "/reports",
  "/settings",
];

/** Signed-in users are sent to the app instead of these. */
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

function isUnder(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = isUnder(pathname, PROTECTED_PREFIXES);
  const isAuthRoute = isUnder(pathname, AUTH_ROUTES);

  if (!isProtected && !isAuthRoute) {
    return NextResponse.next();
  }

  // Presence only. Validity is established server-side, where it matters.
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (!hasSessionCookie && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSessionCookie && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image optimisation, the favicon, and
     * /api - API routes authenticate themselves, so running this in front of
     * them would add a redirect where a 401 belongs.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
