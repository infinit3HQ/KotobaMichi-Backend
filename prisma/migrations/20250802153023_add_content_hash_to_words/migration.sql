/*
  Warnings:

  - A unique constraint covering the columns `[contentHash]` on the table `words` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `contentHash` to the `words` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "words" ADD COLUMN     "contentHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "words_contentHash_key" ON "words"("contentHash");
