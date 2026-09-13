import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { serializeBigInt } from "@/shared/utils/serialize";
import AgingClient, { type AgingReportData } from "./AgingClient";

export default async function AgingReportPage() {
  const { business, actor } = await getActiveBusinessContext();

  const report = await invoiceService.agingReport(business.id, actor, { kind: "SALES" });

  return (
    <AgingClient
      initialReport={serializeBigInt(report) as unknown as AgingReportData}
      currency={business.currency || "INR"}
    />
  );
}
