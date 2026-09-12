import { NextResponse } from "next/server";
import { ZodError, type ZodIssue } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors/app-error";

/**
 * One error boundary for every route handler.
 *
 * The same try/catch ladder was copied into roughly eighteen handlers, which
 * meant three problems: six of them omitted the ZodError branch and returned
 * 500 for a validation failure; Prisma errors were mapped nowhere, so a unique
 * violation or a missing row also became a 500; and the response shape differed
 * by branch, with Zod returning an array under `error` and AppError a string,
 * forcing clients to inspect the type of `error` before reading it.
 *
 * `error` is now always a human-readable string. Machine-readable detail goes
 * in `code`, and field-level validation detail in `issues`.
 */
export interface ApiErrorBody {
  error: string;
  code: ApiErrorCode;
  issues?: ZodIssue[];
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

function codeForStatus(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    default:
      return "INTERNAL_ERROR";
  }
}

/** Maps a thrown value to the response a client should see. */
export function toErrorResponse(context: string, err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: err.issues[0]?.message ?? "The submitted data is invalid.",
        code: "VALIDATION_ERROR" as const,
        issues: err.issues,
      },
      { status: 400 }
    );
  }

  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message, code: codeForStatus(err.statusCode) },
      { status: err.statusCode }
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 unique violation, P2025 record not found. Both previously fell
    // through to a 500, so a duplicate looked like a server fault.
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "That record already exists.", code: "CONFLICT" as const },
        { status: 409 }
      );
    }
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: "The requested record was not found.", code: "NOT_FOUND" as const },
        { status: 404 }
      );
    }
    if (err.code === "P2003") {
      return NextResponse.json(
        {
          error: "That record is still referenced by other data and cannot be changed.",
          code: "CONFLICT" as const,
        },
        { status: 409 }
      );
    }
  }

  // Anything unrecognised is a bug. Log it server-side; tell the caller nothing
  // about internals.
  console.error(`${context} error:`, err);
  return NextResponse.json(
    { error: "Internal Server Error", code: "INTERNAL_ERROR" as const },
    { status: 500 }
  );
}

type RouteHandler<Args extends unknown[]> = (...args: Args) => Promise<Response>;

/**
 * Wraps a route handler so it can throw freely.
 *
 * `context` names the route in server logs, replacing the hand-written strings
 * that had drifted out of step with the files they lived in.
 */
export function withApiHandler<Args extends unknown[]>(
  context: string,
  handler: RouteHandler<Args>
): RouteHandler<Args> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (err) {
      return toErrorResponse(context, err);
    }
  };
}
