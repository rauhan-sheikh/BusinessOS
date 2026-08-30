import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { transactionService } from "@/modules/transactions/services/transaction.service";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, user } = await getActiveBusinessContext(reqHeaders);

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is allowed for basic reversal
    }

    const ipAddress = reqHeaders.get("x-forwarded-for") || null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const reversal = await transactionService.reverseTransaction(
      id,
      business.id,
      user.id,
      body,
      { ipAddress, userAgent }
    );

    return NextResponse.json({ reversal: serializeBigInt(reversal) }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("POST /api/transactions/[id]/reverse error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
