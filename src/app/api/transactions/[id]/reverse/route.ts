import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { transactionService } from "@/modules/transactions/services/transaction.service";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";


export const POST = withApiHandler(
  "POST /api/transactions/[id]/reverse",
  async (request: Request,
  props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is allowed for basic reversal
    }

    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const reversal = await transactionService.reverseTransaction(
      id,
      business.id,
      actor,
      body,
      { ipAddress, userAgent }
    );

    return NextResponse.json({ reversal: serializeBigInt(reversal) }, { status: 201 });
  }
);
