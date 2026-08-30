"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, toMajorUnits } from "@/shared/utils/currency";

export interface PartyWithBalance {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  notes: string | null;
  isArchived: boolean;
  createdAt: string;
  balance: {
    receivableMinor: string | number | bigint;
    payableMinor: string | number | bigint;
  } | null;
}

interface PartiesClientProps {
  initialParties: PartyWithBalance[];
  currency: string;
  initialOpenModal?: boolean;
}

export default function PartiesClient({
  initialParties,
  currency,
  initialOpenModal = false,
}: PartiesClientProps) {
  const [parties, setParties] = useState<PartyWithBalance[]>(initialParties);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "receivable" | "payable">("all");
  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal);

  // New Party Form State
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    gstin: "",
    pan: "",
    notes: "",
    openingBalance: "",
    openingBalanceType: "RECEIVABLE" as "RECEIVABLE" | "PAYABLE",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Calculate totals
  const totalReceivables = parties.reduce(
    (acc, p) => acc + (p.balance ? toMajorUnits(p.balance.receivableMinor) : 0),
    0
  );
  const totalPayables = parties.reduce(
    (acc, p) => acc + (p.balance ? toMajorUnits(p.balance.payableMinor) : 0),
    0
  );

  // Filter parties based on search and tab
  const filteredParties = parties.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone && p.phone.includes(search)) ||
      (p.email && p.email.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    const rec = p.balance ? Number(p.balance.receivableMinor) : 0;
    const pay = p.balance ? Number(p.balance.payableMinor) : 0;

    if (filter === "receivable") return rec > 0;
    if (filter === "payable") return pay > 0;
    return true;
  });

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        gstin: form.gstin || undefined,
        pan: form.pan || undefined,
        notes: form.notes || undefined,
      };

      if (form.openingBalance && Number(form.openingBalance) > 0) {
        payload.openingBalanceMinor = Number(form.openingBalance);
        payload.openingBalanceType = form.openingBalanceType;
      }

      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          Array.isArray(data.error) ? data.error[0]?.message : data.error || "Failed to create party"
        );
      }

      setParties([data.party, ...parties]);
      setIsModalOpen(false);
      setForm({
        name: "",
        phone: "",
        email: "",
        address: "",
        gstin: "",
        pan: "",
        notes: "",
        openingBalance: "",
        openingBalanceType: "RECEIVABLE",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Parties</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your customers, vendors, and counterparties
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <span>+</span> Add Party
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Total Parties
          </p>
          <p className="text-xl font-bold text-slate-200 mt-1">{parties.length}</p>
        </div>
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4">
          <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
            You will get (Receivable)
          </p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(totalReceivables)}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4">
          <p className="text-xs font-medium text-amber-400 uppercase tracking-wider">
            You will give (Payable)
          </p>
          <p className="text-xl font-bold text-amber-400 mt-1">
            {new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(totalPayables)}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search party by name, phone, or email..."
            className="w-full rounded-xl bg-slate-900 border border-slate-800 px-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
          {[
            { id: "all", label: "All Parties" },
            { id: "receivable", label: "To Collect" },
            { id: "payable", label: "To Pay" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as "all" | "receivable" | "payable")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Parties List Table */}
      {filteredParties.length === 0 ? (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-12 text-center space-y-3">
          <p className="text-sm text-slate-400 font-medium">No parties found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search || filter !== "all"
              ? "Try adjusting your search query or filter."
              : "Get started by adding your first customer or vendor."}
          </p>
          {!search && filter === "all" && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all mt-2"
            >
              + Add First Party
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden divide-y divide-slate-800/60">
          {filteredParties.map((party) => {
            const rec = party.balance ? Number(party.balance.receivableMinor) : 0;
            const pay = party.balance ? Number(party.balance.payableMinor) : 0;
            const hasRec = rec > 0;
            const hasPay = pay > 0;

            return (
              <Link
                key={party.id}
                href={`/parties/${party.id}`}
                className="block p-4 sm:px-6 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-semibold text-slate-100 hover:text-indigo-400 transition-colors">
                        {party.name}
                      </span>
                      {party.gstin && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          GST: {party.gstin}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {party.phone && <span>📞 {party.phone}</span>}
                      {party.email && <span>✉️ {party.email}</span>}
                      {party.address && <span className="truncate max-w-xs">📍 {party.address}</span>}
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    {hasRec ? (
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">You will get</span>
                        <span className="text-sm font-bold text-emerald-400">
                          {formatCurrency(party.balance!.receivableMinor, currency)}
                        </span>
                      </div>
                    ) : hasPay ? (
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">You will give</span>
                        <span className="text-sm font-bold text-amber-400">
                          {formatCurrency(party.balance!.payableMinor, currency)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                        Settled (₹0)
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Add Party Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100">Add New Party</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateParty} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Party Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Ramesh Traders or John Doe"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="contact@party.com"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Billing Address
                </label>
                <textarea
                  rows={2}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Street, City, State, PIN"
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                    placeholder="22AAAAA0000A1Z5"
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
                    value={form.pan}
                    onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                    placeholder="AAAAA0000A"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Opening Balance */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                <p className="text-xs font-semibold text-slate-300">
                  Opening Balance (Optional)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Amount ({currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.openingBalance}
                      onChange={(e) => setForm({ ...form, openingBalance: e.target.value })}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Balance Type
                    </label>
                    <select
                      value={form.openingBalanceType}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          openingBalanceType: e.target.value as "RECEIVABLE" | "PAYABLE",
                        })
                      }
                      className={inputCls}
                    >
                      <option value="RECEIVABLE">To Collect (Receivable / Customer)</option>
                      <option value="PAYABLE">To Pay (Payable / Vendor)</option>
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Create Party"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition";
