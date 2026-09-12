import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { emailListService } from "@/modules/emailList/services/emailList.service";
import { rateLimit, clientKey } from "@/shared/utils/rate-limit";
import { withApiHandler } from "@/shared/api/handler";

/**
 * Public newsletter subscription.
 *
 * Answers identically whether or not the address is already on the list. It
 * previously returned 409 for a known address, and since every registered
 * user's email is added on sign-up, that turned this unauthenticated endpoint
 * into an account-existence oracle.
 */
export const POST = withApiHandler(
  "POST /api/emailList",
  async (request: Request) => {
    const reqHeaders = await headers();

    const { allowed, retryAfter } = rateLimit(clientKey(reqHeaders, "emailList"), {
      limit: 5,
      windowSeconds: 60,
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = await request.json();
    await emailListService.subscribe(body);

    // 202: accepted, with no statement about what was already stored.
    return NextResponse.json({ subscribed: true }, { status: 202 });
  }
);
