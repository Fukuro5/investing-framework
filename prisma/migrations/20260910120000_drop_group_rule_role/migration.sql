-- Drop GroupRule.role (PLANNING.md §1 Phase 4): every active type='metric'
-- rule now drives both group membership and signal severity off one
-- threshold, so the classification/signal distinction is gone. Existing
-- rows are preserved (unlike the Phase 1 migration, which reset the table)
-- since this column drop has no other shape change to justify discarding
-- real rule data.
--
-- Manual step this migration does NOT attempt: any group that previously
-- paired a role='classification' rule and a differently-thresholded
-- role='signal' rule on the same metricKey now has two active rules on
-- that metric post-migration, which the code has no basis to auto-merge —
-- review such groups by hand and delete/adjust one of the two rules.

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GroupRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT,
    "minAllocation" REAL,
    "maxAllocation" REAL,
    "metricKey" TEXT,
    "operator" TEXT,
    "threshold" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GroupRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FrameworkGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GroupRule" ("id", "groupId", "type", "scope", "minAllocation", "maxAllocation", "metricKey", "operator", "threshold", "isActive")
SELECT "id", "groupId", "type", "scope", "minAllocation", "maxAllocation", "metricKey", "operator", "threshold", "isActive" FROM "GroupRule";
DROP TABLE "GroupRule";
ALTER TABLE "new_GroupRule" RENAME TO "GroupRule";
PRAGMA foreign_keys=ON;
