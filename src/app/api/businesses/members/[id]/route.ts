import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { businessService } from "@/modules/businesses/services/business.service";
import { AppError } from "@/shared/errors/app-error";

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const reqHeaders = await headers();
    const { business, user, role } = await getActiveBusinessContext(reqHeaders);

    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only Owners and Admins can remove workspace members." },
        { status: 403 }
      );
    }

    const ipAddress = reqHeaders.get("x-forwarded-for") || null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const result = await businessService.removeMember(business.id, id, user.id, {
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
