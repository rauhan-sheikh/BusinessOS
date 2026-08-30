import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { partyService } from "@/modules/parties/services/party.service";
import { headers } from "next/headers";
import PartiesClient, { type PartyWithBalance } from "./PartiesClient";

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export default async function PartiesPage(props: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await props.searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  const memberships = await businessService.getBusinessesForUser(session!.user.id);
  const activeBusiness = memberships[0].business;

  const parties = await partyService.listParties(activeBusiness.id);

  return (
    <PartiesClient
      initialParties={serializeBigInt(parties) as unknown as PartyWithBalance[]}
      currency={activeBusiness.currency || "INR"}
      initialOpenModal={action === "new"}
    />
  );
}
