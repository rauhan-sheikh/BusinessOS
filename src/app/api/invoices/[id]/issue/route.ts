import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";

/** Allocates the invoice number and posts it to the books. */
export const POST = withApiHandler(
  "POST /api/invoices/[id]/issue",
  async (_request: Request, props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const invoice = await invoiceService.issue(
      id,
      business.id,
      actor,
      getClientInfo(reqHeaders)
    );

    return NextResponse.json({ invoice: serializeBigInt(invoice) }, { status: 200 });
  }
);
