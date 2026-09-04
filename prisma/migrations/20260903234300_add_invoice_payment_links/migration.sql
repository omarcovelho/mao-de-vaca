-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'INVOICE_PAYMENT';

-- CreateTable
CREATE TABLE "InvoicePaymentLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePaymentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoicePaymentLink_userId_idx" ON "InvoicePaymentLink"("userId");

-- CreateIndex
CREATE INDEX "InvoicePaymentLink_invoiceId_idx" ON "InvoicePaymentLink"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoicePaymentLink_transactionId_key" ON "InvoicePaymentLink"("transactionId");

-- AddForeignKey
ALTER TABLE "InvoicePaymentLink" ADD CONSTRAINT "InvoicePaymentLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePaymentLink" ADD CONSTRAINT "InvoicePaymentLink_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePaymentLink" ADD CONSTRAINT "InvoicePaymentLink_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
