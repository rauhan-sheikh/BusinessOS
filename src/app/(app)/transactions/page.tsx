import { partyService } from "@/modules/parties/services/party.service";
import { transactionService } from "@/modules/transactions/services/transaction.service";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import TransactionsClient, { type LedgerTransaction } from "./TransactionsClient";
import { serializeBigInt } from "@/shared/utils/serialize";


export default async function TransactionsPage(props: {
  searchParams: Promise<{ action?: string; partyId?: string }>;
}) {
  const { action, partyId } = await props.searchParams;
  const { business: activeBusiness, actor } = await getActiveBusinessContext();

  const [{ transactions, totalCount }, parties] = await Promise.all([
    transactionService.listTransactions(activeBusiness.id, actor, {
      partyId: partyId || undefined,
      limit: 25,
      offset: 0,
    }),
    // Enough to populate the counterparty filter without loading the
    // whole directory.
    partyService.listParties(activeBusiness.id, actor, { limit: 500 }),
  ]);

  const partyOptions = parties.parties.map((p) => ({ id: p.id, name: p.name }));

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
