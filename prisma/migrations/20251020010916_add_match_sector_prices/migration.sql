-- CreateTable
CREATE TABLE "MatchSector" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "sectorId" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "MatchSector_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchSector_matchId_sectorId_key" ON "MatchSector"("matchId", "sectorId");

-- AddForeignKey
ALTER TABLE "MatchSector" ADD CONSTRAINT "MatchSector_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSector" ADD CONSTRAINT "MatchSector_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
