import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { partyService } from "@/modules/parties/services/party.service";
import { transactionService } from "@/modules/transactions/services/transaction.service";
import { headers } from "next/headers";
import Link from "next/link";
import { formatCurrency } from "@/shared/utils/currency";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const memberships = await businessService.getBusinessesForUser(session!.user.id);
  const activeBusiness = memberships[0].business;

  // Query real data from domain services
  const [aggregates, { transactions: recentTransactions }] = await Promise.all([
    partyService.getBusinessPartyAggregates(activeBusiness.id),
    transactionService.listTransactions(activeBusiness.id, { limit: 5 }),
  ]);

  const currency = activeBusiness.currency || "INR";

  return (
    <div className="space-y-8">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Welcome back, {session!.user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {activeBusiness.name} &mdash; Financial Overview & Operations
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/parties?action=new"
            className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            <span>+</span> Add Party
          </Link>
          <Link
            href="/transactions?action=new"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all flex items-center gap-2"
          >
            <span>+</span> Record Transaction
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receivables */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              To Collect (Receivable)
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {formatCurrency(aggregates.totalReceivablesMinor, currency)}
          </p>
          <p className="text-xs text-slate-500">From customers / counterparties</p>
        </div>

        {/* Total Payables */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              To Pay (Payable)
            </span>
            <span className="h-2 w-2 rounded-full bg-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {formatCurrency(aggregates.totalPayablesMinor, currency)}
          </p>
          <p className="text-xs text-slate-500">To vendors / suppliers</p>
        </div>

        {/* Net Standing */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Net Balance
            </span>
            <span className="h-2 w-2 rounded-full bg-indigo-400" />
          </div>
          {(() => {
            const net = aggregates.totalReceivablesMinor - aggregates.totalPayablesMinor;
            return (
              <p className={`text-2xl font-bold ${net >= BigInt(0) ? "text-slate-100" : "text-rose-400"}`}>
                {formatCurrency(net >= BigInt(0) ? net : -net, currency)}
                <span className="text-xs font-normal text-slate-500 ml-1.5">
                  {net >= BigInt(0) ? "(Positive)" : "(Deficit)"}
                </span>
              </p>
            );
          })()}
          <p className="text-xs text-slate-500">Receivables minus Payables</p>
        </div>

        {/* Active Parties */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Active Parties
            </span>
            <span className="h-2 w-2 rounded-full bg-sky-400" />
          </div>
          <p className="text-2xl font-bold text-slate-200">{aggregates.totalParties}</p>
          <Link href="/parties" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            View all parties &rarr;
          </Link>
        </div>
      </div>

      {/* Recent Ledger Activity */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Recent Ledger Transactions
          </h2>
          <Link
            href="/transactions"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
          >
            View full ledger &rarr;
          </Link>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/50 text-slate-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <p className="text-sm text-slate-400 font-medium">No transactions recorded yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your first customer or vendor to start recording sales, purchases, and payments.
            </p>
            <div className="pt-2">
              <Link
                href="/parties?action=new"
                className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
              >
                Add First Party
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60 overflow-hidden">
            {recentTransactions.map((tx) => {
              const isCredit =
                tx.transactionType === "SALE" ||
                tx.transactionType === "PAYMENT_MADE" ||
                (tx.transactionType === "OPENING_BALANCE" && tx.OpeningBalanceType === "RECEIVABLE");

              return (
                <div key={tx.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                        tx.transactionType === "SALE"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : tx.transactionType === "PURCHASE"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : tx.transactionType === "PAYMENT_RECEIEVED"
                          ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                          : tx.transactionType === "PAYMENT_MADE"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          : tx.transactionType === "REVERSAL"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {tx.transactionType === "PAYMENT_RECEIEVED"
                        ? "PAYMENT IN"
                        : tx.transactionType === "PAYMENT_MADE"
                        ? "PAYMENT OUT"
                        : tx.transactionType.replace("_", " ")}
                    </span>
                    <div>
                      <Link
                        href={`/parties/${tx.partyId}`}
                        className="text-sm font-medium text-slate-200 hover:text-indigo-400 transition-colors"
                      >
                        {tx.party.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {tx.notes ? ` • ${tx.notes}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        isCredit ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {formatCurrency(tx.amountMinor, currency)}
                    </p>
                    <span className="text-[10px] text-slate-500">by {tx.createdBy.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Business Details Card */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Business Profile
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <Detail label="Business Name" value={activeBusiness.name} />
          <Detail label="Legal Name" value={activeBusiness.legalName ?? "—"} />
          <Detail label="GSTIN" value={activeBusiness.gstin ?? "—"} />
          <Detail label="PAN" value={activeBusiness.pan ?? "—"} />
          <Detail label="Email" value={activeBusiness.email ?? "—"} />
          <Detail label="Phone" value={activeBusiness.phone ?? "—"} />
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className="text-slate-300 font-medium">{value}</p>
    </div>
  );
}
