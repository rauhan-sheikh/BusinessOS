import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";
import { AppError } from "@/shared/errors/app-error";

export const GET = withApiHandler(
  "GET /api/invoices/[id]",
  async (_request: Request, props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const { business, actor } = await getActiveBusinessContext();

    const invoice = await invoiceService.getInvoice(id, business.id, actor);
    if (!invoice) throw new AppError("Invoice not found", 404);

    return NextResponse.json({ invoice: serializeBigInt(invoice) }, { status: 200 });
  }
);

/** Only a draft can be deleted; an issued invoice is cancelled instead. */
export const DELETE = withApiHandler(
  "DELETE /api/invoices/[id]",
  async (_request: Request, props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    await invoiceService.deleteDraft(id, business.id, actor, getClientInfo(reqHeaders));

    return NextResponse.json({ deleted: true }, { status: 200 });
  }
);
