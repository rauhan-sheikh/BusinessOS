import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { recordPaymentSchema } from "@/modules/invoices/schemas/invoice.schema";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";

export const GET = withApiHandler(
  "GET /api/payments",
  async (request: Request) => {
    const { business, actor } = await getActiveBusinessContext();
    const params = new URL(request.url).searchParams;

    const { payments, totalCount } = await invoiceService.listPayments(business.id, actor, {
      partyId: params.get("partyId") ?? undefined,
      kind: params.get("kind") === "PURCHASE" ? "PURCHASE" : undefined,
    });

    return NextResponse.json(
      { payments: serializeBigInt(payments), totalCount },
      { status: 200 }
    );
  }
);

export const POST = withApiHandler(
  "POST /api/payments",
  async (request: Request) => {
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const input = recordPaymentSchema.parse(await request.json());

    const payment = await invoiceService.recordPayment(
      business.id,
      actor,
      {
        partyId: input.partyId,
        kind: input.kind,
        amountMinor: input.amountMinor,
        paymentDate: input.paymentDate,
        method: input.method || null,
        reference: input.reference || null,
        notes: input.notes || null,
        allocations: input.allocations,
      },
      getClientInfo(reqHeaders)
    );

    return NextResponse.json({ payment: serializeBigInt(payment) }, { status: 201 });
  }
);
