import { headers } from "next/headers";
import { partyService } from "@/modules/parties/services/party.service";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { notFound } from "next/navigation";
import PartyDetailClient, { type PartyDetailData } from "./PartyDetailClient";

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export default async function PartyDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const reqHeaders = await headers();
  const { business: activeBusiness } = await getActiveBusinessContext(reqHeaders);

  let party;
  try {
    party = await partyService.getPartyById(id, activeBusiness.id);
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
