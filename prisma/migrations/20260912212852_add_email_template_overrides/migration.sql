-- Workspace-level overrides for the BUSINESS-scoped email templates defined in
-- src/lib/email/templates. A missing row means the built-in template is used,
-- so deleting a row restores the default.

CREATE TABLE "EmailTemplateOverride" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplateOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailTemplateOverride_businessId_templateKey_key"
    ON "EmailTemplateOverride"("businessId", "templateKey");

ALTER TABLE "EmailTemplateOverride"
    ADD CONSTRAINT "EmailTemplateOverride_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- SET NULL, not CASCADE: losing the editor must not delete the customisation.
ALTER TABLE "EmailTemplateOverride"
    ADD CONSTRAINT "EmailTemplateOverride_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
