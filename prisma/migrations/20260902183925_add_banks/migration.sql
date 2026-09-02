/*
  Warnings:

  - You are about to drop the column `institution` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `institution` on the `Card` table. All the data in the column will be lost.
  - Added the required column `bankId` to the `Account` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bankId` to the `Card` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Account" DROP COLUMN "institution",
ADD COLUMN     "bankId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Card" DROP COLUMN "institution",
ADD COLUMN     "bankId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bank_userId_idx" ON "Bank"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_userId_name_key" ON "Bank"("userId", "name");

-- CreateIndex
CREATE INDEX "Account_bankId_idx" ON "Account"("bankId");

-- CreateIndex
CREATE INDEX "Card_bankId_idx" ON "Card"("bankId");

-- AddForeignKey
ALTER TABLE "Bank" ADD CONSTRAINT "Bank_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
