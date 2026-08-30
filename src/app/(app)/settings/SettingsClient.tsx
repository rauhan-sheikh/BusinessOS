"use client";

import { useState } from "react";
import type { BusinessRole } from "@/generated/prisma/client";

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
  initialAuditLogs: AuditLogData[];
  currentUserRole: BusinessRole;
}

export default function SettingsClient({
  initialBusiness,
  initialMembers,
  initialAuditLogs,
  currentUserRole,
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "team" | "audit">("profile");

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

  // Team State
  const [members, setMembers] = useState<MemberData[]>(initialMembers);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({
    email: "",
    role: "ACCOUNTANT" as "OWNER" | "ADMIN" | "ACCOUNTANT",
  });
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberError, setMemberError] = useState("");

  // Audit Logs State
  const [auditLogs] = useState<AuditLogData[]>(initialAuditLogs);
  const [auditSearch, setAuditSearch] = useState("");

  const isOwnerOrAdmin = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setMemberError("");
    setMemberSubmitting(true);

    try {
      const res = await fetch("/api/businesses/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addMemberForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add member");
      }

      setMembers([...members, data.membership]);
      setIsAddMemberOpen(false);
      setAddMemberForm({ email: "", role: "ACCOUNTANT" });
    } catch (err: unknown) {
      setMemberError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setMemberSubmitting(false);
    }
  };

  const handleRemoveMember = async (membershipId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from this workspace?`)) return;

    try {
      const res = await fetch(`/api/businesses/members/${membershipId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove member");
      }

      setMembers(members.filter((m) => m.id !== membershipId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings & Workspace</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your business profile, team roles, and system audit trail
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-4 overflow-x-auto pb-1">
        {[
          { id: "profile", label: "Business Profile" },
          { id: "team", label: `Team Members (${members.length})` },
          { id: "audit", label: "Audit Trail" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`pb-3 text-xs font-semibold transition-all border-b-2 ${
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
            {!isOwnerOrAdmin && (
              <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                Read-Only (Accountant)
              </span>
            )}
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={!isOwnerOrAdmin}
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Legal Entity Name
                </label>
                <input
                  type="text"
                  disabled={!isOwnerOrAdmin}
                  value={profileForm.legalName}
                  onChange={(e) => setProfileForm({ ...profileForm, legalName: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  GSTIN
                </label>
                <input
                  type="text"
                  maxLength={15}
                  disabled={!isOwnerOrAdmin}
                  value={profileForm.gstin}
                  onChange={(e) => setProfileForm({ ...profileForm, gstin: e.target.value.toUpperCase() })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  PAN
                </label>
                <input
                  type="text"
                  maxLength={10}
                  disabled={!isOwnerOrAdmin}
                  value={profileForm.pan}
                  onChange={(e) => setProfileForm({ ...profileForm, pan: e.target.value.toUpperCase() })}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Business Phone
                </label>
                <input
                  type="tel"
                  disabled={!isOwnerOrAdmin}
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Official Email
                </label>
                <input
                  type="email"
                  disabled={!isOwnerOrAdmin}
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Registered Address
              </label>
              <textarea
                rows={2}
                disabled={!isOwnerOrAdmin}
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                className={`${inputCls} resize-none`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Base Currency
                </label>
                <select
                  disabled={!isOwnerOrAdmin}
                  value={profileForm.currency}
                  onChange={(e) => setProfileForm({ ...profileForm, currency: e.target.value })}
                  className={inputCls}
                >
                  <option value="INR">INR (₹) &mdash; Indian Rupee</option>
                  <option value="USD">USD ($) &mdash; US Dollar</option>
                  <option value="EUR">EUR (€) &mdash; Euro</option>
                  <option value="GBP">GBP (£) &mdash; British Pound</option>
                  <option value="AED">AED (د.إ) &mdash; UAE Dirham</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Timezone
                </label>
                <select
                  disabled={!isOwnerOrAdmin}
                  value={profileForm.timezone}
                  onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })}
                  className={inputCls}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                  <option value="UTC">UTC (GMT +00:00)</option>
                  <option value="America/New_York">America/New_York (EST -05:00)</option>
                </select>
              </div>
            </div>

            {profileStatus === "success" && (
              <p className="text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-center">
                Business profile updated successfully!
              </p>
            )}
            {profileStatus === "error" && (
              <p className="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                {profileError}
              </p>
            )}

            {isOwnerOrAdmin && (
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={profileStatus === "saving"}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {profileStatus === "saving" ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: TEAM MEMBERS */}
      {activeTab === "team" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-100">Team & Role Access</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Users with access to this business workspace and their permissions
              </p>
            </div>

            {isOwnerOrAdmin && (
              <button
                onClick={() => setIsAddMemberOpen(true)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span>+</span> Add Team Member
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
                  {isOwnerOrAdmin && (
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
                    {isOwnerOrAdmin && (
                      <td className="py-3.5 px-4 text-right">
                        {m.role !== "OWNER" && (
                          <button
                            onClick={() => handleRemoveMember(m.id, m.user.email)}
                            className="text-[11px] text-rose-400 hover:text-rose-300 underline"
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

          {/* Add Member Modal */}
          {isAddMemberOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
              <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-100">Add Team Member</h2>
                  <button
                    onClick={() => setIsAddMemberOpen(false)}
                    className="text-slate-400 hover:text-slate-200 text-lg leading-none"
                  >
                    &times;
                  </button>
                </div>

                <form onSubmit={handleAddMember} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Registered Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={addMemberForm.email}
                      onChange={(e) => setAddMemberForm({ ...addMemberForm, email: e.target.value })}
                      placeholder="accountant@company.com"
                      className={inputCls}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      The user must already have an account on BusinessOS.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Workspace Role *
                    </label>
                    <select
                      value={addMemberForm.role}
                      onChange={(e) =>
                        setAddMemberForm({
                          ...addMemberForm,
                          role: e.target.value as typeof addMemberForm.role,
                        })
                      }
                      className={inputCls}
                    >
                      <option value="ACCOUNTANT">ACCOUNTANT &mdash; Can manage ledger & parties</option>
                      <option value="ADMIN">ADMIN &mdash; Can manage ledger, parties & settings</option>
                      <option value="OWNER">OWNER &mdash; Full administrative ownership</option>
                    </select>
                  </div>

                  {memberError && (
                    <p className="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                      {memberError}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddMemberOpen(false)}
                      className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={memberSubmitting}
                      className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
                    >
                      {memberSubmitting ? "Adding..." : "Add to Workspace"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-100">Audit Log & Event History</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Immutable record of actions and configuration changes
              </p>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search audit actions or users..."
                className={inputCls}
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

const inputCls =
  "w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-50";
