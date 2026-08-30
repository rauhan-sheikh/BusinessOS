"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
];

const CURRENCIES = [
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
];

export default function OnboardingPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    legalName: "",
    phone: "",
    email: "",
    address: "",
    gstin: "",
    pan: "",
    currency: "INR",
    timezone: "Asia/Kolkata",
  });

  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("loading");

    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        const message = Array.isArray(data.error)
          ? data.error[0]?.message ?? "Validation error"
          : data.error ?? "Failed to create business";
        throw new Error(message);
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setStatus("idle");
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-slate-100">Set up your business</h1>
        <p className="text-sm text-slate-400">
          Tell us about your business to get started. You can update these details later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Business Name */}
        <Field label="Business name *" htmlFor="name">
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={set("name")}
            placeholder="Acme Traders"
            required
            className={inputCls}
          />
        </Field>

        {/* Legal Name */}
        <Field label="Legal / registered name" htmlFor="legalName">
          <input
            id="legalName"
            type="text"
            value={form.legalName}
            onChange={set("legalName")}
            placeholder="Acme Traders Private Limited"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Phone */}
          <Field label="Phone" htmlFor="phone">
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              placeholder="+91 98765 43210"
              className={inputCls}
            />
          </Field>

          {/* Email */}
          <Field label="Business email" htmlFor="email">
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="hello@acme.com"
              className={inputCls}
            />
          </Field>
        </div>

        {/* Address */}
        <Field label="Address" htmlFor="address">
          <textarea
            id="address"
            value={form.address}
            onChange={set("address")}
            placeholder="123 Business Park, Mumbai, MH 400001"
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* GSTIN */}
          <Field label="GSTIN" htmlFor="gstin">
            <input
              id="gstin"
              type="text"
              value={form.gstin}
              onChange={set("gstin")}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              className={inputCls}
            />
          </Field>

          {/* PAN */}
          <Field label="PAN" htmlFor="pan">
            <input
              id="pan"
              type="text"
              value={form.pan}
              onChange={set("pan")}
              placeholder="AAAAA0000A"
              maxLength={10}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Currency */}
          <Field label="Currency" htmlFor="currency">
            <select
              id="currency"
              value={form.currency}
              onChange={set("currency")}
              className={selectCls}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </Field>

          {/* Timezone */}
          <Field label="Timezone" htmlFor="timezone">
            <select
              id="timezone"
              value={form.timezone}
              onChange={set("timezone")}
              className={selectCls}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </Field>
        </div>

        {error && (
          <p className="text-xs text-rose-400 font-medium text-center bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-xl">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center"
        >
          {status === "loading" ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            "Create business →"
          )}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition";

const selectCls =
  "w-full rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition";
