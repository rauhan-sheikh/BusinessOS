import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { businessService } from "@/modules/businesses/services/business.service";
import { AppError } from "@/shared/errors/app-error";
import { ZodError } from "zod";
import { getClientInfo } from "@/shared/api/request";

/**
 * Change a member's role.
 *
 * Without this a mis-assigned or rogue member could only be deleted, never
 * demoted. Granting or revoking OWNER is gated to owners inside the service.
 */
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

    const membership = await businessService.updateMemberRole(business.id, id, actor, body, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ membership }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("PATCH /api/businesses/members/[id] error:", err);
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

    const result = await businessService.removeMember(business.id, id, actor, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("DELETE /api/businesses/members/[id] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
