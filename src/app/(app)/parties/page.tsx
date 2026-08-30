import { headers } from "next/headers";
import { partyService } from "@/modules/parties/services/party.service";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
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
  const reqHeaders = await headers();
  const { business: activeBusiness } = await getActiveBusinessContext(reqHeaders);

  const parties = await partyService.listParties(activeBusiness.id);

  return (
    <PartiesClient
      initialParties={serializeBigInt(parties) as unknown as PartyWithBalance[]}
      currency={activeBusiness.currency || "INR"}
      initialOpenModal={action === "new"}
    />
  );
}
