import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { PERMISSION, hasPermission } from "@/modules/auth/permissions";
import { serializeBigInt } from "@/shared/utils/serialize";
import InvoicesClient, { type InvoiceRow } from "./InvoicesClient";

const PAGE_SIZE = 25;

export default async function InvoicesPage() {
  const { business, role, actor } = await getActiveBusinessContext();

  const { invoices, totalCount } = await invoiceService.listInvoices(business.id, actor, {
    kind: "SALES",
    limit: PAGE_SIZE,
  });

  return (
    <InvoicesClient
      initialInvoices={serializeBigInt(invoices) as unknown as InvoiceRow[]}
      initialTotalCount={totalCount}
      pageSize={PAGE_SIZE}
      currency={business.currency || "INR"}
      canCreate={hasPermission(role, PERMISSION.INVOICE_CREATE)}
      canIssue={hasPermission(role, PERMISSION.INVOICE_ISSUE)}
      canCancel={hasPermission(role, PERMISSION.INVOICE_CANCEL)}
    />
  );
}
