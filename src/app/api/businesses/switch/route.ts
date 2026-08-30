import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { AppError } from "@/shared/errors/app-error";
import { z } from "zod";

const switchBusinessSchema = z.object({
  businessId: z.string().uuid("Invalid business ID"),
});

export async function POST(request: Request) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { businessId } = switchBusinessSchema.parse(body);

    // Verify user is a member of the requested business
    const memberships = await businessService.getBusinessesForUser(session.user.id);
    const targetMembership = memberships.find((m) => m.businessId === businessId);

    if (!targetMembership) {
      throw new AppError("You are not a member of this business workspace.", 403);
    }

    const response = NextResponse.json(
      {
        success: true,
        activeBusiness: targetMembership.business,
        role: targetMembership.role,
      },
      { status: 200 }
    );

    // Set cookie
    response.cookies.set("active_business_id", businessId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("POST /api/businesses/switch error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
