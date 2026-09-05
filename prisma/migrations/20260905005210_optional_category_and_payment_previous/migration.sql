-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_categoryId_fkey";

-- AlterTable
ALTER TABLE "InvoicePaymentLink" ADD COLUMN     "previousCategoryId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "categoryId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "InvoicePaymentLink_previousCategoryId_idx" ON "InvoicePaymentLink"("previousCategoryId");

-- AddForeignKey
ALTER TABLE "InvoicePaymentLink" ADD CONSTRAINT "InvoicePaymentLink_previousCategoryId_fkey" FOREIGN KEY ("previousCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
