import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { partyService } from "@/modules/parties/services/party.service";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";


export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext(reqHeaders);

    const party = await partyService.getPartyById(id, business.id, actor);

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
    const { business, actor } = await getActiveBusinessContext(reqHeaders);

    const body = await request.json();
    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const party = await partyService.updateParty(id, business.id, actor, body, {
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
    const { business, actor } = await getActiveBusinessContext(reqHeaders);

    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    await partyService.archiveParty(id, business.id, actor, {
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
