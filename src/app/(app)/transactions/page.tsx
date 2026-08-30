import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { partyService } from "@/modules/parties/services/party.service";
import { transactionService } from "@/modules/transactions/services/transaction.service";
import { headers } from "next/headers";
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
  const session = await auth.api.getSession({ headers: await headers() });
  const memberships = await businessService.getBusinessesForUser(session!.user.id);
  const activeBusiness = memberships[0].business;

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
