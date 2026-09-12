import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { transactionService } from "@/modules/transactions/services/transaction.service";
import type { TransactionType } from "@/generated/prisma/client";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";


export const GET = withApiHandler(
  "GET /api/transactions",
  async (request: Request) => {
    const { business, actor } = await getActiveBusinessContext();

    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get("partyId") || undefined;
    const type = (searchParams.get("type") as TransactionType) || undefined;
    const search = searchParams.get("search") || undefined;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const startDate = startDateParam ? new Date(startDateParam) : undefined;
    const endDate = endDateParam ? new Date(endDateParam) : undefined;

    const page = searchParams.get("page")
      ? Math.max(1, parseInt(searchParams.get("page")!, 10))
      : 1;
    const limit = searchParams.get("limit")
      ? Math.min(1000, Math.max(1, parseInt(searchParams.get("limit")!, 10)))
      : 25;
    const offset = (page - 1) * limit;

    const { transactions, totalCount } = await transactionService.listTransactions(business.id, actor, {
      partyId,
      type,
      search,
      startDate,
      endDate,
      limit,
      offset,
    });

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json(
      {
        transactions: serializeBigInt(transactions),
        totalCount,
        page,
        limit,
        totalPages,
      },
      { status: 200 }
    );
  }
);

export const POST = withApiHandler(
  "POST /api/transactions",
  async (request: Request) => {
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const body = await request.json();
    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const transaction = await transactionService.recordTransaction(
      business.id,
      actor,
      body,
      { ipAddress, userAgent }
    );

    return NextResponse.json({ transaction: serializeBigInt(transaction) }, { status: 201 });
  }
);
