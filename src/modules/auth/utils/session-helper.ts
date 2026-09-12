import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { AppError } from "@/shared/errors/app-error";
import type { Business, BusinessRole, User } from "@/generated/prisma/client";
import type { Actor } from "@/modules/auth/permissions";
import { ACTIVE_BUSINESS_COOKIE } from "@/shared/api/cookies";

export interface AuthenticatedBusinessContext {
  user: User;
  business: Business;
  role: BusinessRole;
  /** Who is acting, for the privileged service methods. */
  actor: Actor;
}

function getCookie(headers: Headers, name: string): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

async function resolveActiveBusinessContext(): Promise<AuthenticatedBusinessContext> {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session || !session.user) {
    throw new AppError("Unauthorized", 401);
  }

  const memberships = await businessService.getBusinessesForUser(session.user.id);

  if (!memberships || memberships.length === 0) {
    throw new AppError(
      "No active business found for this account. Please complete onboarding.",
      403
    );
  }

  // The cookie is httpOnly, but it is still only a hint: its value is honoured
  // only when it names a workspace this user actually belongs to, so a stale or
  // tampered cookie falls back to their first membership rather than reaching
  // someone else's tenant.
  const requestedBusinessId = getCookie(reqHeaders, ACTIVE_BUSINESS_COOKIE);
  const activeMembership =
    (requestedBusinessId && memberships.find((m) => m.businessId === requestedBusinessId)) ||
    memberships[0];

  return {
    user: session.user as unknown as User,
    business: activeMembership.business,
    role: activeMembership.role,
    actor: { userId: session.user.id, role: activeMembership.role },
  };
}

/**
 * Validates the session and resolves the caller's active workspace and role.
 *
 * Memoised per request with React's cache(). Rendering a page previously
 * resolved this three or four times - the proxy checked the session, then the
 * layout checked it again and called this, then the page called it once more -
 * costing a session lookup and a membership join each time before any business
 * data was fetched. cache() is scoped to a single render pass, so nothing is
 * shared between requests or users.
 *
 * It reads the request headers itself rather than taking them as an argument:
 * cache() keys on argument identity, so passing a Headers object in would make
 * the memoisation depend on callers happening to share one instance.
 *
 * Throws AppError(401) when unauthenticated, or AppError(403) when the account
 * has no workspace yet.
 */
export const getActiveBusinessContext = cache(resolveActiveBusinessContext);
