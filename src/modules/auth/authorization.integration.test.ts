/**
 * Database-backed authorization tests.
 *
 * The matrix is unit-tested separately; these assert that the services actually
 * consult it, and that the invitation token never reaches a caller. Both were
 * real holes: the escalation path here (ADMIN mints an OWNER, then removes the
 * original) worked end to end before this branch.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/db";
import { businessService } from "@/modules/businesses/services/business.service";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import { transactionService } from "@/modules/transactions/services/transaction.service";
import { partyService } from "@/modules/parties/services/party.service";
import type { Actor } from "./permissions";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const PREFIX = "__authz_integration__";

describe.skipIf(!hasDatabase)("authorization (database)", () => {
  let businessId: string;
  let owner: Actor;
  let admin: Actor;
  let accountant: Actor;
  let ownerMembershipId: string;
  let partyId: string;
  let transactionId: string;

  const makeUser = async (tag: string) => {
    const user = await prisma.user.create({
      data: {
        id: `${PREFIX}${tag}${Date.now()}`,
        name: `${tag} user`,
        email: `${PREFIX}${tag}${Date.now()}@example.test`,
        emailVerified: true,
      },
    });
    return user.id;
  };

  beforeAll(async () => {
    const business = await prisma.business.create({
      data: { name: `${PREFIX} business`, currency: "INR" },
    });
    businessId = business.id;

    const [ownerId, adminId, accountantId] = await Promise.all([
      makeUser("owner"),
      makeUser("admin"),
      makeUser("acct"),
    ]);

    owner = { userId: ownerId, role: "OWNER" };
    admin = { userId: adminId, role: "ADMIN" };
    accountant = { userId: accountantId, role: "ACCOUNTANT" };

    const ownerMembership = await prisma.businessUser.create({
      data: { businessId, userId: ownerId, role: "OWNER" },
    });
    ownerMembershipId = ownerMembership.id;

    await prisma.businessUser.createMany({
      data: [
        { businessId, userId: adminId, role: "ADMIN" },
        { businessId, userId: accountantId, role: "ACCOUNTANT" },
      ],
    });

    const party = await prisma.party.create({
      data: { businessId, name: `${PREFIX} party` },
    });
    partyId = party.id;

    const tx = await transactionService.recordTransaction(businessId, accountant, {
      partyId,
      transactionType: "SALE",
      amount: "100.00",
    });
    transactionId = tx.id;
  });

  afterAll(async () => {
    if (!businessId) return;
    await prisma.transaction.deleteMany({ where: { businessId } });
    await prisma.partyBalance.deleteMany({ where: { businessId } });
    await prisma.party.deleteMany({ where: { businessId } });
    await prisma.auditLog.deleteMany({ where: { businessId } });
    await prisma.invitation.deleteMany({ where: { businessId } });
    await prisma.businessUser.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  describe("the ADMIN -> OWNER escalation path", () => {
    it("stops an ADMIN adding a new OWNER", async () => {
      await expect(
        businessService.addMember(businessId, admin, {
          email: `${PREFIX}nobody@example.test`,
          role: "OWNER",
        })
      ).rejects.toThrow(/not permitted/i);
    });

    it("stops an ADMIN inviting a new OWNER", async () => {
      await expect(
        invitationService.inviteMember(
          businessId,
          admin,
          `${PREFIX}invitee@example.test`,
          "OWNER"
        )
      ).rejects.toThrow(/not permitted/i);
    });

    it("stops an ADMIN promoting anyone to OWNER", async () => {
      const membership = await prisma.businessUser.findFirstOrThrow({
        where: { businessId, userId: accountant.userId },
      });

      await expect(
        businessService.updateMemberRole(businessId, membership.id, admin, { role: "OWNER" })
      ).rejects.toThrow(/not permitted/i);
    });

    it("stops an ADMIN removing an OWNER", async () => {
      await expect(
        businessService.removeMember(businessId, ownerMembershipId, admin)
      ).rejects.toThrow(/not permitted/i);
    });

    it("still lets an ADMIN manage non-owner roles", async () => {
      const membership = await prisma.businessUser.findFirstOrThrow({
        where: { businessId, userId: accountant.userId },
      });

      const updated = await businessService.updateMemberRole(businessId, membership.id, admin, {
        role: "ADMIN",
      });
      expect(updated.role).toBe("ADMIN");

      // put it back for the remaining tests
      await businessService.updateMemberRole(businessId, membership.id, admin, {
        role: "ACCOUNTANT",
      });
    });
  });

  describe("ACCOUNTANT limits", () => {
    it("may record transactions and parties", async () => {
      await expect(
        partyService.listParties(businessId, accountant)
      ).resolves.toBeDefined();
      await expect(
        transactionService.listTransactions(businessId, accountant)
      ).resolves.toBeDefined();
    });

    it("may not reverse a transaction", async () => {
      await expect(
        transactionService.reverseTransaction(transactionId, businessId, accountant)
      ).rejects.toThrow(/not permitted/i);
    });

    it("may not archive a party", async () => {
      await expect(
        partyService.archiveParty(partyId, businessId, accountant)
      ).rejects.toThrow(/not permitted/i);
    });

    it("may not read the audit trail", async () => {
      await expect(
        businessService.getAuditLogs(businessId, accountant)
      ).rejects.toThrow(/not permitted/i);
    });

    it("may not read pending invitations", async () => {
      await expect(
        invitationService.listInvitations(businessId, accountant)
      ).rejects.toThrow(/not permitted/i);
    });

    it("may not change workspace settings", async () => {
      await expect(
        businessService.updateBusiness(businessId, accountant, { name: "hijacked" })
      ).rejects.toThrow(/not permitted/i);
    });
  });

  describe("invitation tokens", () => {
    it("are never returned to a caller", async () => {
      await invitationService.inviteMember(
        businessId,
        owner,
        `${PREFIX}listed@example.test`,
        "ACCOUNTANT"
      );

      const invitations = await invitationService.listInvitations(businessId, owner);
      expect(invitations.length).toBeGreaterThan(0);

      for (const invitation of invitations) {
        expect(invitation).not.toHaveProperty("token");
      }

      // The shareable link is still available to someone who may invite.
      expect(invitations[0].inviteUrl).toMatch(/\/invite\//);
    });
  });

  describe("workspace settings", () => {
    it("refuses a currency change once the ledger has entries", async () => {
      await expect(
        businessService.updateBusiness(businessId, owner, { currency: "USD" })
      ).rejects.toThrow(/currency cannot be changed/i);
    });

    it("still allows unrelated profile edits", async () => {
      const updated = await businessService.updateBusiness(businessId, owner, {
        legalName: "Renamed Legal Entity",
      });
      expect(updated.legalName).toBe("Renamed Legal Entity");
    });
  });

  describe("the last owner", () => {
    it("cannot be removed", async () => {
      await expect(
        businessService.removeMember(businessId, ownerMembershipId, owner)
      ).rejects.toThrow(/only workspace OWNER/i);
    });

    it("cannot be demoted", async () => {
      await expect(
        businessService.updateMemberRole(businessId, ownerMembershipId, owner, {
          role: "ADMIN",
        })
      ).rejects.toThrow(/only workspace OWNER/i);
    });
  });
});
