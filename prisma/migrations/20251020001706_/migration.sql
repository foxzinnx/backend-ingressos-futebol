/*
  Warnings:

  - Added the required column `teamA` to the `Match` table without a default value. This is not possible if the table is not empty.
  - Added the required column `teamB` to the `Match` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "teamA" TEXT NOT NULL,
ADD COLUMN     "teamB" TEXT NOT NULL;
