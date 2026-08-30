import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { partyService } from "@/modules/parties/services/party.service";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";

// Helper to serialize objects with BigInt to standard JSON
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
    const search = searchParams.get("search") || undefined;
    const type = (searchParams.get("type") as "all" | "receivable" | "payable") || "all";
    const includeArchived = searchParams.get("includeArchived") === "true";

    const parties = await partyService.listParties(business.id, {
      search,
      type,
      includeArchived,
    });

    return NextResponse.json({ parties: serializeBigInt(parties) }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("GET /api/parties error:", err);
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

    const party = await partyService.createParty(business.id, user.id, body, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ party: serializeBigInt(party) }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("POST /api/parties error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
