"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/shared/components/Logo";

export default function MarketingFooter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/emailList", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          Array.isArray(data.error) ? data.error[0]?.message : data.error || "Failed to subscribe"
        );
      }

      setStatus("success");
      setEmail("");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to join newsletter");
    }
  };

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400 text-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 space-y-12">
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand & Mission (2 cols on lg) */}
          <div className="lg:col-span-2 space-y-4">
            <Logo href="/" size="md" />
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">
              The complete, multi-tenant business operating system built for modern SMEs.
              Manage counterparties, track immutable financial ledgers, and streamline operations with zero floating-point drift.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                All Systems Operational &bull; Neon PostgreSQL
              </span>
            </div>
          </div>

          {/* Col 1: Product */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
              Product
            </p>
            <ul className="space-y-2.5">
              <li>
                <Link href="/#features" className="hover:text-slate-200 transition-colors">
                  Financial Ledger
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-slate-200 transition-colors">
                  Customer & Vendor Directory
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-slate-200 transition-colors">
                  Snapshot Balances
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-slate-200 transition-colors">
                  Audit History & Reversals
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-slate-200 transition-colors">
                  Create Business Account
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 2: Legal & Trust */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
              Legal & Trust
            </p>
            <ul className="space-y-2.5">
              <li>
                <Link href="/privacy" className="hover:text-slate-200 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-slate-200 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/security" className="hover:text-slate-200 transition-colors">
                  Security & Data Posture
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-slate-200 transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Newsletter & Updates */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
              Stay Updated
            </p>
            <p className="text-slate-400 text-xs">
              Subscribe for release notes, product updates, and accounting tips.
            </p>
            <form onSubmit={handleNewsletter} className="space-y-2">
              <div className="flex flex-col gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your work email"
                  disabled={status === "loading" || status === "success"}
                  className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={status === "loading" || status === "success"}
                  className="w-full rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {status === "loading" ? "Subscribing..." : status === "success" ? "Subscribed ✓" : "Subscribe"}
                </button>
              </div>
              {status === "success" && (
                <p className="text-[11px] text-emerald-400 font-medium">
                  Thanks for subscribing! We&apos;ll keep you posted.
                </p>
              )}
              {status === "error" && (
                <p className="text-[11px] text-rose-400 font-medium">{errorMessage}</p>
              )}
            </form>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} BusinessOS. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span>🌐</span> English (India) &bull; INR (₹)
            </span>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:text-slate-400 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-slate-400 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
