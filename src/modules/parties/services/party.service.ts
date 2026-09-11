import { partyRepository, type PartyFilterOptions } from "../repositories/party.repository";
import {
  createPartySchema,
  updatePartySchema,
  type CreatePartyInput,
  type UpdatePartyInput,
} from "../schemas/party.schema";
import { auditService } from "@/modules/audit/services/audit.service";
import { AppError } from "@/shared/errors/app-error";
import { PERMISSION, requirePermission, type Actor } from "@/modules/auth/permissions";

export class PartyService {
  async listParties(businessId: string, actor: Actor, options?: PartyFilterOptions) {
    requirePermission(actor, PERMISSION.PARTY_VIEW);
    return partyRepository.findManyByBusiness(businessId, options);
  }

  async getPartyById(id: string, businessId: string, actor: Actor) {
    requirePermission(actor, PERMISSION.PARTY_VIEW);

    const party = await partyRepository.findById(id, businessId);
    if (!party) {
      throw new AppError("Party not found", 404);
    }
    return party;
  }

  async createParty(
    businessId: string,
    actor: Actor,
    input: CreatePartyInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    requirePermission(actor, PERMISSION.PARTY_CREATE);

    const validated = createPartySchema.parse(input);
    const party = await partyRepository.create(businessId, actor.userId, validated);

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "PARTY_CREATED",
      metadata: {
        partyId: party.id,
        partyName: party.name,
        openingBalanceMinor: party.openingTransaction?.amountMinor
          ? party.openingTransaction.amountMinor.toString()
          : "0",
      },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return party;
  }

  async updateParty(
    id: string,
    businessId: string,
    actor: Actor,
    input: UpdatePartyInput,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    requirePermission(actor, PERMISSION.PARTY_UPDATE);

    const validated = updatePartySchema.parse(input);
    const existing = await partyRepository.findById(id, businessId);
    if (!existing) {
      throw new AppError("Party not found", 404);
    }

    const updated = await partyRepository.update(id, businessId, validated);

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "PARTY_UPDATED",
      metadata: { partyId: id, changes: validated },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return updated;
  }

  async archiveParty(
    id: string,
    businessId: string,
    actor: Actor,
    clientInfo?: { ipAddress?: string | null; userAgent?: string | null }
  ) {
    requirePermission(actor, PERMISSION.PARTY_ARCHIVE);

    const existing = await partyRepository.findById(id, businessId);
    if (!existing) {
      throw new AppError("Party not found", 404);
    }

    const archived = await partyRepository.update(id, businessId, { isArchived: true });

    await auditService.log({
      businessId,
      userId: actor.userId,
      actionType: "PARTY_ARCHIVED",
      metadata: { partyId: id, partyName: existing.name },
      ipAddress: clientInfo?.ipAddress,
      userAgent: clientInfo?.userAgent,
    });

    return archived;
  }

  async getBusinessPartyAggregates(businessId: string, actor: Actor) {
    requirePermission(actor, PERMISSION.PARTY_VIEW);
    return partyRepository.getAggregates(businessId);
  }
}

export const partyService = new PartyService();
