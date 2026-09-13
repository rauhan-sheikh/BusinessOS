import { notFound } from "next/navigation";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { PERMISSION, hasPermission } from "@/modules/auth/permissions";
import { serializeBigInt } from "@/shared/utils/serialize";
import InvoiceDetailClient, { type InvoiceDetail } from "./InvoiceDetailClient";

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { business, role, actor } = await getActiveBusinessContext();

  const invoice = await invoiceService.getInvoice(id, business.id, actor);

  // findById is already scoped to the business, so a missing row means either
  // no such invoice or one belonging to another workspace. Both are a 404 here:
  // distinguishing them would confirm the existence of another tenant's data.
  if (!invoice) notFound();

  return (
    <InvoiceDetailClient
      invoice={serializeBigInt(invoice) as unknown as InvoiceDetail}
      currency={business.currency || "INR"}
      canIssue={hasPermission(role, PERMISSION.INVOICE_ISSUE)}
      canCancel={hasPermission(role, PERMISSION.INVOICE_CANCEL)}
    />
  );
}
