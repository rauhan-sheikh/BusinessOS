import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import {
  recordPaymentSchema,
  listPaymentsQuerySchema,
} from "@/modules/invoices/schemas/invoice.schema";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";

export const GET = withApiHandler(
  "GET /api/payments",
  async (request: Request) => {
    const { business, actor } = await getActiveBusinessContext();

    // Parsed rather than read field by field: the previous version dropped
    // limit and offset entirely, so every page of a paginated list returned
    // the same first 50 rows, and it recognised only PURCHASE - asking for
    // SALES silently returned both directions.
    const query = listPaymentsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams)
    );

    const { payments, totalCount } = await invoiceService.listPayments(business.id, actor, {
      partyId: query.partyId,
      kind: query.kind,
      limit: query.limit,
      offset: query.offset,
    });

    return NextResponse.json(
      {
        payments: serializeBigInt(payments),
        totalCount,
        limit: query.limit,
        offset: query.offset,
      },
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
