"use client";

import { useState } from "react";
import type { BusinessRole } from "@/generated/prisma/client";
import { PERMISSION, hasPermission } from "@/modules/auth/permissions";
import EmailTemplatesPanel, { type EmailTemplateView } from "./EmailTemplatesPanel";
import {
  useToast,
  useConfirm,
  Modal,
  Button,
  InputField,
  SelectField,
  TextareaField,
} from "@/shared/components/ui";

export interface BusinessData {
  id: string;
  name: string;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  currency: string;
  timezone: string;
}

export interface MemberData {
  id: string;
  role: BusinessRole;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  };
}

export interface InvitationData {
  id: string;
  email: string;
  role: BusinessRole;
  inviteUrl: string | null;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
  inviter: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AuditLogData {
  id: string;
  actionType: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface SettingsClientProps {
  initialBusiness: BusinessData;
  initialMembers: MemberData[];
  initialInvitations: InvitationData[];
  initialAuditLogs: AuditLogData[];
  initialEmailTemplates: EmailTemplateView[];
  currentUserRole: BusinessRole;
}

export default function SettingsClient({
  initialBusiness,
  initialMembers,
  initialInvitations,
  initialAuditLogs,
  initialEmailTemplates,
  currentUserRole,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "team" | "emails" | "audit">("profile");

  // Profile Form State
  const [business, setBusiness] = useState<BusinessData>(initialBusiness);
  const [profileForm, setProfileForm] = useState({
    name: business.name,
    legalName: business.legalName || "",
    phone: business.phone || "",
    email: business.email || "",
    address: business.address || "",
    gstin: business.gstin || "",
    pan: business.pan || "",
    currency: business.currency,
    timezone: business.timezone,
  });
  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [profileError, setProfileError] = useState("");

  // Team & Invitations State
  const [members, setMembers] = useState<MemberData[]>(initialMembers);
  const [invitations, setInvitations] = useState<InvitationData[]>(initialInvitations);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    role: "ACCOUNTANT" as "OWNER" | "ADMIN" | "ACCOUNTANT",
  });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();

  // Audit Logs State
  const [auditLogs] = useState<AuditLogData[]>(initialAuditLogs);
  const [auditSearch, setAuditSearch] = useState("");

  // Derived from the same matrix the server enforces, so the UI cannot offer
  // an action the API will reject.
  const canEditSettings = hasPermission(currentUserRole, PERMISSION.BUSINESS_SETTINGS_UPDATE);
  const canManageTeam = hasPermission(currentUserRole, PERMISSION.MEMBER_INVITE);
  const canViewAudit = hasPermission(currentUserRole, PERMISSION.AUDIT_VIEW);
  const canManageEmails = hasPermission(currentUserRole, PERMISSION.EMAIL_TEMPLATE_MANAGE);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileStatus("saving");

    try {
      const res = await fetch("/api/businesses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to update business profile");
      }

      setBusiness(data.business);
      setProfileStatus("success");
      setTimeout(() => setProfileStatus("idle"), 3000);
    } catch (err: unknown) {
      setProfileStatus("error");
      setProfileError(err instanceof Error ? err.message : "Failed to update settings");
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setCreatedInviteUrl(null);
    setInviteSubmitting(true);

    try {
      const res = await fetch("/api/businesses/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inviteForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          Array.isArray(data.error)
            ? data.error[0]?.message
            : data.error || "Failed to send invitation"
        );
      }

      setInvitations([data.invitation, ...invitations]);
      setCreatedInviteUrl(data.inviteUrl);
      setInviteForm({ email: "", role: "ACCOUNTANT" });
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    const confirmed = await confirm({
      title: "Cancel this invitation?",
      isDestructive: true,
      confirmLabel: "Cancel invitation",
      cancelLabel: "Keep it",
      message: (
        <>
          The link sent to <span className="font-semibold text-fg">{email}</span>{" "}
          stops working immediately. You can send a new one at any time.
        </>
      ),
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/businesses/invitations/${invitationId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to cancel invitation");
      }

      setInvitations(invitations.filter((i) => i.id !== invitationId));
      toast.success("Invitation cancelled.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke invitation");
    }
  };

  const handleRemoveMember = async (membershipId: string, memberEmail: string) => {
    const confirmed = await confirm({
      title: "Remove this member?",
      isDestructive: true,
      confirmLabel: "Remove member",
      message: (
        <>
          <p>
            <span className="font-semibold text-fg">{memberEmail}</span> loses
            access to this workspace straight away.
          </p>
          <p className="mt-2 text-fg-subtle">
            Entries they recorded are kept, and stay attributed to them.
          </p>
        </>
      ),
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/businesses/members/${membershipId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }

      setMembers(members.filter((m) => m.id !== membershipId));
      toast.success("Member removed.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const pendingInvitations = invitations.filter((i) => i.status === "PENDING");

  const filteredLogs = auditLogs.filter((log) => {
    if (!auditSearch) return true;
    const term = auditSearch.toLowerCase();
    return (
      log.actionType.toLowerCase().includes(term) ||
      log.user.name.toLowerCase().includes(term) ||
      log.user.email.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {confirmDialog}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings & Workspace</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your business profile, team invitations & roles, and system audit trail
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-4 overflow-x-auto pb-1">
        {[
          { id: "profile", label: "Business Profile" },
          { id: "team", label: `Team Members & Invites (${members.length + pendingInvitations.length})` },
          ...(canManageEmails ? [{ id: "emails", label: "Email Templates" }] : []),
          ...(canViewAudit ? [{ id: "audit", label: "Audit Trail" }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`pb-3 text-xs font-semibold transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: BUSINESS PROFILE */}
      {activeTab === "profile" && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 space-y-6 max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-100">Company Information</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Update legal registration details and workspace preferences
              </p>
            </div>
            {!canEditSettings && (
              <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                Read-Only ({currentUserRole})
              </span>
            )}
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Business name"
                required
                disabled={!canEditSettings}
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              />
              <InputField
                label="Legal entity name"
                disabled={!canEditSettings}
                value={profileForm.legalName}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, legalName: e.target.value })
                }
              />
              <InputField
                label="GSTIN"
                maxLength={15}
                disabled={!canEditSettings}
                value={profileForm.gstin}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, gstin: e.target.value.toUpperCase() })
                }
              />
              <InputField
                label="PAN"
                maxLength={10}
                disabled={!canEditSettings}
                value={profileForm.pan}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, pan: e.target.value.toUpperCase() })
                }
              />
              <InputField
                label="Phone number"
                type="tel"
                disabled={!canEditSettings}
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              />
              <InputField
                label="Email address"
                type="email"
                disabled={!canEditSettings}
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              />
            </div>

            <TextareaField
              label="Registered address"
              rows={2}
              disabled={!canEditSettings}
              value={profileForm.address}
              onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
              className="resize-none"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Currency"
                disabled={!canEditSettings}
                value={profileForm.currency}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, currency: e.target.value })
                }
                hint="Locked once the ledger has entries, since stored amounts are denominated in it."
              >
                <option value="INR">INR (Indian Rupee)</option>
                <option value="USD">USD (US Dollar)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="GBP">GBP (British Pound)</option>
                <option value="AED">AED (UAE Dirham)</option>
              </SelectField>
              <SelectField
                label="Timezone"
                disabled={!canEditSettings}
                value={profileForm.timezone}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, timezone: e.target.value })
                }
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                <option value="UTC">UTC (GMT +00:00)</option>
                <option value="America/New_York">America/New_York (EST -05:00)</option>
              </SelectField>
            </div>

            {profileStatus === "error" && (
              <p
                role="alert"
                className="text-xs text-danger font-medium bg-danger/10 border border-danger/20 p-2.5 rounded-xl text-center"
              >
                {profileError}
              </p>
            )}

            {canEditSettings && (
              <div className="pt-2 flex justify-end">
                <Button
                  type="submit"
                  isLoading={profileStatus === "saving"}
                  loadingLabel="Saving..."
                >
                  Save changes
                </Button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: TEAM MEMBERS & INVITATIONS */}
      {activeTab === "team" && (
        <div className="space-y-8">
          {/* Active Members Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-100">Active Workspace Members</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Users currently active in this workspace and their assigned permissions
                </p>
              </div>

              {canManageTeam && (
                <button
                  onClick={() => {
                    setIsInviteModalOpen(true);
                    setCreatedInviteUrl(null);
                    setInviteError("");
                  }}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <span>✉️</span> Invite Team Member
                </button>
              )}
            </div>

            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Member</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Role</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Joined Date</th>
                    {canManageTeam && (
                      <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-200">{m.user.name}</p>
                        <p className="text-[11px] text-slate-500">{m.user.email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            m.role === "OWNER"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : m.role === "ADMIN"
                              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {m.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(m.joinedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      {canManageTeam && (
                        <td className="py-3.5 px-4 text-right">
                          {m.role !== "OWNER" && (
                            <button
                              onClick={() => handleRemoveMember(m.id, m.user.email)}
                              className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pending Invitations Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Pending Invitations ({pendingInvitations.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Invitations sent by email awaiting member acceptance
              </p>
            </div>

            {pendingInvitations.length === 0 ? (
              <div className="rounded-2xl bg-slate-900/40 border border-slate-800/60 p-6 text-center text-xs text-slate-500">
                No pending invitations. Click &quot;Invite Team Member&quot; to send an invitation.
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold uppercase tracking-wider">Invited Email</th>
                      <th className="py-3 px-4 font-semibold uppercase tracking-wider">Role</th>
                      <th className="py-3 px-4 font-semibold uppercase tracking-wider">Sent By</th>
                      <th className="py-3 px-4 font-semibold uppercase tracking-wider">Expires</th>
                      <th className="py-3 px-4 font-semibold uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {pendingInvitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-200">
                          {inv.email}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {inv.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {inv.inviter.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {new Date(inv.expiresAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-3">
                          {inv.inviteUrl && (
                            <button
                              onClick={() => handleCopy(inv.inviteUrl!)}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                            >
                              Copy Link
                            </button>
                          )}
                          {canManageTeam && (
                            <button
                              onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                              className="text-[11px] text-rose-400 hover:text-rose-300 underline cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Send Invitation Modal */}
          {isInviteModalOpen && (
            <Modal
              isOpen={isInviteModalOpen}
              onClose={() => {
                setIsInviteModalOpen(false);
                setCreatedInviteUrl(null);
              }}
              title={createdInviteUrl ? "Invitation sent" : "Invite a workspace member"}
              description={
                createdInviteUrl
                  ? undefined
                  : "They receive an email with a link that expires in 7 days."
              }
              footer={
                createdInviteUrl ? (
                  <Button
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      setCreatedInviteUrl(null);
                    }}
                    fullWidth
                  >
                    Done
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => setIsInviteModalOpen(false)}
                      fullWidth
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      form="invite-member-form"
                      isLoading={inviteSubmitting}
                      loadingLabel="Sending..."
                      fullWidth
                    >
                      Send invitation
                    </Button>
                  </>
                )
              }
            >
              {!createdInviteUrl ? (
                <form id="invite-member-form" onSubmit={handleSendInvite} className="space-y-4">
                  <InputField
                    label="Colleague email address"
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="colleague@company.com"
                    hint="An invitation email is sent automatically."
                  />

                  <SelectField
                    label="Workspace role"
                    required
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        role: e.target.value as typeof inviteForm.role,
                      })
                    }
                  >
                    <option value="ACCOUNTANT">Accountant &mdash; record parties and entries</option>
                    <option value="ADMIN">Admin &mdash; also manage the team and reverse entries</option>
                    {/* Only an owner may grant ownership; the server enforces
                        this too, so the option is simply not offered here. */}
                    {currentUserRole === "OWNER" && (
                      <option value="OWNER">Owner &mdash; full control, including settings</option>
                    )}
                  </SelectField>

                  {inviteError && (
                    <p
                      role="alert"
                      className="text-xs text-danger font-medium bg-danger/10 border border-danger/20 p-2.5 rounded-xl text-center"
                    >
                      {inviteError}
                    </p>
                  )}
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="p-3 rounded-xl bg-receivable/10 border border-receivable/20 text-xs text-receivable text-center">
                    The invitation email has been sent. You can also share the link directly.
                  </p>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="invite-link"
                      className="block text-[11px] font-medium text-fg-subtle"
                    >
                      Direct invitation link
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="invite-link"
                        type="text"
                        readOnly
                        value={createdInviteUrl}
                        // min-w-0 so the field can shrink instead of pushing
                        // the copy button off the edge on a narrow screen.
                        className="min-w-0 flex-1 rounded-xl bg-canvas border border-line px-3.5 py-2.5 font-mono text-[11px] text-fg"
                      />
                      <Button
                        onClick={() => handleCopy(createdInviteUrl)}
                        className="shrink-0"
                      >
                        {copiedLink ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Modal>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL */}
      {activeTab === "emails" && canManageEmails && (
        <EmailTemplatesPanel
          initialTemplates={initialEmailTemplates}
          canManage={canManageEmails}
        />
      )}

      {activeTab === "audit" && canViewAudit && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-100">Audit Log & Event History</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Immutable record of actions and configuration changes
              </p>
            </div>

            <div className="w-full sm:w-64">
              <InputField
                label="Search the audit trail"
                type="search"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search audit actions or users..."
              />
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-8 text-center text-xs text-slate-500">
              No audit logs match your search.
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Timestamp</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Action</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">Performed By</th>
                    <th className="py-3 px-4 font-semibold uppercase tracking-wider">IP / Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                          {log.actionType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-200">{log.user.name}</p>
                        <p className="text-[11px] text-slate-500">{log.user.email}</p>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {log.ipAddress || "Internal / Local"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
