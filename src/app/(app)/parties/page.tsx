import { partyService } from "@/modules/parties/services/party.service";
import { DEFAULT_PARTY_PAGE_SIZE } from "@/modules/parties/repositories/party.repository";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import PartiesClient, { type PartyWithBalance } from "./PartiesClient";
import { serializeBigInt } from "@/shared/utils/serialize";


export default async function PartiesPage(props: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await props.searchParams;
  const { business: activeBusiness, actor } = await getActiveBusinessContext();

  const [{ parties, totalCount }, aggregates] = await Promise.all([
    partyService.listParties(activeBusiness.id, actor, { limit: DEFAULT_PARTY_PAGE_SIZE }),
    partyService.getBusinessPartyAggregates(activeBusiness.id, actor),
  ]);

  return (
    <PartiesClient
      initialParties={serializeBigInt(parties) as unknown as PartyWithBalance[]}
      initialTotalCount={totalCount}
      aggregates={{
        totalParties: aggregates.totalParties,
        totalReceivable: Number(aggregates.totalReceivablesMinor),
        totalPayable: Number(aggregates.totalPayablesMinor),
      }}
      pageSize={DEFAULT_PARTY_PAGE_SIZE}
      currency={activeBusiness.currency || "INR"}
      initialOpenModal={action === "new"}
    />
  );
}
