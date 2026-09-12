-- Ledger hardening.
--
-- Hand-written rather than generated: Prisma proposes DROP/CREATE for the enum
-- and column renames below, which would discard existing ledger data. Every
-- rename here is an in-place ALTER, so the migration is data-preserving and
-- safe to run against a populated production database.

-- 1. Correct the long-standing misspelling of PAYMENT_RECEIVED in place, so
--    existing rows carrying the old value are renamed rather than orphaned.
ALTER TYPE "TransactionType" RENAME VALUE 'PAYMENT_RECEIEVED' TO 'PAYMENT_RECEIVED';

-- 2. The direction enum applies to ADJUSTMENT and REVERSAL too, not just
--    opening balances, so rename both the type and the PascalCase column.
ALTER TYPE "OpeningBalanceType" RENAME TO "BalanceDirection";
ALTER TABLE "Transaction" RENAME COLUMN "OpeningBalanceType" TO "direction";

-- 3. Separate the business date from the insert timestamp, so entries can be
--    back-dated. Existing rows adopt createdAt, preserving current ordering.
ALTER TABLE "Transaction" ADD COLUMN "transactionDate" TIMESTAMP(3);
UPDATE "Transaction" SET "transactionDate" = "createdAt";
ALTER TABLE "Transaction" ALTER COLUMN "transactionDate" SET NOT NULL;
ALTER TABLE "Transaction" ALTER COLUMN "transactionDate" SET DEFAULT CURRENT_TIMESTAMP;

-- 4. A transaction may be reversed at most once. Enforcing this with a unique
--    constraint replaces a check-then-act read that two concurrent reversal
--    requests could both pass, double-applying the inverse delta.
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_reversedTransactionId_key" UNIQUE ("reversedTransactionId");
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_reversedTransactionId_fkey"
  FOREIGN KEY ("reversedTransactionId") REFERENCES "Transaction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Amounts are always positive; the sign lives in transactionType/direction.
--    Backstop for the application-level validation, so no code path (or manual
--    console session) can post a negative or zero-value entry.
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_amountMinor_positive" CHECK ("amountMinor" > 0);

-- 6. Audit actions become an enum so a typo cannot create an unqueryable action.
CREATE TYPE "AuditAction" AS ENUM (
  'BUSINESS_CREATED',
  'BUSINESS_SETTINGS_UPDATED',
  'WORKSPACE_SWITCHED',
  'MEMBER_ADDED',
  'MEMBER_REMOVED',
  'MEMBER_ROLE_CHANGED',
  'MEMBER_INVITED',
  'INVITATION_REVOKED',
  'INVITATION_ACCEPTED',
  'INVITATION_ACCEPTED_NEW_USER',
  'PARTY_CREATED',
  'PARTY_UPDATED',
  'PARTY_ARCHIVED',
  'TRANSACTION_RECORDED',
  'TRANSACTION_REVERSED',
  'BALANCE_RECOMPUTED'
);
ALTER TABLE "AuditLog"
  ALTER COLUMN "actionType" TYPE "AuditAction" USING "actionType"::"AuditAction";

-- 7. An invitation records who granted workspace access. Deleting the inviter
--    must not erase that, so the FK becomes RESTRICT.
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_inviterId_fkey";
ALTER TABLE "Invitation"
  ADD CONSTRAINT "Invitation_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Indexes matching the queries actually issued.
--    BusinessUser.userId is the hottest lookup in the application - it runs on
--    every authenticated request - and the composite unique cannot serve it
--    because userId is not the left-most column.
CREATE INDEX "BusinessUser_userId_idx" ON "BusinessUser"("userId");

--    Ledger reads filter by business and sort by date; the single-column index
--    forced a sort of the whole tenant partition on every page.
DROP INDEX "Transaction_businessId_idx";
CREATE INDEX "Transaction_businessId_transactionDate_idx"
  ON "Transaction"("businessId", "transactionDate" DESC);
CREATE INDEX "Transaction_businessId_partyId_transactionDate_idx"
  ON "Transaction"("businessId", "partyId", "transactionDate" DESC);
CREATE INDEX "Transaction_businessId_transactionType_transactionDate_idx"
  ON "Transaction"("businessId", "transactionType", "transactionDate" DESC);
CREATE INDEX "Transaction_createdById_idx" ON "Transaction"("createdById");

--    AuditLog grows fastest of all tables and had the weakest index.
DROP INDEX "AuditLog_businessId_idx";
CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt" DESC);

CREATE INDEX "Party_businessId_isArchived_updatedAt_idx"
  ON "Party"("businessId", "isArchived", "updatedAt" DESC);

CREATE INDEX "Invitation_businessId_status_idx" ON "Invitation"("businessId", "status");
