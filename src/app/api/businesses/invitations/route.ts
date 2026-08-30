import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import { addMemberSchema } from "@/modules/businesses/schemas/member.schema";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";

export async function GET() {
  try {
    const reqHeaders = await headers();
    const { business } = await getActiveBusinessContext(reqHeaders);

    const invitations = await invitationService.listInvitations(business.id);

    return NextResponse.json({ invitations }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("GET /api/businesses/invitations error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const reqHeaders = await headers();
    const { business, user, role } = await getActiveBusinessContext(reqHeaders);

    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only Owners and Admins can invite members to this workspace." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = addMemberSchema.parse(body);

    const ipAddress = reqHeaders.get("x-forwarded-for") || null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const result = await invitationService.inviteMember(
      business.id,
      user.id,
      validated.email,
      validated.role,
      { ipAddress, userAgent }
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("POST /api/businesses/invitations error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
