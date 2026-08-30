import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { transactionService } from "@/modules/transactions/services/transaction.service";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";
import type { TransactionType } from "@/generated/prisma/client";

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export async function GET(request: Request) {
  try {
    const reqHeaders = await headers();
    const { business } = await getActiveBusinessContext(reqHeaders);

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

    const { transactions, totalCount } = await transactionService.listTransactions(business.id, {
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
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("GET /api/transactions error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const reqHeaders = await headers();
    const { business, user } = await getActiveBusinessContext(reqHeaders);

    const body = await request.json();
    const ipAddress = reqHeaders.get("x-forwarded-for") || null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const transaction = await transactionService.recordTransaction(
      business.id,
      user.id,
      body,
      { ipAddress, userAgent }
    );

    return NextResponse.json({ transaction: serializeBigInt(transaction) }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("POST /api/transactions error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
