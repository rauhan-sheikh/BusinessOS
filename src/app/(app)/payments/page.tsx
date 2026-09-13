import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { partyService } from "@/modules/parties/services/party.service";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { PERMISSION, hasPermission } from "@/modules/auth/permissions";
import { serializeBigInt } from "@/shared/utils/serialize";
import PaymentsClient, { type PaymentRow } from "./PaymentsClient";
import type { PartyOption } from "./RecordPaymentModal";

const PAGE_SIZE = 25;
const PARTY_LIMIT = 200;

export default async function PaymentsPage() {
  const { business, role, actor } = await getActiveBusinessContext();

  const [{ payments, totalCount }, { parties }] = await Promise.all([
    invoiceService.listPayments(business.id, actor, { limit: PAGE_SIZE }),
    partyService.listParties(business.id, actor, { limit: PARTY_LIMIT }),
  ]);

  const partyOptions: PartyOption[] = parties.map((party) => ({
    id: party.id,
    name: party.name,
  }));

  return (
    <PaymentsClient
      initialPayments={serializeBigInt(payments) as unknown as PaymentRow[]}
      initialTotalCount={totalCount}
      pageSize={PAGE_SIZE}
      currency={business.currency || "INR"}
      parties={partyOptions}
      canRecord={hasPermission(role, PERMISSION.PAYMENT_RECORD)}
      canReverse={hasPermission(role, PERMISSION.PAYMENT_REVERSE)}
    />
  );
}
