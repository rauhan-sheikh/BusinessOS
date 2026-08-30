"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, toMajorUnits } from "@/shared/utils/currency";
import { exportToCSV } from "@/shared/utils/export-csv";

export interface TransactionItem {
  id: string;
  transactionType: string;
  amountMinor: string | number | bigint;
  OpeningBalanceType: string | null;
  notes: string | null;
  referenceNumber: string | null;
  reversedTransactionId: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
}

export interface PartyDetailData {
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
  transactions: TransactionItem[];
}

interface PartyDetailClientProps {
  initialParty: PartyDetailData;
  currency: string;
}

export default function PartyDetailClient({
  initialParty,
  currency,
}: PartyDetailClientProps) {
  const [party, setParty] = useState<PartyDetailData>(initialParty);
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Transaction form state
  const [txType, setTxType] = useState<
    "SALE" | "PURCHASE" | "PAYMENT_RECEIEVED" | "PAYMENT_MADE" | "ADJUSTMENT"
  >("PAYMENT_RECEIEVED");
  const [txAmount, setTxAmount] = useState("");
  const [txNotes, setTxNotes] = useState("");
  const [txRef, setTxRef] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"RECEIVABLE" | "PAYABLE">("RECEIVABLE");
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txError, setTxError] = useState("");

  // Edit party form state
  const [editForm, setEditForm] = useState({
    name: party.name,
    phone: party.phone || "",
    email: party.email || "",
    address: party.address || "",
    gstin: party.gstin || "",
    pan: party.pan || "",
    notes: party.notes || "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  const receivable = party.balance ? Number(party.balance.receivableMinor) : 0;
  const payable = party.balance ? Number(party.balance.payableMinor) : 0;

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError("");
    setTxSubmitting(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: party.id,
          transactionType: txType,
          amount: parseFloat(txAmount),
          notes: txNotes || undefined,
          referenceNumber: txRef || undefined,
          adjustmentType: txType === "ADJUSTMENT" ? adjustmentType : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          Array.isArray(data.error) ? data.error[0]?.message : data.error || "Failed to record transaction"
        );
      }

      // Refresh party details
      const refreshRes = await fetch(`/api/parties/${party.id}`);
      const refreshData = await refreshRes.json();
      if (refreshRes.ok && refreshData.party) {
        setParty(refreshData.party);
      }

      setIsTxModalOpen(false);
      setTxAmount("");
      setTxNotes("");
      setTxRef("");
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setTxSubmitting(false);
    }
  };

  const handleEditParty = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    setEditSubmitting(true);

    try {
      const res = await fetch(`/api/parties/${party.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          Array.isArray(data.error) ? data.error[0]?.message : data.error || "Failed to update party"
        );
      }

      setParty({ ...party, ...data.party });
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleReverse = async (txId: string) => {
    if (!confirm("Are you sure you want to reverse this transaction?")) return;

    try {
      const res = await fetch(`/api/transactions/${txId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "User requested reversal" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reverse transaction");
      }

      // Refresh party
      const refreshRes = await fetch(`/api/parties/${party.id}`);
      const refreshData = await refreshRes.json();
      if (refreshRes.ok && refreshData.party) {
        setParty(refreshData.party);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to reverse transaction");
    }
  };

  const handleExportStatement = () => {
    const receivable = party.balance ? toMajorUnits(party.balance.receivableMinor) : 0;
    const payable = party.balance ? toMajorUnits(party.balance.payableMinor) : 0;
    const netBalance = receivable - payable;

    const rows = party.transactions.map((tx) => {
      const isDebit =
        tx.transactionType === "SALE" ||
        tx.transactionType === "PAYMENT_MADE" ||
        (tx.transactionType === "OPENING_BALANCE" && tx.OpeningBalanceType === "RECEIVABLE");

      return {
        statementParty: party.name,
        partyGstin: party.gstin || "",
        partyPan: party.pan || "",
        partyPhone: party.phone || "",
        currentBalance: `${netBalance >= 0 ? "+" : "-"}${formatCurrency(Math.abs(netBalance * 100), currency)} (${netBalance >= 0 ? "To Collect" : "To Pay"})`,
        transactionId: tx.id,
        date: new Date(tx.createdAt).toISOString().split("T")[0],
        time: new Date(tx.createdAt).toLocaleTimeString("en-IN", { hour12: false }),
        type: tx.transactionType,
        flow: isDebit ? "DEBIT (To Collect)" : "CREDIT (To Pay / Received)",
        currency,
        amount: toMajorUnits(tx.amountMinor).toFixed(2),
        referenceNumber: tx.referenceNumber || "",
        notes: tx.notes || "",
        reversalStatus: tx.reversedTransactionId
          ? `Reversal of #${tx.reversedTransactionId.slice(0, 8)}`
          : "Original",
        recordedBy: tx.createdBy?.name || "",
      };
    });

    exportToCSV(`BusinessOS_Statement_${party.name.replace(/[^a-zA-Z0-9]/g, "_")}`, rows, [
      { key: "statementParty", label: "Party Name" },
      { key: "partyGstin", label: "GSTIN" },
      { key: "partyPan", label: "PAN" },
      { key: "partyPhone", label: "Phone" },
      { key: "currentBalance", label: "Current Balance" },
      { key: "transactionId", label: "Transaction ID" },
      { key: "date", label: "Date (YYYY-MM-DD)" },
      { key: "time", label: "Time" },
      { key: "type", label: "Transaction Type" },
      { key: "flow", label: "Accounting Flow" },
      { key: "currency", label: "Currency" },
      { key: "amount", label: `Amount (${currency})` },
      { key: "referenceNumber", label: "Reference / Invoice #" },
      { key: "notes", label: "Notes / Memo" },
      { key: "reversalStatus", label: "Reversal Status" },
      { key: "recordedBy", label: "Recorded By" },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/parties" className="hover:text-slate-200 transition-colors">
          &larr; Back to Parties
        </Link>
      </div>

      {/* Header Profile & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-100">{party.name}</h1>
            {party.gstin && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                GSTIN: {party.gstin}
              </span>
            )}
            {party.pan && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                PAN: {party.pan}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Party ID: {party.id} • Added on {new Date(party.createdAt).toLocaleDateString("en-IN")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportStatement}
            className="rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all flex items-center gap-1.5"
          >
            <span>📥</span> Export Statement
          </button>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-all"
          >
            Edit Profile
          </button>
          <button
            onClick={() => setIsTxModalOpen(true)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all flex items-center gap-1.5"
          >
            <span>+</span> Record Transaction
          </button>
        </div>
      </div>

      {/* Balance Banner & Contact Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Balance Card */}
        <div className="md:col-span-1 rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 flex flex-col justify-between space-y-3">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Current Balance
            </p>
            {receivable > 0 ? (
              <div className="mt-2">
                <span className="text-xs font-medium text-emerald-400 block mb-0.5">
                  You will get (Receivable)
                </span>
                <p className="text-3xl font-extrabold text-emerald-400">
                  {formatCurrency(receivable, currency)}
                </p>
              </div>
            ) : payable > 0 ? (
              <div className="mt-2">
                <span className="text-xs font-medium text-amber-400 block mb-0.5">
                  You will give (Payable)
                </span>
                <p className="text-3xl font-extrabold text-amber-400">
                  {formatCurrency(payable, currency)}
                </p>
              </div>
            ) : (
              <div className="mt-2">
                <span className="text-xs font-medium text-slate-400 block mb-0.5">Settled</span>
                <p className="text-3xl font-extrabold text-slate-300">
                  {formatCurrency(0, currency)}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-800/60">
            <button
              onClick={() => {
                setTxType("PAYMENT_RECEIEVED");
                setIsTxModalOpen(true);
              }}
              className="flex-1 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 transition-all text-center"
            >
              + Payment In
            </button>
            <button
              onClick={() => {
                setTxType("PAYMENT_MADE");
                setIsTxModalOpen(true);
              }}
              className="flex-1 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold hover:bg-amber-500/20 transition-all text-center"
            >
              - Payment Out
            </button>
          </div>
        </div>

        {/* Contact Info Card */}
        <div className="md:col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Contact & Address Details
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block mb-0.5">Phone Number</span>
              <p className="text-slate-300 font-medium">{party.phone || "Not provided"}</p>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Email Address</span>
              <p className="text-slate-300 font-medium">{party.email || "Not provided"}</p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-500 block mb-0.5">Billing Address</span>
              <p className="text-slate-300 font-medium">{party.address || "Not provided"}</p>
            </div>
            {party.notes && (
              <div className="sm:col-span-2">
                <span className="text-slate-500 block mb-0.5">Internal Notes</span>
                <p className="text-slate-400 italic">{party.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Statement / Ledger Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Party Statement & Ledger History
          </h2>
          <span className="text-xs text-slate-500">
            {party.transactions.length} transaction{party.transactions.length === 1 ? "" : "s"}
          </span>
        </div>

        {party.transactions.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <p className="text-sm text-slate-400 font-medium">No transactions on this ledger</p>
            <p className="text-xs text-slate-500">Record a sale, purchase, or payment to see entries here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider">Date</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider">Type</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider">Reference / Notes</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider text-right">Debit / Out</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider text-right">Credit / In</th>
                  <th className="py-3 px-3 font-semibold uppercase tracking-wider text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {party.transactions.map((tx) => {
                  const isPaymentIn = tx.transactionType === "PAYMENT_RECEIEVED";
                  const isSale = tx.transactionType === "SALE";
                  const isPurchase = tx.transactionType === "PURCHASE";
                  const isPaymentOut = tx.transactionType === "PAYMENT_MADE";
                  const isOpening = tx.transactionType === "OPENING_BALANCE";
                  const isReversal = tx.transactionType === "REVERSAL";

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isSale
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : isPurchase
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : isPaymentIn
                              ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                              : isPaymentOut
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : isReversal
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 line-through opacity-75"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {isPaymentIn ? "PAYMENT IN" : isPaymentOut ? "PAYMENT OUT" : tx.transactionType.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="font-medium text-slate-200">{tx.referenceNumber || "—"}</p>
                        {tx.notes && <p className="text-[11px] text-slate-500">{tx.notes}</p>}
                        <span className="text-[10px] text-slate-600">by {tx.createdBy.name}</span>
                      </td>
                      {/* Debit (e.g. Sales / Money they owe) */}
                      <td className="py-3.5 px-3 text-right font-medium text-amber-400 whitespace-nowrap">
                        {isPurchase || isPaymentIn ? formatCurrency(tx.amountMinor, currency) : "—"}
                      </td>
                      {/* Credit (e.g. Payments received) */}
                      <td className="py-3.5 px-3 text-right font-medium text-emerald-400 whitespace-nowrap">
                        {isSale || isPaymentOut || (isOpening && tx.OpeningBalanceType === "RECEIVABLE")
                          ? formatCurrency(tx.amountMinor, currency)
                          : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {!isReversal && (
                          <button
                            onClick={() => handleReverse(tx.id)}
                            className="text-[11px] text-rose-400 hover:text-rose-300 underline"
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Transaction Modal */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100">
                Record Transaction &mdash; {party.name}
              </h2>
              <button
                onClick={() => setIsTxModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRecordTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Transaction Type *
                </label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as typeof txType)}
                  className={inputCls}
                >
                  <option value="PAYMENT_RECEIEVED">💰 Payment Received (In)</option>
                  <option value="SALE">📦 Sale / Invoice (Receivable)</option>
                  <option value="PAYMENT_MADE">💸 Payment Made (Out)</option>
                  <option value="PURCHASE">🛒 Purchase / Bill (Payable)</option>
                  <option value="ADJUSTMENT">⚖️ Balance Adjustment</option>
                </select>
              </div>

              {txType === "ADJUSTMENT" && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Adjustment Direction
                  </label>
                  <select
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value as "RECEIVABLE" | "PAYABLE")}
                    className={inputCls}
                  >
                    <option value="RECEIVABLE">Increase Customer Receivable (To Collect)</option>
                    <option value="PAYABLE">Increase Vendor Payable (To Pay)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Amount ({currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Reference / Invoice # (Optional)
                </label>
                <input
                  type="text"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  placeholder="e.g. INV-1002 or UPI-9872"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Notes / Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="Additional notes about this transaction..."
                  className={`${inputCls} resize-none`}
                />
              </div>

              {txError && (
                <p className="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                  {txError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={txSubmitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {txSubmitting ? "Recording..." : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Party Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100">Edit Party Profile</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleEditParty} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Party Name *
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
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
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
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
                    value={editForm.gstin}
                    onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
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
                    value={editForm.pan}
                    onChange={(e) => setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {editError && (
                <p className="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                  {editError}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {editSubmitting ? "Saving..." : "Save Changes"}
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
