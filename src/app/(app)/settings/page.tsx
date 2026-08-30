import { headers } from "next/headers";
import { businessService } from "@/modules/businesses/services/business.service";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import SettingsClient, {
  type BusinessData,
  type MemberData,
  type InvitationData,
  type AuditLogData,
} from "./SettingsClient";

function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export default async function SettingsPage() {
  const reqHeaders = await headers();
  const { business: activeBusiness, role: activeRole } =
    await getActiveBusinessContext(reqHeaders);

  const [members, invitations, auditLogs] = await Promise.all([
    businessService.getMembers(activeBusiness.id),
    invitationService.listInvitations(activeBusiness.id),
    businessService.getAuditLogs(activeBusiness.id, 50),
  ]);

  return (
    <SettingsClient
      initialBusiness={activeBusiness as unknown as BusinessData}
      initialMembers={serializeBigInt(members) as unknown as MemberData[]}
      initialInvitations={serializeBigInt(invitations) as unknown as InvitationData[]}
      initialAuditLogs={serializeBigInt(auditLogs) as unknown as AuditLogData[]}
      currentUserRole={activeRole}
    />
  );
}
