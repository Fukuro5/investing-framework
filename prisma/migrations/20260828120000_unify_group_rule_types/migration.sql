-- Unify allocation and metric rules into GroupRule via a `type`
-- discriminator (PLANNING.md §1 Phase 1). FrameworkGroup's allocation band
-- columns move into a required GroupRule row per group (type='allocation',
-- scope='group'). Existing GroupRule/Signal rows are reset rather than
-- migrated — an explicit choice for this local dev database at Phase 1
-- kickoff, not a general migration strategy.
DELETE FROM "Signal";

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FrameworkGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "frameworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    CONSTRAINT "FrameworkGroup_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "Framework" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FrameworkGroup" ("id", "frameworkId", "name", "priority") SELECT "id", "frameworkId", "name", "priority" FROM "FrameworkGroup";
DROP TABLE "FrameworkGroup";
ALTER TABLE "new_FrameworkGroup" RENAME TO "FrameworkGroup";
CREATE UNIQUE INDEX "FrameworkGroup_frameworkId_name_key" ON "FrameworkGroup"("frameworkId", "name");

DROP TABLE "GroupRule";
CREATE TABLE "GroupRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT,
    "minAllocation" REAL,
    "maxAllocation" REAL,
    "metricKey" TEXT,
    "operator" TEXT,
    "threshold" REAL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GroupRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FrameworkGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
PRAGMA foreign_keys=ON;
