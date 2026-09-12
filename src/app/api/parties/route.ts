import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { partyService } from "@/modules/parties/services/party.service";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";
import { listPartiesQuerySchema } from "@/modules/parties/schemas/party.schema";

export const GET = withApiHandler(
  "GET /api/parties",
  async (request: Request) => {
    const { business, actor } = await getActiveBusinessContext();

    // Validated rather than cast: an out-of-range page or an unknown type
    // previously reached Prisma and came back as a 500.
    const query = listPartiesQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams)
    );

    const { parties, totalCount } = await partyService.listParties(business.id, actor, {
      search: query.search,
      type: query.type,
      includeArchived: query.includeArchived,
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });

    return NextResponse.json(
      {
        parties: serializeBigInt(parties),
        totalCount,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(totalCount / query.limit),
      },
      { status: 200 }
    );
  }
);

export const POST = withApiHandler(
  "POST /api/parties",
  async (request: Request) => {
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const body = await request.json();
    const { ipAddress, userAgent } = getClientInfo(reqHeaders);

    const party = await partyService.createParty(business.id, actor, body, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ party: serializeBigInt(party) }, { status: 201 });
  }
);
