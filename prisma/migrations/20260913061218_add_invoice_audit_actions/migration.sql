-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_DRAFTED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_ISSUED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_DRAFT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_RECORDED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_REALLOCATED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYMENT_REVERSED';
ALTER TYPE "AuditAction" ADD VALUE 'ITEM_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ITEM_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'ITEM_ARCHIVED';
