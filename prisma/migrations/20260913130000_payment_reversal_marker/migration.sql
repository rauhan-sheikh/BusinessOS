-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "reversalEntryId" TEXT,
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reversalEntryId_key" ON "Payment"("reversalEntryId");

-- CreateIndex
CREATE INDEX "Payment_reversedById_idx" ON "Payment"("reversedById");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

