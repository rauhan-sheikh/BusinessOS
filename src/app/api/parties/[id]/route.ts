import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { partyService } from "@/modules/parties/services/party.service";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business } = await getActiveBusinessContext(reqHeaders);

    const party = await partyService.getPartyById(id, business.id);

    return NextResponse.json({ party: serializeBigInt(party) }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("GET /api/parties/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, user } = await getActiveBusinessContext(reqHeaders);

    const body = await request.json();
    const ipAddress = reqHeaders.get("x-forwarded-for") || null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const party = await partyService.updateParty(id, business.id, user.id, body, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ party: serializeBigInt(party) }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("PATCH /api/parties/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, user } = await getActiveBusinessContext(reqHeaders);

    const ipAddress = reqHeaders.get("x-forwarded-for") || null;
    const userAgent = reqHeaders.get("user-agent") || null;

    await partyService.archiveParty(id, business.id, user.id, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("DELETE /api/parties/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
