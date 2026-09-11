/**
 * Authorization for workspace actions.
 *
 * Routes ask for a named permission rather than comparing role strings, so the
 * rules live in one table instead of being restated at each call site. That
 * also keeps the door open to the configurable role/permission matrix in
 * Plan.md section 51 stage 3: the matrix becomes data, and callers do not change.
 *
 * Enforced in the service layer as well as in routes, so a server component or
 * any future caller cannot reach a mutation without passing through it.
 */
import type { BusinessRole } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";

export const PERMISSION = {
  PARTY_VIEW: "PARTY_VIEW",
  PARTY_CREATE: "PARTY_CREATE",
  PARTY_UPDATE: "PARTY_UPDATE",
  PARTY_ARCHIVE: "PARTY_ARCHIVE",

  TRANSACTION_VIEW: "TRANSACTION_VIEW",
  TRANSACTION_CREATE: "TRANSACTION_CREATE",
  TRANSACTION_REVERSE: "TRANSACTION_REVERSE",

  MEMBER_VIEW: "MEMBER_VIEW",
  MEMBER_INVITE: "MEMBER_INVITE",
  MEMBER_REMOVE: "MEMBER_REMOVE",
  MEMBER_ROLE_UPDATE: "MEMBER_ROLE_UPDATE",
  /** Granting or revoking ownership. Reserved to OWNER. */
  MEMBER_GRANT_OWNER: "MEMBER_GRANT_OWNER",
  /** Reading pending invitations. Separate from MEMBER_VIEW because an
   *  invitation is a credential-bearing record. */
  INVITATION_VIEW: "INVITATION_VIEW",

  BUSINESS_SETTINGS_VIEW: "BUSINESS_SETTINGS_VIEW",
  BUSINESS_SETTINGS_UPDATE: "BUSINESS_SETTINGS_UPDATE",

  AUDIT_VIEW: "AUDIT_VIEW",
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSION);

/** Day-to-day bookkeeping: available to every role, including ACCOUNTANT. */
const BOOKKEEPING: readonly Permission[] = [
  PERMISSION.PARTY_VIEW,
  PERMISSION.PARTY_CREATE,
  PERMISSION.PARTY_UPDATE,
  PERMISSION.TRANSACTION_VIEW,
  PERMISSION.TRANSACTION_CREATE,
  PERMISSION.MEMBER_VIEW,
  PERMISSION.BUSINESS_SETTINGS_VIEW,
];

/**
 * Team and ledger administration. ADMIN holds these; ACCOUNTANT does not.
 * Reversal sits here rather than in BOOKKEEPING because it rewrites the record
 * of what happened, which is the correction-of-record action in the product.
 */
const ADMINISTRATION: readonly Permission[] = [
  PERMISSION.PARTY_ARCHIVE,
  PERMISSION.TRANSACTION_REVERSE,
  PERMISSION.MEMBER_INVITE,
  PERMISSION.MEMBER_REMOVE,
  PERMISSION.MEMBER_ROLE_UPDATE,
  PERMISSION.INVITATION_VIEW,
  PERMISSION.AUDIT_VIEW,
];

/**
 * Ownership-level actions, reserved to OWNER.
 *
 * Workspace settings are here because they include the business currency, which
 * silently reinterprets every stored amountMinor - and because README and
 * Plan.md both scope settings management to the owner.
 */
const OWNERSHIP: readonly Permission[] = [
  PERMISSION.MEMBER_GRANT_OWNER,
  PERMISSION.BUSINESS_SETTINGS_UPDATE,
];

export const ROLE_PERMISSIONS: Record<BusinessRole, ReadonlySet<Permission>> = {
  ACCOUNTANT: new Set(BOOKKEEPING),
  ADMIN: new Set([...BOOKKEEPING, ...ADMINISTRATION]),
  OWNER: new Set([...BOOKKEEPING, ...ADMINISTRATION, ...OWNERSHIP]),
};

/** The part of an authenticated context authorization actually depends on. */
export interface RoleBearing {
  role: BusinessRole;
}

/**
 * Who is performing an action.
 *
 * Privileged service methods take this instead of a bare userId, so a caller
 * that has not resolved a role cannot reach them - the omission is a type
 * error rather than a silently unauthorized write.
 */
export interface Actor extends RoleBearing {
  userId: string;
}

export function hasPermission(role: BusinessRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/** Throws AppError(403) unless the context's role holds the permission. */
export function requirePermission(ctx: RoleBearing, permission: Permission): void {
  if (!hasPermission(ctx.role, permission)) {
    throw new AppError(
      `Your role (${ctx.role}) is not permitted to perform this action.`,
      403
    );
  }
}

/**
 * Guards role assignment, including the escalation path the audit found: an
 * ADMIN minting a second OWNER, then removing the original.
 */
export function assertCanAssignRole(ctx: RoleBearing, target: BusinessRole): void {
  requirePermission(ctx, PERMISSION.MEMBER_ROLE_UPDATE);

  if (target === "OWNER") {
    requirePermission(ctx, PERMISSION.MEMBER_GRANT_OWNER);
  }
}
