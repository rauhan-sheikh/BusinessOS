"use client";

import React, { useState } from "react";
import Link from "next/link";
import MarketingNav from "./(marketing)/components/MarketingNav";
import MarketingFooter from "./(marketing)/components/MarketingFooter";

export default function HomePageClient() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/emailList", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.error) ? data.error[0]?.message : data.error || "Failed to subscribe."
        );
      }

      setStatus("success");
      setEmail("");
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "An unexpected error occurred.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      <MarketingNav />

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden pt-20 pb-24 lg:pt-32 lg:pb-36">
          {/* Ambient Glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[550px] w-[800px] rounded-full bg-indigo-600/15 blur-[140px] pointer-events-none" />
          <div className="absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-emerald-500/10 blur-[130px] pointer-events-none" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center space-y-8">
            {/* Top Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/90 border border-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-300 backdrop-blur-md shadow-xl">
              <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
              <span>Production-Grade SME Operating System</span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-indigo-400">Zero Floating-Point Drift</span>
            </div>

            {/* Headline */}
            <h1 className="mx-auto max-w-4xl text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight bg-gradient-to-b from-slate-100 via-slate-200 to-indigo-300 bg-clip-text text-transparent leading-[1.15]">
              The Modern Operating System for SME Business & Financial Ledgers
            </h1>

            {/* Subhead */}
            <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-400 font-normal leading-relaxed">
              Track receivables and payables, maintain immutable double-entry ledger transactions,
              and manage counterparty balances with integer-precise atomic snapshots. Built for serious business operators.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/register"
                className="w-full sm:w-auto rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-600/25 hover:bg-indigo-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Get Started Free &rarr;
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto rounded-xl bg-slate-900/90 border border-slate-800 px-6 py-3.5 text-sm font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-all"
              >
                Sign In to Workspace
              </Link>
            </div>

            {/* Micro Highlights */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Multi-Tenant Isolation
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Instant GSTIN & PAN Records
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Immutable Financial Audit Trail
              </span>
            </div>

            {/* LIVE DASHBOARD PREVIEW MOCKUP */}
            <div className="pt-12 mx-auto max-w-5xl">
              <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-2 sm:p-4 shadow-2xl backdrop-blur-md">
                <div className="rounded-2xl bg-slate-950 border border-slate-800/80 p-4 sm:p-6 text-left space-y-6">
                  {/* Mock App Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                      <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                      <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                      <span className="text-xs font-semibold text-slate-400 ml-2">
                        Acme Enterprises &bull; Dashboard
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Live Production Demo
                      </span>
                    </div>
                  </div>

                  {/* Mock Stat Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        To Collect (Receivable)
                      </span>
                      <p className="text-xl font-extrabold text-emerald-400">₹3,45,200.00</p>
                      <p className="text-[11px] text-slate-500">From 18 customers</p>
                    </div>
                    <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        To Pay (Payable)
                      </span>
                      <p className="text-xl font-extrabold text-amber-400">₹1,18,500.00</p>
                      <p className="text-[11px] text-slate-500">To 7 vendors</p>
                    </div>
                    <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Net Balance
                      </span>
                      <p className="text-xl font-extrabold text-slate-100">+₹2,26,700.00</p>
                      <p className="text-[11px] text-emerald-400 font-medium">Positive liquidity</p>
                    </div>
                  </div>

                  {/* Mock Table */}
                  <div className="rounded-xl bg-slate-900/40 border border-slate-800/60 divide-y divide-slate-800/60 text-xs overflow-hidden">
                    <div className="p-3 flex items-center justify-between text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <span>Recent Activity</span>
                      <span>Amount</span>
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          SALE
                        </span>
                        <div>
                          <p className="font-semibold text-slate-200">Reliance Digital Retails</p>
                          <p className="text-[11px] text-slate-500">INV-2026-089 &bull; Electronic supplies</p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-400">+₹84,000.00</span>
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          PAYMENT IN
                        </span>
                        <div>
                          <p className="font-semibold text-slate-200">Shree Ganesh Logistics</p>
                          <p className="text-[11px] text-slate-500">UPI Ref #893721 &bull; Direct Bank Transfer</p>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-400">+₹45,000.00</span>
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          PURCHASE
                        </span>
                        <div>
                          <p className="font-semibold text-slate-200">Tata Raw Materials Ltd</p>
                          <p className="text-[11px] text-slate-500">BILL-4412 &bull; Bulk raw supplies</p>
                        </div>
                      </div>
                      <span className="font-bold text-amber-400">₹32,500.00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID SECTION */}
        <section id="features" className="py-24 border-t border-slate-800 bg-slate-950/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                Core Architectural Capabilities
              </h2>
              <p className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                Engineered for Integrity, Built for High Precision
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                BusinessOS eliminates accounting errors and data inconsistencies with proven software architecture.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 space-y-3 hover:border-slate-700 transition-all">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-lg">
                  📖
                </div>
                <h3 className="text-base font-bold text-slate-100">Immutable Financial Ledger</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every financial movement is logged as an immutable transaction event. Never overwrite historical records silently.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 space-y-3 hover:border-slate-700 transition-all">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-lg">
                  ⚡
                </div>
                <h3 className="text-base font-bold text-slate-100">Atomic Snapshot Balances</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Fast, index-optimized `PartyBalance` snapshots are updated inside database transactions alongside every ledger entry.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 space-y-3 hover:border-slate-700 transition-all">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 text-lg">
                  👥
                </div>
                <h3 className="text-base font-bold text-slate-100">Comprehensive Counterparty Directory</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Seamlessly organize Customers, Vendors, and Partners. Track GSTIN, PAN, and full statement ledger histories per party.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 space-y-3 hover:border-slate-700 transition-all">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-lg">
                  🔐
                </div>
                <h3 className="text-base font-bold text-slate-100">Multi-Tenant Team Roles</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Support for OWNER, ADMIN, and ACCOUNTANT business roles. Rigorous tenant boundaries ensure zero cross-tenant access.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 space-y-3 hover:border-slate-700 transition-all">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-lg">
                  🔢
                </div>
                <h3 className="text-base font-bold text-slate-100">Minor-Units Integer Accounting</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  All money values are stored as 64-bit integer minor units (paise/cents), completely eliminating floating-point rounding errors.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 space-y-3 hover:border-slate-700 transition-all">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-lg">
                  ↩️
                </div>
                <h3 className="text-base font-bold text-slate-100">Non-Destructive Reversals</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Mistakes happen. Reverse erroneous entries with a single click while preserving a clean, accountable audit record.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* WORKFLOW SECTION */}
        <section id="workflow" className="py-24 border-t border-slate-800 bg-slate-950">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-16">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-400">
                Simple 3-Step Operations
              </h2>
              <p className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                How BusinessOS Powers Your Daily Operations
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3 text-center">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs">
                  1
                </span>
                <h3 className="text-base font-bold text-slate-200">Onboard Your Company</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sign up in seconds, configure your business name, GSTIN, PAN, and base currency.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3 text-center">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs">
                  2
                </span>
                <h3 className="text-base font-bold text-slate-200">Add Counterparties</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Import or create customers and suppliers with existing opening balances.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3 text-center">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs">
                  3
                </span>
                <h3 className="text-base font-bold text-slate-200">Manage Ledgers & Cashflow</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Record sales, purchases, and incoming/outgoing payments with real-time balance calculations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECURITY & ARCHITECTURE SECTION */}
        <section id="security" className="py-24 border-t border-slate-800 bg-slate-950/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-3xl space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                Security & Infrastructure
              </h2>
              <p className="text-3xl font-extrabold text-slate-100 tracking-tight">
                Enterprise Reliability for Growing Businesses
              </p>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Financial data requires zero compromises. BusinessOS runs on high-availability PostgreSQL with Neon,
                enforces server-side authentication through Better Auth, and guarantees complete multi-tenant boundaries.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="font-bold text-slate-200 mb-1">Server-Side Auth</p>
                <p className="text-slate-400">HttpOnly session cookies with cryptographic verification.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="font-bold text-slate-200 mb-1">Strict Tenant Isolation</p>
                <p className="text-slate-400">Every database query is strictly scoped to the active business ID.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="font-bold text-slate-200 mb-1">Transactional Atomicity</p>
                <p className="text-slate-400">Ledger writes and balance snapshots succeed or roll back together.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <p className="font-bold text-slate-200 mb-1">Complete Audit Trail</p>
                <p className="text-slate-400">All sensitive actions record IP, user attribution, and timestamps.</p>
              </div>
            </div>
          </div>
        </section>

        {/* EARLY ACCESS NEWSLETTER SECTION */}
        <section className="py-20 border-t border-slate-800 bg-slate-900/30">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
              Join Ambitious SME Operators
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
              Get product updates, new ledger features, and early access to invoicing and inventory modules.
            </p>

            <form onSubmit={handleSubscribe} className="max-w-md mx-auto flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your work email"
                disabled={status === "loading" || status === "success"}
                className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === "loading" || status === "success"}
                className="rounded-xl bg-indigo-600 px-5 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
              >
                {status === "loading" ? "Joining..." : status === "success" ? "Joined ✓" : "Join Newsletter"}
              </button>
            </form>

            {status === "success" && (
              <p className="text-xs text-emerald-400 font-medium animate-fade-in">
                Thank you! You are now subscribed to BusinessOS updates.
              </p>
            )}
            {status === "error" && (
              <p className="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-xl max-w-md mx-auto">
                {errorMessage}
              </p>
            )}
          </div>
        </section>

        {/* FINAL CALL TO ACTION */}
        <section className="relative py-20 border-t border-slate-800 bg-gradient-to-b from-slate-950 to-indigo-950/40 text-center overflow-hidden">
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              Ready to Upgrade Your Business Operations?
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Create your business workspace today. Start tracking receivables, payables, and transactions with total confidence.
            </p>
            <div className="pt-2">
              <Link
                href="/register"
                className="inline-flex rounded-xl bg-indigo-600 px-8 py-3.5 text-sm font-semibold text-white shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 active:scale-[0.98] transition-all"
              >
                Create Free Account &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
