import type { TransactionClient } from "@/lib/prisma";
import type { Broker, ParsedStatement } from "@/lib/import/types";

export const findOrCreateAccount = async (
  db: TransactionClient,
  broker: Broker,
  account: ParsedStatement["account"],
) => {
  const brokerRow = await db.broker.upsert({
    where: { name: broker },
    update: {},
    create: { name: broker },
  });

  return db.account.upsert({
    where: { brokerId_label: { brokerId: brokerRow.id, label: account.label } },
    update: {},
    create: { brokerId: brokerRow.id, label: account.label, baseCurrency: account.baseCurrency },
  });
};
