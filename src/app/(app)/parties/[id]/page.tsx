import { partyService } from "@/modules/parties/services/party.service";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { notFound } from "next/navigation";
import PartyDetailClient, { type PartyDetailData } from "./PartyDetailClient";
import { serializeBigInt } from "@/shared/utils/serialize";


export default async function PartyDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { business: activeBusiness, actor } = await getActiveBusinessContext();

  let party;
  try {
    party = await partyService.getPartyById(id, activeBusiness.id, actor);
  } catch {
    notFound();
  }

  if (!party) {
    notFound();
  }

  return (
    <PartyDetailClient
      initialParty={serializeBigInt(party) as unknown as PartyDetailData}
      currency={activeBusiness.currency || "INR"}
    />
  );
}
