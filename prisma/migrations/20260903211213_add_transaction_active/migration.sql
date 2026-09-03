-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Transaction_userId_active_idx" ON "Transaction"("userId", "active");
