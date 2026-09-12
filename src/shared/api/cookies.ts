import type { NextResponse } from "next/server";
import { isProduction } from "@/lib/env";

/** Cookie naming the workspace a session is currently acting in. */
export const ACTIVE_BUSINESS_COOKIE = "active_business_id";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

/**
 * Sets the active-workspace cookie.
 *
 * Centralised because the same five options were repeated at four call sites,
 * none of which set `secure` - so the cookie was transmissible over plaintext
 * HTTP. It is httpOnly and cannot be forged client-side, and
 * getActiveBusinessContext re-checks its value against the caller's actual
 * memberships on every request, so it grants nothing on its own.
 */
export function setActiveBusinessCookie(response: NextResponse, businessId: string): void {
  response.cookies.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: THIRTY_DAYS_SECONDS,
  });
}
