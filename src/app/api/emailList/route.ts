import { NextResponse } from "next/server";
import { emailListService } from "@/modules/emailList/services/emailList.service";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = await emailListService.addEmail(body);
    return NextResponse.json({ email }, { status: 201 });
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
    // Fallback for unexpected system errors
    console.error("Internal Server Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
