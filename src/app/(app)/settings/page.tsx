import { headers } from "next/headers";
import { businessService } from "@/modules/businesses/services/business.service";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import { emailTemplateService } from "@/modules/businesses/services/email-template.service";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { PERMISSION, hasPermission } from "@/modules/auth/permissions";
import { serializeBigInt } from "@/shared/utils/serialize";
import type { EmailTemplateView } from "./EmailTemplatesPanel";
import SettingsClient, {
  type BusinessData,
  type MemberData,
  type InvitationData,
  type AuditLogData,
} from "./SettingsClient";

export default async function SettingsPage() {
  const reqHeaders = await headers();
  const {
    business: activeBusiness,
    role: activeRole,
    actor,
  } = await getActiveBusinessContext(reqHeaders);

  // Sections the role cannot see are not fetched at all, rather than fetched
  // and hidden in the client - invitations in particular carry credentials.
  const canViewInvitations = hasPermission(activeRole, PERMISSION.INVITATION_VIEW);
  const canViewAudit = hasPermission(activeRole, PERMISSION.AUDIT_VIEW);
  const canManageEmails = hasPermission(activeRole, PERMISSION.EMAIL_TEMPLATE_MANAGE);

  const [members, invitations, auditLogs, emailTemplates] = await Promise.all([
    businessService.getMembers(activeBusiness.id, actor),
    canViewInvitations ? invitationService.listInvitations(activeBusiness.id, actor) : [],
    canViewAudit ? businessService.getAuditLogs(activeBusiness.id, actor, 50) : [],
    canManageEmails ? emailTemplateService.listTemplates(activeBusiness.id, actor) : [],
  ]);

  return (
    <SettingsClient
      initialBusiness={serializeBigInt(activeBusiness) as unknown as BusinessData}
      initialMembers={serializeBigInt(members) as unknown as MemberData[]}
      initialInvitations={serializeBigInt(invitations) as unknown as InvitationData[]}
      initialAuditLogs={serializeBigInt(auditLogs) as unknown as AuditLogData[]}
      initialEmailTemplates={serializeBigInt(emailTemplates) as unknown as EmailTemplateView[]}
      currentUserRole={activeRole}
    />
  );
}
