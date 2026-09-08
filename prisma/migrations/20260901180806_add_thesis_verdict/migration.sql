-- CreateTable
CREATE TABLE "ThesisVerdict" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrumentId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "asOfDate" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThesisVerdict_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ThesisVerdict_instrumentId_accessionNumber_key" ON "ThesisVerdict"("instrumentId", "accessionNumber");
