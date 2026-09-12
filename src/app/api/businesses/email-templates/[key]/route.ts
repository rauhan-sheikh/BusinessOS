import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { emailTemplateService } from "@/modules/businesses/services/email-template.service";
import { AppError } from "@/shared/errors/app-error";

/** Save this workspace's wording for one template. */
export async function PUT(request: Request, props: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext(reqHeaders);

    const body = await request.json();
    const saved = await emailTemplateService.saveOverride(business.id, actor, key, body);

    return NextResponse.json({ template: saved }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("PUT /api/businesses/email-templates/[key] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Restore the built-in wording. */
export async function DELETE(_request: Request, props: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await props.params;
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext(reqHeaders);

    const result = await emailTemplateService.resetToDefault(business.id, actor, key);

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("DELETE /api/businesses/email-templates/[key] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Render with sample values, without sending. */
export async function POST(request: Request, props: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await props.params;
    const reqHeaders = await headers();
    const { actor } = await getActiveBusinessContext(reqHeaders);

    const body = await request.json().catch(() => ({}));
    const preview = await emailTemplateService.preview(actor, key, body);

    return NextResponse.json({ preview }, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("POST /api/businesses/email-templates/[key] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
