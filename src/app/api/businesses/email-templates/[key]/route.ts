import { NextResponse } from "next/server";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { emailTemplateService } from "@/modules/businesses/services/email-template.service";
import { withApiHandler } from "@/shared/api/handler";

/** Save this workspace's wording for one template. */
export const PUT = withApiHandler(
  "PUT /api/businesses/email-templates/[key]",
  async (request: Request, props: { params: Promise<{ key: string }> }) => {
    const { key } = await props.params;
    const { business, actor } = await getActiveBusinessContext();

    const body = await request.json();
    const saved = await emailTemplateService.saveOverride(business.id, actor, key, body);

    return NextResponse.json({ template: saved }, { status: 200 });
  }
);

/** Restore the built-in wording. */
export const DELETE = withApiHandler(
  "DELETE /api/businesses/email-templates/[key]",
  async (_request: Request, props: { params: Promise<{ key: string }> }) => {
    const { key } = await props.params;
    const { business, actor } = await getActiveBusinessContext();

    const result = await emailTemplateService.resetToDefault(business.id, actor, key);

    return NextResponse.json(result, { status: 200 });
  }
);

/** Render with sample values, without sending. */
export const POST = withApiHandler(
  "POST /api/businesses/email-templates/[key]",
  async (request: Request, props: { params: Promise<{ key: string }> }) => {
    const { key } = await props.params;
    const { actor } = await getActiveBusinessContext();

    const body = await request.json().catch(() => ({}));
    const preview = await emailTemplateService.preview(actor, key, body);

    return NextResponse.json({ preview }, { status: 200 });
  }
);
