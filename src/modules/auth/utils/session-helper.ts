import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { AppError } from "@/shared/errors/app-error";
import type { Business, BusinessRole, User } from "@/generated/prisma/client";

export interface AuthenticatedBusinessContext {
  user: User;
  business: Business;
  role: BusinessRole;
}

/**
 * Validates server session and resolves the user's active business and role.
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

  // Active business defaults to the first business membership
  const activeMembership = memberships[0];

  return {
    user: session.user as unknown as User,
    business: activeMembership.business,
    role: activeMembership.role,
  };
}
