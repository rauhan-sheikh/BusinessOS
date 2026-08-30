import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { headers } from "next/headers";
import SettingsClient, {
  type BusinessData,
  type MemberData,
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
  const session = await auth.api.getSession({ headers: await headers() });
  const memberships = await businessService.getBusinessesForUser(session!.user.id);
  const activeMembership = memberships[0];
  const activeBusiness = activeMembership.business;

  const [members, auditLogs] = await Promise.all([
    businessService.getMembers(activeBusiness.id),
    businessService.getAuditLogs(activeBusiness.id, 50),
  ]);

  return (
    <SettingsClient
      initialBusiness={activeBusiness as unknown as BusinessData}
      initialMembers={serializeBigInt(members) as unknown as MemberData[]}
      initialAuditLogs={serializeBigInt(auditLogs) as unknown as AuditLogData[]}
      currentUserRole={activeMembership.role}
    />
  );
}
