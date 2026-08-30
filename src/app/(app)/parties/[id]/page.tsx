import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { partyService } from "@/modules/parties/services/party.service";
import { headers } from "next/headers";
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
  const session = await auth.api.getSession({ headers: await headers() });
  const memberships = await businessService.getBusinessesForUser(session!.user.id);
  const activeBusiness = memberships[0].business;

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
