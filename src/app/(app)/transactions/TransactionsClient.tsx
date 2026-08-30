"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatCurrency, toMajorUnits } from "@/shared/utils/currency";
import { exportToCSV } from "@/shared/utils/export-csv";

export interface LedgerTransaction {
  id: string;
  transactionType: string;
  amountMinor: string | number | bigint;
  OpeningBalanceType: string | null;
  notes: string | null;
  referenceNumber: string | null;
  reversedTransactionId: string | null;
  createdAt: string;
  party: {
    id: string;
    name: string;
    phone: string | null;
    gstin?: string | null;
    pan?: string | null;
  };
  createdBy: {
    id: string;
    name: string;
    email?: string;
  };
}

interface TransactionsClientProps {
  initialTransactions: LedgerTransaction[];
  initialTotalCount: number;
  parties: { id: string; name: string }[];
  currency: string;
  initialOpenModal?: boolean;
}

export default function TransactionsClient({
  initialTransactions,
  initialTotalCount,
  parties,
  currency,
  initialOpenModal = false,
}: TransactionsClientProps) {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>(initialTransactions);
  const [totalCount, setTotalCount] = useState<number>(initialTotalCount);

  // Filter States
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [partyFilter, setPartyFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination States
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(initialOpenModal);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    partyId: parties[0]?.id || "",
    transactionType: "SALE" as "SALE" | "PURCHASE" | "PAYMENT_RECEIEVED" | "PAYMENT_MADE" | "ADJUSTMENT",
    amount: "",
    referenceNumber: "",
    notes: "",
    adjustmentType: "RECEIVABLE" as "RECEIVABLE" | "PAYABLE",
  });

  // Fetch transactions with applied filters & pagination
  const fetchFilteredTransactions = async (
    targetPage: number = page,
    targetPageSize: number = pageSize,
    filters = { search, typeFilter, partyFilter, startDate, endDate }
  ) => {
    const params = new URLSearchParams();
    params.set("page", targetPage.toString());
    params.set("limit", targetPageSize.toString());
    if (filters.search) params.set("search", filters.search);
    if (filters.typeFilter !== "ALL") params.set("type", filters.typeFilter);
    if (filters.partyFilter !== "ALL") params.set("partyId", filters.partyFilter);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);

    const res = await fetch(`/api/transactions?${params.toString()}`);
    const data = await res.json();
    if (res.ok) {
      setTransactions(data.transactions);
      setTotalCount(data.totalCount);
      setPage(data.page);
    }
  };

  const handleFilterChange = (
    newFilters: Partial<{
      search: string;
      typeFilter: string;
      partyFilter: string;
      startDate: string;
      endDate: string;
    }>
  ) => {
    const updated = {
      search: newFilters.search !== undefined ? newFilters.search : search,
      typeFilter: newFilters.typeFilter !== undefined ? newFilters.typeFilter : typeFilter,
      partyFilter: newFilters.partyFilter !== undefined ? newFilters.partyFilter : partyFilter,
      startDate: newFilters.startDate !== undefined ? newFilters.startDate : startDate,
      endDate: newFilters.endDate !== undefined ? newFilters.endDate : endDate,
    };

    if (newFilters.search !== undefined) setSearch(newFilters.search);
    if (newFilters.typeFilter !== undefined) setTypeFilter(newFilters.typeFilter);
    if (newFilters.partyFilter !== undefined) setPartyFilter(newFilters.partyFilter);
    if (newFilters.startDate !== undefined) setStartDate(newFilters.startDate);
    if (newFilters.endDate !== undefined) setEndDate(newFilters.endDate);

    startTransition(() => {
      fetchFilteredTransactions(1, pageSize, updated);
    });
  };

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      fetchFilteredTransactions(newPage, pageSize);
    });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    startTransition(() => {
      fetchFilteredTransactions(1, newSize);
    });
  };

  const handleResetFilters = () => {
    setSearch("");
    setTypeFilter("ALL");
    setPartyFilter("ALL");
    setStartDate("");
    setEndDate("");
    startTransition(() => {
      fetchFilteredTransactions(1, pageSize, {
        search: "",
        typeFilter: "ALL",
        partyFilter: "ALL",
        startDate: "",
        endDate: "",
      });
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: form.partyId,
          transactionType: form.transactionType,
          amount: parseFloat(form.amount),
          referenceNumber: form.referenceNumber || undefined,
          notes: form.notes || undefined,
          adjustmentType:
            form.transactionType === "ADJUSTMENT" ? form.adjustmentType : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          Array.isArray(data.error)
            ? data.error[0]?.message
            : data.error || "Failed to record transaction"
        );
      }

      setIsModalOpen(false);
      setForm({
        partyId: parties[0]?.id || "",
        transactionType: "SALE",
        amount: "",
        referenceNumber: "",
        notes: "",
        adjustmentType: "RECEIVABLE",
      });

      // Refresh list
      fetchFilteredTransactions(1, pageSize);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = async (txId: string) => {
    if (!confirm("Are you sure you want to reverse this transaction?")) return;

    try {
      const res = await fetch(`/api/transactions/${txId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "User requested reversal from ledger" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reverse transaction");
      }

      fetchFilteredTransactions(page, pageSize);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to reverse transaction");
    }
  };

  // Enterprise CSV Export
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      // Fetch all records matching the current active filter (limit = 5000)
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "5000");
      if (search) params.set("search", search);
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (partyFilter !== "ALL") params.set("partyId", partyFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();

      const records: LedgerTransaction[] = data.transactions || transactions;

      const rows = records.map((tx) => {
        const isDebit =
          tx.transactionType === "SALE" ||
          tx.transactionType === "PAYMENT_MADE" ||
          (tx.transactionType === "OPENING_BALANCE" && tx.OpeningBalanceType === "RECEIVABLE");

        return {
          transactionId: tx.id,
          date: new Date(tx.createdAt).toISOString().split("T")[0],
          time: new Date(tx.createdAt).toLocaleTimeString("en-IN", { hour12: false }),
          counterparty: tx.party?.name || "N/A",
          phone: tx.party?.phone || "",
          gstin: tx.party?.gstin || "",
          pan: tx.party?.pan || "",
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
          recordedByEmail: tx.createdBy?.email || "",
        };
      });

      exportToCSV("BusinessOS_Enterprise_Ledger", rows, [
        { key: "transactionId", label: "Transaction ID" },
        { key: "date", label: "Date (YYYY-MM-DD)" },
        { key: "time", label: "Time" },
        { key: "counterparty", label: "Counterparty Name" },
        { key: "phone", label: "Phone" },
        { key: "gstin", label: "GSTIN" },
        { key: "pan", label: "PAN" },
        { key: "type", label: "Transaction Type" },
        { key: "flow", label: "Accounting Flow" },
        { key: "currency", label: "Currency" },
        { key: "amount", label: `Amount (${currency})` },
        { key: "referenceNumber", label: "Reference / Invoice #" },
        { key: "notes", label: "Description / Notes" },
        { key: "reversalStatus", label: "Reversal Status" },
        { key: "recordedBy", label: "Recorded By" },
        { key: "recordedByEmail", label: "User Email" },
      ]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Financial Ledger</h1>
          <p className="text-sm text-slate-400 mt-1">
            Enterprise double-entry ledger &bull; {totalCount} total records recorded
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            disabled={isExporting || totalCount === 0}
            className="rounded-xl bg-slate-900 border border-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>📥</span> {isExporting ? "Generating..." : "Export Enterprise CSV"}
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all flex items-center gap-2"
          >
            <span>+</span> Record Transaction
          </button>
        </div>
      </div>

      {/* Advanced Filters Toolbar */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Search Description / Ref / Party
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              placeholder="e.g. Reliance, INV-2026, Supplies..."
              className={inputCls}
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Transaction Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => handleFilterChange({ typeFilter: e.target.value })}
              className={inputCls}
            >
              <option value="ALL">All Types</option>
              <option value="SALE">📦 Sale</option>
              <option value="PURCHASE">🛒 Purchase</option>
              <option value="PAYMENT_RECEIEVED">💰 Payment Received</option>
              <option value="PAYMENT_MADE">💳 Payment Made</option>
              <option value="OPENING_BALANCE">🏦 Opening Balance</option>
              <option value="ADJUSTMENT">⚙️ Adjustment</option>
              <option value="REVERSAL">↩️ Reversal</option>
            </select>
          </div>

          {/* Party Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Counterparty
            </label>
            <select
              value={partyFilter}
              onChange={(e) => handleFilterChange({ partyFilter: e.target.value })}
              className={inputCls}
            >
              <option value="ALL">All Counterparties</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Page Size */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Rows Per Page
            </label>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(parseInt(e.target.value, 10))}
              className={inputCls}
            >
              <option value={10}>10 rows</option>
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
            </select>
          </div>
        </div>

        {/* Date Range Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-medium">Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleFilterChange({ startDate: e.target.value })}
              className={`${inputCls} w-auto py-1`}
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleFilterChange({ endDate: e.target.value })}
              className={`${inputCls} w-auto py-1`}
            />
          </div>

          {(search || typeFilter !== "ALL" || partyFilter !== "ALL" || startDate || endDate) && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Reset Filters &times;
            </button>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      {isPending ? (
        <div className="p-12 text-center text-xs text-slate-500 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          Loading filtered transactions...
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-12 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-300">No transactions found</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No entries match your search criteria. Try modifying your filters or recording a new transaction.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider">Date & Time</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider">Party</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider">Type</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider">Reference / Notes</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-right">Debit (+)</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-right">Credit (-)</th>
                  <th className="py-3.5 px-4 font-semibold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {transactions.map((tx) => {
                  const isDebit =
                    tx.transactionType === "SALE" ||
                    tx.transactionType === "PAYMENT_MADE" ||
                    (tx.transactionType === "OPENING_BALANCE" && tx.OpeningBalanceType === "RECEIVABLE");

                  const isReversal = tx.transactionType === "REVERSAL";

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isReversal ? "bg-rose-500/5 text-slate-400" : ""
                      }`}
                    >
                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                        <p className="font-medium text-slate-200">
                          {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(tx.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </td>

                      {/* Party */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Link
                          href={`/parties/${tx.party?.id}`}
                          className="font-semibold text-slate-200 hover:text-indigo-400 transition-colors"
                        >
                          {tx.party?.name || "N/A"}
                        </Link>
                        {tx.party?.phone && (
                          <p className="text-[11px] text-slate-500">{tx.party.phone}</p>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            tx.transactionType === "SALE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : tx.transactionType === "PURCHASE"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : tx.transactionType === "PAYMENT_RECEIEVED"
                              ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                              : tx.transactionType === "PAYMENT_MADE"
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              : tx.transactionType === "REVERSAL"
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          {tx.transactionType === "PAYMENT_RECEIEVED"
                            ? "PAYMENT IN"
                            : tx.transactionType}
                        </span>
                      </td>

                      {/* Notes / Ref */}
                      <td className="py-3.5 px-4">
                        {tx.referenceNumber && (
                          <p className="font-mono text-[11px] font-semibold text-slate-300">
                            Ref: {tx.referenceNumber}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">
                          {tx.notes || (isReversal ? `Reversal of #${tx.reversedTransactionId?.slice(0, 8)}` : "—")}
                        </p>
                        <p className="text-[10px] text-slate-500">By {tx.createdBy?.name}</p>
                      </td>

                      {/* Debit */}
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400 whitespace-nowrap">
                        {isDebit ? formatCurrency(tx.amountMinor, currency) : "—"}
                      </td>

                      {/* Credit */}
                      <td className="py-3.5 px-4 text-right font-bold text-amber-400 whitespace-nowrap">
                        {!isDebit ? formatCurrency(tx.amountMinor, currency) : "—"}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {!isReversal && (
                          <button
                            onClick={() => handleReverse(tx.id)}
                            className="text-[11px] text-rose-400 hover:text-rose-300 font-medium underline"
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

          {/* Pagination Footer */}
          <div className="bg-slate-900/90 border-t border-slate-800 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <div>
              Showing <span className="text-slate-200 font-semibold">{startItem}</span> to{" "}
              <span className="text-slate-200 font-semibold">{endItem}</span> of{" "}
              <span className="text-slate-200 font-semibold">{totalCount}</span> entries
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                &larr; Prev
              </button>

              <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-semibold">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-100">Record New Transaction</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Counterparty *
                </label>
                <select
                  required
                  value={form.partyId}
                  onChange={(e) => setForm({ ...form, partyId: e.target.value })}
                  className={inputCls}
                >
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Transaction Type *
                </label>
                <select
                  value={form.transactionType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      transactionType: e.target.value as typeof form.transactionType,
                    })
                  }
                  className={inputCls}
                >
                  <option value="SALE">📦 Sale (Invoice / To Collect)</option>
                  <option value="PAYMENT_RECEIEVED">💰 Payment Received (Reduces Receivable)</option>
                  <option value="PURCHASE">🛒 Purchase (Bill / To Pay)</option>
                  <option value="PAYMENT_MADE">💳 Payment Made (Reduces Payable)</option>
                  <option value="ADJUSTMENT">⚙️ Manual Adjustment</option>
                </select>
              </div>

              {form.transactionType === "ADJUSTMENT" && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Adjustment Direction *
                  </label>
                  <select
                    value={form.adjustmentType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        adjustmentType: e.target.value as typeof form.adjustmentType,
                      })
                    }
                    className={inputCls}
                  >
                    <option value="RECEIVABLE">Add to Receivables (To Collect)</option>
                    <option value="PAYABLE">Add to Payables (To Pay)</option>
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
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Invoice / Reference Number
                </label>
                <input
                  type="text"
                  value={form.referenceNumber}
                  onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                  placeholder="e.g. INV-2026-001"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Notes / Description
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional memo or transaction note..."
                  className={`${inputCls} resize-none`}
                />
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
                  {submitting ? "Recording..." : "Record Transaction"}
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
