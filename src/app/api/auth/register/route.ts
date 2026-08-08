import { NextResponse } from "next/server";
import { authService } from "@/modules/auth/services/auth.service";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await authService.register(body);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err: unknown) {
    // Handle validation errors from Zod
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }

    // Handle database resource conflicts (e.g., email already exists)
    if (err instanceof AppError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      );
    }

    // Fallback for unexpected system errors (unhandled crash exceptions)
    console.error("Internal Server Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
