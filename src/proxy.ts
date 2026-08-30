import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/parties", "/transactions", "/settings"];

// Routes that should redirect authenticated users away (e.g., login while logged in)
const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route or auth/root route
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route)) || pathname === "/";

  // Fast path: if not a relevant route (e.g. /privacy, /terms, /security, /cookies), pass through
  if (!isProtected && !isAuthRoute) {
    return NextResponse.next();
  }

  // Fetch session using Better Auth's server-side API
  const session = await auth.api.getSession({ headers: request.headers });

  // Unauthenticated user tries to access a protected route → redirect to login
  if (!session && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user tries to access root or auth routes (e.g. /, /login, /register) → redirect to dashboard
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api routes (handled by their own auth checks)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
