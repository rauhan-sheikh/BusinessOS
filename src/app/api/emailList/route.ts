import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { emailListService } from "@/modules/emailList/services/emailList.service";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";
import { rateLimit, clientKey } from "@/shared/utils/rate-limit";

/**
 * Public newsletter subscription.
 *
 * Answers identically whether or not the address is already on the list. It
 * previously returned 409 for a known address, and since every registered
 * user's email is added on sign-up, that turned this unauthenticated endpoint
 * into an account-existence oracle.
 */
export async function POST(request: Request) {
  try {
    const reqHeaders = await headers();

    const { allowed, retryAfter } = rateLimit(clientKey(reqHeaders, "emailList"), {
      limit: 5,
      windowSeconds: 60,
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const body = await request.json();
    await emailListService.subscribe(body);

    // 202: accepted, with no statement about what was already stored.
    return NextResponse.json({ subscribed: true }, { status: 202 });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("POST /api/emailList error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
