"use client";

import { useState } from "react";
import { useToast, useConfirm } from "@/shared/components/ui";

export interface EmailTemplateVariableView {
  name: string;
  description: string;
}

export interface EmailTemplateView {
  key: string;
  name: string;
  description: string;
  variables: EmailTemplateVariableView[];
  subject: string;
  html: string;
  defaultSubject: string;
  defaultHtml: string;
  isCustomised: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

const inputCls =
  "w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all disabled:opacity-50";

export default function EmailTemplatesPanel({
  initialTemplates,
  canManage,
}: {
  initialTemplates: EmailTemplateView[];
  canManage: boolean;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [activeKey, setActiveKey] = useState(initialTemplates[0]?.key ?? "");
  const [drafts, setDrafts] = useState<Record<string, { subject: string; html: string }>>(() =>
    Object.fromEntries(initialTemplates.map((t) => [t.key, { subject: t.subject, html: t.html }]))
  );
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();

  const active = templates.find((t) => t.key === activeKey);
  const draft = drafts[activeKey];

  if (!active || !draft) {
    return (
      <p className="text-xs text-slate-500">
        No customisable emails are available for this workspace.
      </p>
    );
  }

  const isDirty = draft.subject !== active.subject || draft.html !== active.html;

  const updateDraft = (patch: Partial<{ subject: string; html: string }>) => {
    setDrafts((prev) => ({ ...prev, [activeKey]: { ...prev[activeKey], ...patch } }));
    setStatus("idle");
  };

  const handleSave = async () => {
    setStatus("saving");
    setError("");
    try {
      const res = await fetch(`/api/businesses/email-templates/${activeKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not save this email."
        );
      }

      setTemplates((prev) =>
        prev.map((t) =>
          t.key === activeKey
            ? { ...t, subject: draft.subject, html: draft.html, isCustomised: true }
            : t
        )
      );
      setStatus("idle");
      toast.success(`"${active.name}" email saved.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save this email.");
      setStatus("error");
    }
  };

  const handleReset = async () => {
    const confirmed = await confirm({
      title: "Restore the default wording?",
      confirmLabel: "Restore default",
      message: (
        <>
          Your customised <span className="font-semibold text-fg">{active.name}</span>{" "}
          email is discarded and the built-in wording applies again.
        </>
      ),
    });
    if (!confirmed) return;

    setStatus("saving");
    setError("");
    try {
      const res = await fetch(`/api/businesses/email-templates/${activeKey}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not restore the default."
        );
      }

      setTemplates((prev) =>
        prev.map((t) =>
          t.key === activeKey
            ? { ...t, subject: t.defaultSubject, html: t.defaultHtml, isCustomised: false }
            : t
        )
      );
      setDrafts((prev) => ({
        ...prev,
        [activeKey]: { subject: active.defaultSubject, html: active.defaultHtml },
      }));
      setStatus("idle");
      toast.success("Default wording restored.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not restore the default.");
      setStatus("error");
    }
  };

  const handlePreview = async () => {
    setError("");
    try {
      const res = await fetch(`/api/businesses/email-templates/${activeKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not render a preview."
        );
      }
      setPreview(data.preview);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not render a preview.");
    }
  };

  return (
    <div className="space-y-5">
      {confirmDialog}

      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100">Email Templates</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Customise the wording of emails this workspace sends. Sign-in and password emails
              are sent by BusinessOS itself and are not editable here.
            </p>
          </div>
          {active.isCustomised && (
            <span className="text-[11px] font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg whitespace-nowrap self-start">
              Customised
            </span>
          )}
        </div>

        {templates.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template.key}
                onClick={() => {
                  setActiveKey(template.key);
                  setPreview(null);
                  setStatus("idle");
                }}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all border ${
                  template.key === activeKey
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {template.name}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-500">{active.description}</p>

        <div>
          <label
            htmlFor="email-template-subject"
            className="block text-[11px] font-medium text-slate-400 mb-1"
          >
            Subject
          </label>
          <input
            id="email-template-subject"
            type="text"
            value={draft.subject}
            disabled={!canManage}
            onChange={(e) => updateDraft({ subject: e.target.value })}
            className={inputCls}
          />
        </div>

        <div>
          <label
            htmlFor="email-template-html"
            className="block text-[11px] font-medium text-slate-400 mb-1"
          >
            Email body (HTML)
          </label>
          <textarea
            id="email-template-html"
            rows={14}
            value={draft.html}
            disabled={!canManage}
            onChange={(e) => updateDraft({ html: e.target.value })}
            className={`${inputCls} font-mono leading-relaxed`}
            spellCheck={false}
          />
        </div>

        <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3.5">
          <p className="text-[11px] font-semibold text-slate-400 mb-2">
            Available placeholders
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {active.variables.map((variable) => (
              <div key={variable.name} className="text-[11px]">
                <code className="text-indigo-300">{`{{${variable.name}}}`}</code>
                <span className="text-slate-500"> &mdash; {variable.description}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-600 mt-2.5">
            Values are escaped automatically, so a name containing HTML cannot alter the message.
          </p>
        </div>

        {error && (
          <p className="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
            {error}
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button
            onClick={handlePreview}
            className="w-full sm:w-auto rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-all"
          >
            Preview
          </button>
          {canManage && active.isCustomised && (
            <button
              onClick={handleReset}
              className="w-full sm:w-auto rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all"
            >
              Restore default
            </button>
          )}
          {canManage && (
            <button
              onClick={handleSave}
              disabled={!isDirty || status === "saving"}
              className="w-full sm:w-auto rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
            >
              {status === "saving" ? "Saving..." : "Save changes"}
            </button>
          )}
        </div>
      </div>

      {preview && (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-200">Preview</h3>
            <button
              onClick={() => setPreview(null)}
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-slate-400">
            <span className="text-slate-500">Subject: </span>
            {preview.subject}
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-white">
            {/* Sandboxed: the preview renders workspace-authored HTML, so it is
                kept from running scripts or reaching the parent page. */}
            <iframe
              title="Email preview"
              srcDoc={preview.html}
              sandbox=""
              className="w-full h-[480px] border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
