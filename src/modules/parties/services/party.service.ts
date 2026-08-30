import { partyRepository, type PartyFilterOptions } from "../repositories/party.repository";
import { createPartySchema, updatePartySchema, type CreatePartyInput, type UpdatePartyInput } from "../schemas/party.schema";
import { auditService } from "@/modules/audit/services/audit.service";
import { AppError } from "@/shared/errors/app-error";

export class PartyService {
  async listParties(businessId: string, options?: PartyFilterOptions) {
    return partyRepository.findManyByBusiness(businessId, options);
  }

  async getPartyById(id: string, businessId: string) {
    const party = await partyRepository.findById(id, businessId);
    if (!party) {
      throw new AppError("Party not found", 404);
    }
    return party;
  }

  async createParty(
    businessId: string,
    userId: string,
    input: CreatePartyInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const validated = createPartySchema.parse(input);
    const party = await partyRepository.create(businessId, userId, validated);

    await auditService.log({
      businessId,
      userId,
      actionType: "PARTY_CREATED",
      metadata: {
        partyId: party.id,
        partyName: party.name,
        openingBalanceMinor: party.openingTransaction?.amountMinor ? party.openingTransaction.amountMinor.toString() : "0",
      },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return party;
  }

  async updateParty(
    id: string,
    businessId: string,
    userId: string,
    input: UpdatePartyInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const validated = updatePartySchema.parse(input);
    const existing = await partyRepository.findById(id, businessId);
    if (!existing) {
      throw new AppError("Party not found", 404);
    }

    const updated = await partyRepository.update(id, businessId, validated);

    await auditService.log({
      businessId,
      userId,
      actionType: "PARTY_UPDATED",
      metadata: {
        partyId: id,
        changes: validated,
      },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return updated;
  }

  async archiveParty(
    id: string,
    businessId: string,
    userId: string,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    const existing = await partyRepository.findById(id, businessId);
    if (!existing) {
      throw new AppError("Party not found", 404);
    }

    const archived = await partyRepository.update(id, businessId, { isArchived: true });

    await auditService.log({
      businessId,
      userId,
      actionType: "PARTY_ARCHIVED",
      metadata: { partyId: id, partyName: existing.name },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return archived;
  }

  async getBusinessPartyAggregates(businessId: string) {
    return partyRepository.getAggregates(businessId);
  }
}

export const partyService = new PartyService();
