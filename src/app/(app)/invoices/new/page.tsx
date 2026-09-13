import { redirect } from "next/navigation";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { partyService } from "@/modules/parties/services/party.service";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { PERMISSION, hasPermission } from "@/modules/auth/permissions";
import NewInvoiceClient, { type PartyOption, type ItemOption } from "./NewInvoiceClient";

/**
 * Enough of the catalogue and the address book to fill a form without a
 * round-trip. Both are capped: past a few hundred entries a dropdown is the
 * wrong control, and a search field should replace it.
 */
const PARTY_LIMIT = 200;
const ITEM_LIMIT = 200;

export default async function NewInvoicePage() {
  const { business, role, actor } = await getActiveBusinessContext();

  // The service layer would refuse anyway; this turns a 403 into a redirect
  // rather than an error page for someone who simply cannot create invoices.
  if (!hasPermission(role, PERMISSION.INVOICE_CREATE)) {
    redirect("/invoices");
  }

  const [{ parties }, { items }] = await Promise.all([
    partyService.listParties(business.id, actor, { limit: PARTY_LIMIT }),
    invoiceService.listItems(business.id, actor, { limit: ITEM_LIMIT }),
  ]);

  // Mapped by hand rather than serialized wholesale: the form needs three
  // fields from a party, and sending the rest would put balances on the wire
  // for no reason.
  const partyOptions: PartyOption[] = parties.map((party) => ({
    id: party.id,
    name: party.name,
    gstin: party.gstin,
  }));

  const itemOptions: ItemOption[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    hsnSacCode: item.hsnSacCode,
    unitOfMeasure: item.unitOfMeasure,
    unitPriceMinor: item.unitPriceMinor.toString(),
    taxRateBps: item.taxRateBps,
  }));

  return (
    <NewInvoiceClient
      parties={partyOptions}
      items={itemOptions}
      currency={business.currency || "INR"}
      businessGstin={business.gstin}
    />
  );
}
