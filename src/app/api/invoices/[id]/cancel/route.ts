import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { cancelInvoiceSchema } from "@/modules/invoices/schemas/invoice.schema";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";

/** Reverses the posting. The document and its number are kept. */
export const POST = withApiHandler(
  "POST /api/invoices/[id]/cancel",
  async (request: Request, props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const body = await request.json().catch(() => ({}));
    const { reason } = cancelInvoiceSchema.parse(body);

    const invoice = await invoiceService.cancel(
      id,
      business.id,
      actor,
      reason || undefined,
      getClientInfo(reqHeaders)
    );

    return NextResponse.json({ invoice: serializeBigInt(invoice) }, { status: 200 });
  }
);
