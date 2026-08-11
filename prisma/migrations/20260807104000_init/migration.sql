-- CreateTable
CREATE TABLE "Broker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brokerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    CONSTRAINT "Account_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "Broker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "isin" TEXT,
    "name" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "exchange" TEXT
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "rawFileRef" TEXT,
    CONSTRAINT "ImportBatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "instrumentId" TEXT,
    "importBatchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "quantity" REAL,
    "price" REAL,
    "fees" REAL,
    "currency" TEXT NOT NULL,
    "brokerRef" TEXT NOT NULL,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PositionSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "asOfDate" DATETIME NOT NULL,
    "quantity" REAL NOT NULL,
    "avgCostPrice" REAL NOT NULL,
    "marketPrice" REAL NOT NULL,
    "marketValue" REAL NOT NULL,
    "unrealizedPnl" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    CONSTRAINT "PositionSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PositionSnapshot_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PositionSnapshot_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrumentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "price" REAL NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceSnapshot_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instrumentId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "asOfDate" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetricValue_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Framework" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "FrameworkGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "frameworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAllocationMin" REAL NOT NULL,
    "targetAllocationMax" REAL NOT NULL,
    "priority" INTEGER NOT NULL,
    CONSTRAINT "FrameworkGroup_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GroupRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FrameworkGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstrumentGroupAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "frameworkId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstrumentGroupAssignment_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InstrumentGroupAssignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FrameworkGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InstrumentGroupAssignment_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "frameworkId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "groupRuleId" TEXT NOT NULL,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "message" TEXT,
    CONSTRAINT "Signal_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Signal_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Signal_groupRuleId_fkey" FOREIGN KEY ("groupRuleId") REFERENCES "GroupRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Broker_name_key" ON "Broker"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_brokerId_label_key" ON "Account"("brokerId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_ticker_key" ON "Instrument"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_accountId_brokerRef_key" ON "Transaction"("accountId", "brokerRef");

-- CreateIndex
CREATE UNIQUE INDEX "PositionSnapshot_accountId_instrumentId_asOfDate_key" ON "PositionSnapshot"("accountId", "instrumentId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "PriceSnapshot_instrumentId_date_key" ON "PriceSnapshot"("instrumentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MetricValue_instrumentId_metricKey_source_asOfDate_key" ON "MetricValue"("instrumentId", "metricKey", "source", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "Framework_name_key" ON "Framework"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FrameworkGroup_frameworkId_name_key" ON "FrameworkGroup"("frameworkId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentGroupAssignment_frameworkId_instrumentId_key" ON "InstrumentGroupAssignment"("frameworkId", "instrumentId");
