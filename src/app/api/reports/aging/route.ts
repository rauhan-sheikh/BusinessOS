import { NextResponse } from "next/server";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import { agingQuerySchema } from "@/modules/invoices/schemas/invoice.schema";
import { serializeBigInt } from "@/shared/utils/serialize";
import { withApiHandler } from "@/shared/api/handler";

export const GET = withApiHandler(
  "GET /api/reports/aging",
  async (request: Request) => {
    const { business, actor } = await getActiveBusinessContext();

    const query = agingQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams)
    );

    const report = await invoiceService.agingReport(business.id, actor, {
      kind: query.kind,
      asAt: query.asAt,
    });

    return NextResponse.json({ report: serializeBigInt(report) }, { status: 200 });
  }
);
