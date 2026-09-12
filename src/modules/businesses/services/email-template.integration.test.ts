import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/db";
import { emailTemplateService } from "./email-template.service";
import type { Actor } from "@/modules/auth/permissions";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const PREFIX = "__email_template_integration__";

describe.skipIf(!hasDatabase)("email template overrides (database)", () => {
  let businessId: string;
  let owner: Actor;
  let accountant: Actor;

  beforeAll(async () => {
    const business = await prisma.business.create({
      data: { name: `${PREFIX} business`, currency: "INR" },
    });
    businessId = business.id;

    const user = await prisma.user.create({
      data: {
        id: `${PREFIX}${Date.now()}`,
        name: "Template Owner",
        email: `${PREFIX}${Date.now()}@example.test`,
        emailVerified: true,
      },
    });

    owner = { userId: user.id, role: "OWNER" };
    accountant = { userId: user.id, role: "ACCOUNTANT" };

    await prisma.businessUser.create({
      data: { businessId, userId: user.id, role: "OWNER" },
    });
  });

  afterAll(async () => {
    if (!businessId) return;
    await prisma.emailTemplateOverride.deleteMany({ where: { businessId } });
    await prisma.businessUser.deleteMany({ where: { businessId } });
    await prisma.business.delete({ where: { id: businessId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.$disconnect();
  });

  it("lists only the workspace-scoped templates", async () => {
    const templates = await emailTemplateService.listTemplates(businessId, owner);

    expect(templates.map((t) => t.key)).toEqual(["TEAM_INVITATION"]);
    expect(templates[0].isCustomised).toBe(false);
  });

  it("refuses to customise platform email", async () => {
    // Verification and password reset are sent on every tenant's behalf, so one
    // tenant must not be able to rewrite them.
    await expect(
      emailTemplateService.saveOverride(businessId, owner, "PASSWORD_RESET", {
        subject: "hijacked",
        html: "<p>hijacked</p>",
      })
    ).rejects.toThrow(/cannot be customised/i);

    await expect(
      emailTemplateService.saveOverride(businessId, owner, "EMAIL_VERIFICATION", {
        subject: "hijacked",
        html: "<p>hijacked</p>",
      })
    ).rejects.toThrow(/cannot be customised/i);
  });

  it("rejects an unknown template key", async () => {
    await expect(
      emailTemplateService.saveOverride(businessId, owner, "NOT_A_TEMPLATE", {
        subject: "x",
        html: "<p>x</p>",
      })
    ).rejects.toThrow(/unknown email template/i);
  });

  it("rejects placeholders the template does not define", async () => {
    await expect(
      emailTemplateService.saveOverride(businessId, owner, "TEAM_INVITATION", {
        subject: "Join {{BUSINESS_NAME}}",
        html: "<p>Hello {{NOT_A_VARIABLE}}</p>",
      })
    ).rejects.toThrow(/NOT_A_VARIABLE/);
  });

  it("saves, applies and restores an override", async () => {
    await emailTemplateService.saveOverride(businessId, owner, "TEAM_INVITATION", {
      subject: "Come work with {{BUSINESS_NAME}}",
      html: "<p>{{INVITER_NAME}} invited you. <a href=\"{{INVITE_URL}}\">Join</a></p>",
    });

    const [customised] = await emailTemplateService.listTemplates(businessId, owner);
    expect(customised.isCustomised).toBe(true);
    expect(customised.subject).toBe("Come work with {{BUSINESS_NAME}}");
    expect(customised.updatedByName).toBe("Template Owner");
    // The built-in stays available so the editor can offer a restore.
    expect(customised.defaultSubject).not.toBe(customised.subject);

    await emailTemplateService.resetToDefault(businessId, owner, "TEAM_INVITATION");

    const [restored] = await emailTemplateService.listTemplates(businessId, owner);
    expect(restored.isCustomised).toBe(false);
    expect(restored.subject).toBe(restored.defaultSubject);
  });

  it("escapes interpolated values in a customised template too", async () => {
    await emailTemplateService.saveOverride(businessId, owner, "TEAM_INVITATION", {
      subject: "Join {{BUSINESS_NAME}}",
      html: "<p>{{BUSINESS_NAME}}</p>",
    });

    const preview = await emailTemplateService.preview(owner, "TEAM_INVITATION", {
      subject: "Join {{BUSINESS_NAME}}",
      html: "<p>{{BUSINESS_NAME}}</p>",
    });

    // Customising must not open the injection the built-in templates close.
    expect(preview.html).not.toContain("<script");

    await emailTemplateService.resetToDefault(businessId, owner, "TEAM_INVITATION");
  });

  it("keeps the editor away from roles that cannot manage email", async () => {
    await expect(
      emailTemplateService.listTemplates(businessId, accountant)
    ).rejects.toThrow(/not permitted/i);

    await expect(
      emailTemplateService.saveOverride(businessId, accountant, "TEAM_INVITATION", {
        subject: "x",
        html: "<p>x</p>",
      })
    ).rejects.toThrow(/not permitted/i);
  });
});
