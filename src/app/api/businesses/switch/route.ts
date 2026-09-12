import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { AppError } from "@/shared/errors/app-error";
import { z } from "zod";
import { setActiveBusinessCookie } from "@/shared/api/cookies";
import { withApiHandler } from "@/shared/api/handler";

const switchBusinessSchema = z.object({
  businessId: z.string().uuid("Invalid business ID"),
});

export const POST = withApiHandler(
  "POST /api/businesses/switch",
  async (request: Request) => {
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
    setActiveBusinessCookie(response, businessId);

    return response;
  }
);
