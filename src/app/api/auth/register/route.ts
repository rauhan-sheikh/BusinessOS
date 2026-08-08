import { NextResponse } from "next/server";
import { authService } from "@/modules/auth/services/auth.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const user = await authService.register(body);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
