import { NextResponse } from "next/server";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { invoiceService } from "@/modules/invoices/services/invoice.service";
import {
  createInvoiceSchema,
  listInvoicesQuerySchema,
} from "@/modules/invoices/schemas/invoice.schema";
import { serializeBigInt } from "@/shared/utils/serialize";
import { getClientInfo } from "@/shared/api/request";
import { withApiHandler } from "@/shared/api/handler";
import { headers } from "next/headers";

export const GET = withApiHandler(
  "GET /api/invoices",
  async (request: Request) => {
    const { business, actor } = await getActiveBusinessContext();

    const query = listInvoicesQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams)
    );

    const { invoices, totalCount } = await invoiceService.listInvoices(business.id, actor, {
      kind: query.kind,
      status: query.status,
      partyId: query.partyId,
      search: query.search,
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });

    return NextResponse.json(
      {
        invoices: serializeBigInt(invoices),
        totalCount,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(totalCount / query.limit),
      },
      { status: 200 }
    );
  }
);

export const POST = withApiHandler(
  "POST /api/invoices",
  async (request: Request) => {
    const reqHeaders = await headers();
    const { business, actor } = await getActiveBusinessContext();

    const input = createInvoiceSchema.parse(await request.json());

    const invoice = await invoiceService.createDraft(
      business.id,
      actor,
      {
        partyId: input.partyId,
        kind: input.kind,
        issueDate: input.issueDate,
        dueDate: input.dueDate ?? null,
        placeOfSupply: input.placeOfSupply || null,
        isExempt: input.isExempt,
        roundTotalToUnit: input.roundTotalToUnit,
        notes: input.notes || null,
        terms: input.terms || null,
        lines: input.lines.map((line) => ({
          description: line.description,
          quantityMilli: line.quantityMilli,
          unitPriceMinor: line.unitPriceMinor,
          discountMinor: line.discountMinor,
          taxRateBps: line.taxRateBps,
          hsnSacCode: line.hsnSacCode || null,
          unitOfMeasure: line.unitOfMeasure || null,
          itemId: line.itemId ?? null,
        })),
      },
      getClientInfo(reqHeaders)
    );

    return NextResponse.json({ invoice: serializeBigInt(invoice) }, { status: 201 });
  }
);
