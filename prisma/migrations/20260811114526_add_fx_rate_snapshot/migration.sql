-- CreateTable
CREATE TABLE "FxRateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "FxRateSnapshot_baseCurrency_quoteCurrency_key" ON "FxRateSnapshot"("baseCurrency", "quoteCurrency");
