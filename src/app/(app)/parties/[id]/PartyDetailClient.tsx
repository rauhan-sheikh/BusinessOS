"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, toMajorUnits } from "@/shared/utils/currency";
import { exportToCSV } from "@/shared/utils/export-csv";
import {
  useToast,
  useConfirm,
  Modal,
  Button,
  InputField,
  SelectField,
  TextareaField,
} from "@/shared/components/ui";

export interface TransactionItem {
  id: string;
  transactionType: string;
  amountMinor: string | number | bigint;
  direction: string | null;
  notes: string | null;
  referenceNumber: string | null;
  reversedTransactionId: string | null;
  /** Business date of the entry; may be back-dated. */
  transactionDate: string;
  /** When the row was written. Never moves. */
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
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Transaction form state
  const [txType, setTxType] = useState<
    "SALE" | "PURCHASE" | "PAYMENT_RECEIVED" | "PAYMENT_MADE" | "ADJUSTMENT"
  >("PAYMENT_RECEIVED");
  const [txAmount, setTxAmount] = useState("");
  const [txNotes, setTxNotes] = useState("");
  const [txRef, setTxRef] = useState("");
  const [direction, setDirection] = useState<"RECEIVABLE" | "PAYABLE">("RECEIVABLE");
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
          direction: txType === "ADJUSTMENT" ? direction : undefined,
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

  const handleReverse = async (tx: TransactionItem) => {
    const confirmed = await confirm({
      title: "Reverse this transaction?",
      isDestructive: true,
      confirmLabel: "Reverse transaction",
      message: (
        <>
          <p>
            This posts an opposing entry for{" "}
            <span className="font-semibold text-fg">
              {formatCurrency(tx.amountMinor, currency)}
            </span>{" "}
            and updates this party&apos;s balance.
          </p>
          <p className="mt-2 text-fg-subtle">
            The original entry is kept. A transaction can only be reversed once.
          </p>
        </>
      ),
    });
    if (!confirmed) return;

    const txId = tx.id;

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
      toast.error(err instanceof Error ? err.message : "Failed to reverse transaction");
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
        (tx.transactionType === "OPENING_BALANCE" && tx.direction === "RECEIVABLE");

      return {
        statementParty: party.name,
        partyGstin: party.gstin || "",
        partyPan: party.pan || "",
        partyPhone: party.phone || "",
        currentBalance: `${netBalance >= 0 ? "+" : "-"}${formatCurrency(Math.abs(netBalance * 100), currency)} (${netBalance >= 0 ? "To Collect" : "To Pay"})`,
        transactionId: tx.id,
        date: new Date(tx.transactionDate).toISOString().split("T")[0],
        recordedAt: new Date(tx.createdAt).toISOString(),
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

    const exported = exportToCSV(`BusinessOS_Statement_${party.name.replace(/[^a-zA-Z0-9]/g, "_")}`, rows, [
      { key: "statementParty", label: "Party Name" },
      { key: "partyGstin", label: "GSTIN" },
      { key: "partyPan", label: "PAN" },
      { key: "partyPhone", label: "Phone" },
      { key: "currentBalance", label: "Current Balance" },
      { key: "transactionId", label: "Transaction ID" },
      { key: "date", label: "Date (YYYY-MM-DD)" },
      { key: "recordedAt", label: "Recorded At (UTC)" },
      { key: "type", label: "Transaction Type" },
      { key: "flow", label: "Accounting Flow" },
      { key: "currency", label: "Currency" },
      { key: "amount", label: `Amount (${currency})` },
      { key: "referenceNumber", label: "Reference / Invoice #" },
      { key: "notes", label: "Notes / Memo" },
      { key: "reversalStatus", label: "Reversal Status" },
      { key: "recordedBy", label: "Recorded By" },
    ]);

    if (!exported) {
      toast.info("There are no statement entries to export.");
    } else {
      toast.success("Statement exported.");
    }
  };

  return (
    <div className="space-y-6">
      {confirmDialog}

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
                setTxType("PAYMENT_RECEIVED");
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
                  const isPaymentIn = tx.transactionType === "PAYMENT_RECEIVED";
                  const isSale = tx.transactionType === "SALE";
                  const isPurchase = tx.transactionType === "PURCHASE";
                  const isPaymentOut = tx.transactionType === "PAYMENT_MADE";
                  const isOpening = tx.transactionType === "OPENING_BALANCE";
                  const isReversal = tx.transactionType === "REVERSAL";

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(tx.transactionDate).toLocaleDateString("en-IN", {
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
                        {isSale || isPaymentOut || (isOpening && tx.direction === "RECEIVABLE")
                          ? formatCurrency(tx.amountMinor, currency)
                          : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {!isReversal && (
                          <button
                            onClick={() => handleReverse(tx)}
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
        <Modal
          isOpen={isTxModalOpen}
          onClose={() => setIsTxModalOpen(false)}
          title="Record a transaction"
          description={"Posts a ledger entry against " + party.name + "."}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsTxModalOpen(false)} fullWidth>
                Cancel
              </Button>
              <Button
                type="submit"
                form="record-party-transaction-form"
                isLoading={txSubmitting}
                loadingLabel="Recording..."
                fullWidth
              >
                Save transaction
              </Button>
            </>
          }
        >
          <form
            id="record-party-transaction-form"
            onSubmit={handleRecordTransaction}
            className="space-y-4"
          >
            <SelectField
              label="Transaction type"
              required
              value={txType}
              onChange={(e) => setTxType(e.target.value as typeof txType)}
            >
              <option value="PAYMENT_RECEIVED">Payment received (in)</option>
              <option value="SALE">Sale / invoice (receivable)</option>
              <option value="PAYMENT_MADE">Payment made (out)</option>
              <option value="PURCHASE">Purchase / bill (payable)</option>
              <option value="ADJUSTMENT">Balance adjustment</option>
            </SelectField>

            {txType === "ADJUSTMENT" && (
              <SelectField
                label="Adjustment direction"
                hint="Which side of the balance this entry moves."
                value={direction}
                onChange={(e) => setDirection(e.target.value as "RECEIVABLE" | "PAYABLE")}
              >
                <option value="RECEIVABLE">Increase customer receivable (to collect)</option>
                <option value="PAYABLE">Increase vendor payable (to pay)</option>
              </SelectField>
            )}

            <InputField
              label={"Amount (" + currency + ")"}
              type="number"
              step="0.01"
              min="0.01"
              required
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              placeholder="0.00"
              hint="Positive, with up to two decimal places."
            />

            <InputField
              label="Reference / invoice number"
              value={txRef}
              onChange={(e) => setTxRef(e.target.value)}
              placeholder="e.g. INV-1002 or UPI-9872"
            />

            <TextareaField
              label="Notes / description"
              rows={2}
              value={txNotes}
              onChange={(e) => setTxNotes(e.target.value)}
              placeholder="Additional notes about this transaction..."
              className="resize-none"
            />

            {txError && (
              <p
                role="alert"
                className="text-xs text-danger font-medium bg-danger/10 border border-danger/20 p-2.5 rounded-xl text-center"
              >
                {txError}
              </p>
            )}
          </form>
        </Modal>
      )}

      {/* Edit Party Profile Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit party profile"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)} fullWidth>
                Cancel
              </Button>
              <Button
                type="submit"
                form="edit-party-form"
                isLoading={editSubmitting}
                loadingLabel="Saving..."
                fullWidth
              >
                Save changes
              </Button>
            </>
          }
        >
          <form id="edit-party-form" onSubmit={handleEditParty} className="space-y-4">
            <InputField
              label="Party name"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Phone number"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
              <InputField
                label="Email address"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>

            <TextareaField
              label="Billing address"
              rows={2}
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              className="resize-none"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="GSTIN"
                maxLength={15}
                value={editForm.gstin}
                onChange={(e) =>
                  setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })
                }
              />
              <InputField
                label="PAN"
                maxLength={10}
                value={editForm.pan}
                onChange={(e) =>
                  setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })
                }
              />
            </div>

            <TextareaField
              label="Notes"
              rows={2}
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              className="resize-none"
            />

            {editError && (
              <p
                role="alert"
                className="text-xs text-danger font-medium bg-danger/10 border border-danger/20 p-2.5 rounded-xl text-center"
              >
                {editError}
              </p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
