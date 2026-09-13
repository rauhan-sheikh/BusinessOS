import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { reversePaymentSchema } from "@/modules/invoices/schemas/invoice.schema";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";

/**
 * Reverses a payment out of the books.
 *
 * The payment row is kept and marked, and its allocations are removed, so every
 * invoice it had settled goes back to outstanding. Gated on PAYMENT_REVERSE,
 * which ADMIN and OWNER hold but ACCOUNTANT does not: reversal rewrites the
 * record of what happened, so it sits with the other correction-of-record
 * actions rather than with everyday entry.
 */
export const POST = withApiHandler(
  "POST /api/payments/[id]/reverse",
  async (request: Request, props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const body = await request.json().catch(() => ({}));
    const { reason } = reversePaymentSchema.parse(body);

    const result = await invoiceService.reversePayment(
      id,
      business.id,
      actor,
      reason || undefined,
      getClientInfo(reqHeaders)
    );

    return NextResponse.json(serializeBigInt(result), { status: 200 });
  }
);
