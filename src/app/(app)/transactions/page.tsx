import { headers } from "next/headers";
import { partyService } from "@/modules/parties/services/party.service";
import { transactionService } from "@/modules/transactions/services/transaction.service";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import TransactionsClient, { type LedgerTransaction } from "./TransactionsClient";

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export default async function TransactionsPage(props: {
  searchParams: Promise<{ action?: string; partyId?: string }>;
}) {
  const { action, partyId } = await props.searchParams;
  const reqHeaders = await headers();
  const { business: activeBusiness } = await getActiveBusinessContext(reqHeaders);

  const [{ transactions, totalCount }, parties] = await Promise.all([
    transactionService.listTransactions(activeBusiness.id, {
      partyId: partyId || undefined,
      limit: 25,
      offset: 0,
    }),
    partyService.listParties(activeBusiness.id),
  ]);

  const partyOptions = parties.map((p) => ({ id: p.id, name: p.name }));

  return (
    <TransactionsClient
      initialTransactions={serializeBigInt(transactions) as unknown as LedgerTransaction[]}
      initialTotalCount={totalCount}
      parties={partyOptions}
      currency={activeBusiness.currency || "INR"}
      initialOpenModal={action === "new"}
    />
  );
}
