import { headers } from "next/headers";
import { partyService } from "@/modules/parties/services/party.service";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import PartiesClient, { type PartyWithBalance } from "./PartiesClient";
import { serializeBigInt } from "@/shared/utils/serialize";


export default async function PartiesPage(props: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await props.searchParams;
  const reqHeaders = await headers();
  const { business: activeBusiness, actor } = await getActiveBusinessContext(reqHeaders);

  const parties = await partyService.listParties(activeBusiness.id, actor);

  return (
    <PartiesClient
      initialParties={serializeBigInt(parties) as unknown as PartyWithBalance[]}
      currency={activeBusiness.currency || "INR"}
      initialOpenModal={action === "new"}
    />
  );
}
