import { describe, it, expect } from "vitest";
import type { BusinessRole } from "@/generated/prisma/client";
import {
  PERMISSION,
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  hasPermission,
  requirePermission,
  assertCanAssignRole,
  type Permission,
} from "./permissions";
import { AppError } from "@/shared/errors/app-error";

const ctx = (role: BusinessRole) => ({ role });

describe("the permission matrix", () => {
  it("covers every declared permission for every role", () => {
    const roles: BusinessRole[] = ["OWNER", "ADMIN", "ACCOUNTANT"];
    for (const role of roles) {
      expect(ROLE_PERMISSIONS[role], `no entry for ${role}`).toBeDefined();
    }
    // Every permission must be reachable by someone, or it is dead.
    for (const permission of ALL_PERMISSIONS) {
      const granted = roles.some((r) => ROLE_PERMISSIONS[r].has(permission));
      expect(granted, `${permission} is granted to nobody`).toBe(true);
    }
  });

  it("gives OWNER everything", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission("OWNER", permission), `OWNER lacks ${permission}`).toBe(true);
    }
  });

  it("lets every role do day-to-day bookkeeping", () => {
    const daily: Permission[] = [
      PERMISSION.PARTY_VIEW,
      PERMISSION.PARTY_CREATE,
      PERMISSION.PARTY_UPDATE,
      PERMISSION.TRANSACTION_VIEW,
      PERMISSION.TRANSACTION_CREATE,
    ];
    for (const permission of daily) {
      expect(hasPermission("ACCOUNTANT", permission), `ACCOUNTANT lacks ${permission}`).toBe(true);
      expect(hasPermission("ADMIN", permission)).toBe(true);
    }
  });

  it("keeps destructive and administrative actions away from ACCOUNTANT", () => {
    const restricted: Permission[] = [
      PERMISSION.TRANSACTION_REVERSE,
      PERMISSION.PARTY_ARCHIVE,
      PERMISSION.MEMBER_INVITE,
      PERMISSION.MEMBER_REMOVE,
      PERMISSION.MEMBER_ROLE_UPDATE,
      PERMISSION.MEMBER_GRANT_OWNER,
      PERMISSION.INVITATION_VIEW,
      PERMISSION.AUDIT_VIEW,
      PERMISSION.BUSINESS_SETTINGS_UPDATE,
    ];
    for (const permission of restricted) {
      expect(hasPermission("ACCOUNTANT", permission), `ACCOUNTANT should not have ${permission}`).toBe(false);
    }
  });

  it("reserves ownership transfer and workspace settings to OWNER", () => {
    // The escalation the audit found: an ADMIN could mint a second OWNER and
    // then remove the original.
    expect(hasPermission("ADMIN", PERMISSION.MEMBER_GRANT_OWNER)).toBe(false);
    expect(hasPermission("ADMIN", PERMISSION.BUSINESS_SETTINGS_UPDATE)).toBe(false);
    expect(hasPermission("OWNER", PERMISSION.MEMBER_GRANT_OWNER)).toBe(true);
    expect(hasPermission("OWNER", PERMISSION.BUSINESS_SETTINGS_UPDATE)).toBe(true);
  });

  it("still lets ADMIN run the team and the ledger", () => {
    const adminPowers: Permission[] = [
      PERMISSION.MEMBER_INVITE,
      PERMISSION.MEMBER_REMOVE,
      PERMISSION.MEMBER_ROLE_UPDATE,
      PERMISSION.TRANSACTION_REVERSE,
      PERMISSION.PARTY_ARCHIVE,
      PERMISSION.AUDIT_VIEW,
    ];
    for (const permission of adminPowers) {
      expect(hasPermission("ADMIN", permission), `ADMIN lacks ${permission}`).toBe(true);
    }
  });
});

describe("requirePermission", () => {
  it("passes silently when the role holds the permission", () => {
    expect(() => requirePermission(ctx("ADMIN"), PERMISSION.MEMBER_INVITE)).not.toThrow();
  });

  it("throws AppError(403) when it does not", () => {
    try {
      requirePermission(ctx("ACCOUNTANT"), PERMISSION.TRANSACTION_REVERSE);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
    }
  });

  it("names the role in the message without leaking the permission internals", () => {
    try {
      requirePermission(ctx("ACCOUNTANT"), PERMISSION.AUDIT_VIEW);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as AppError).message).toMatch(/ACCOUNTANT/);
    }
  });
});

describe("assertCanAssignRole", () => {
  it("lets an OWNER grant any role, including OWNER", () => {
    expect(() => assertCanAssignRole(ctx("OWNER"), "OWNER")).not.toThrow();
    expect(() => assertCanAssignRole(ctx("OWNER"), "ADMIN")).not.toThrow();
    expect(() => assertCanAssignRole(ctx("OWNER"), "ACCOUNTANT")).not.toThrow();
  });

  it("lets an ADMIN grant non-owner roles", () => {
    expect(() => assertCanAssignRole(ctx("ADMIN"), "ADMIN")).not.toThrow();
    expect(() => assertCanAssignRole(ctx("ADMIN"), "ACCOUNTANT")).not.toThrow();
  });

  it("stops an ADMIN from granting OWNER", () => {
    expect(() => assertCanAssignRole(ctx("ADMIN"), "OWNER")).toThrow(AppError);
  });

  it("stops an ACCOUNTANT from granting anything", () => {
    expect(() => assertCanAssignRole(ctx("ACCOUNTANT"), "ACCOUNTANT")).toThrow(AppError);
  });
});
