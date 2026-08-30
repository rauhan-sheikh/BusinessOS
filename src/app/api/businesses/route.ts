import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";
import { headers } from "next/headers";

export async function POST(request: Request) {
  try {
    // Verify authentication server-side
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const business = await businessService.createBusiness(session.user.id, body);

    const response = NextResponse.json({ business }, { status: 201 });
    response.cookies.set("active_business_id", business.id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      );
    }
    console.error("POST /api/businesses error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const reqHeaders = await headers();
    const { business, user, role } = await getActiveBusinessContext(reqHeaders);

    if (role === "ACCOUNTANT") {
      return NextResponse.json(
        { error: "Only workspace Owners and Admins can update business settings." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const ipAddress = reqHeaders.get("x-forwarded-for") || null;
    const userAgent = reqHeaders.get("user-agent") || null;

    const updated = await businessService.updateBusiness(business.id, user.id, body, {
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ business: updated }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      );
    }
    console.error("PATCH /api/businesses error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
