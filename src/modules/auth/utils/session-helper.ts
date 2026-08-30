import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { AppError } from "@/shared/errors/app-error";
import type { Business, BusinessRole, User } from "@/generated/prisma/client";

export interface AuthenticatedBusinessContext {
  user: User;
  business: Business;
  role: BusinessRole;
}

function getCookie(headers: Headers, name: string): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Validates server session and resolves the user's active business and role.
 * Resolves active business from the `active_business_id` cookie or defaults to first business.
 * Throws AppError(401) if not authenticated or AppError(403) if no active business membership.
 */
export async function getActiveBusinessContext(
  headers: Headers
): Promise<AuthenticatedBusinessContext> {
  const session = await auth.api.getSession({ headers });

  if (!session || !session.user) {
    throw new AppError("Unauthorized", 401);
  }

  const memberships = await businessService.getBusinessesForUser(session.user.id);

  if (!memberships || memberships.length === 0) {
    throw new AppError("No active business found for this account. Please complete onboarding.", 403);
  }

  // Check if active_business_id cookie is present and valid for this user
  const activeBusinessIdCookie = getCookie(headers, "active_business_id");
  const activeMembership =
    (activeBusinessIdCookie &&
      memberships.find((m) => m.businessId === activeBusinessIdCookie)) ||
    memberships[0];

  return {
    user: session.user as unknown as User,
    business: activeMembership.business,
    role: activeMembership.role,
  };
}
