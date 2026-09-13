import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { serializeBigInt } from "@/shared/utils/serialize";
import PrintInvoiceClient, {
  type PrintInvoice,
  type PrintBusiness,
} from "./PrintInvoiceClient";

/**
 * Browsers print the document title into the page header, so naming it after
 * the invoice makes the saved PDF land with a useful filename rather than
 * "BusinessOS".
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const { business, actor } = await getActiveBusinessContext();
    const invoice = await invoiceService.getInvoice(id, business.id, actor);
    if (!invoice) return { title: "Invoice" };

    const label = invoice.kind === "SALES" ? "Tax Invoice" : "Purchase Bill";
    return { title: `${label} ${invoice.number ?? "(draft)"} - ${invoice.party.name}` };
  } catch {
    // Metadata must never be the thing that fails a page; the page below
    // resolves access properly and will redirect or 404 on its own.
    return { title: "Invoice" };
  }
}

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business, actor } = await getActiveBusinessContext();

  const invoice = await invoiceService.getInvoice(id, business.id, actor);
  if (!invoice) notFound();

  // Only what the document prints. The workspace record carries more than
  // belongs on a statutory invoice.
  const printBusiness: PrintBusiness = {
    name: business.name,
    legalName: business.legalName,
    gstin: business.gstin,
    pan: business.pan,
    email: business.email,
    phone: business.phone,
    address: business.address,
    currency: business.currency || "INR",
  };

  return (
    <PrintInvoiceClient
      invoice={serializeBigInt(invoice) as unknown as PrintInvoice}
      business={printBusiness}
    />
  );
}
