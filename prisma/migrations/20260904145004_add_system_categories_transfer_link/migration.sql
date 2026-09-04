-- AlterTable
ALTER TABLE "Category" ADD COLUMN "systemKey" TEXT;

-- CreateTable
CREATE TABLE "TransferLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "debitTransactionId" TEXT NOT NULL,
    "creditTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransferLink_debitTransactionId_key" ON "TransferLink"("debitTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferLink_creditTransactionId_key" ON "TransferLink"("creditTransactionId");

-- CreateIndex
CREATE INDEX "TransferLink_userId_idx" ON "TransferLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_systemKey_key" ON "Category"("userId", "systemKey");

-- AddForeignKey
ALTER TABLE "TransferLink" ADD CONSTRAINT "TransferLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLink" ADD CONSTRAINT "TransferLink_debitTransactionId_fkey" FOREIGN KEY ("debitTransactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferLink" ADD CONSTRAINT "TransferLink_creditTransactionId_fkey" FOREIGN KEY ("creditTransactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
