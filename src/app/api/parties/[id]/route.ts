import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { partyService } from "@/modules/parties/services/party.service";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";


export const GET = withApiHandler(
  "GET /api/parties/[id]",
  async (_request: Request,
  props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const { business, actor } = await getActiveBusinessContext();

    const party = await partyService.getPartyById(id, business.id, actor);

    return NextResponse.json({ party: serializeBigInt(party) }, { status: 200 });
  }
);

export const PATCH = withApiHandler(
  "PATCH /api/parties/[id]",
  async (request: Request,
  props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const body = await request.json();
    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const party = await partyService.updateParty(id, business.id, actor, body, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ party: serializeBigInt(party) }, { status: 200 });
  }
);

export const DELETE = withApiHandler(
  "DELETE /api/parties/[id]",
  async (_request: Request,
  props: { params: Promise<{ id: string }> }) => {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    await partyService.archiveParty(id, business.id, actor, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  }
);
