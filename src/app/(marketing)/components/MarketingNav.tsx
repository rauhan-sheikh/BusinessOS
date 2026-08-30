"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "@/shared/components/Logo";

export default function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Logo href="/" badge="v1.0" size="md" />

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            <Link href="/#features" className="hover:text-slate-200 transition-colors">
              Features
            </Link>
            <Link href="/#workflow" className="hover:text-slate-200 transition-colors">
              Workflow
            </Link>
            <Link href="/#security" className="hover:text-slate-200 transition-colors">
              Security
            </Link>
            <Link href="/privacy" className="hover:text-slate-200 transition-colors">
              Policies
            </Link>
          </nav>
        </div>

        {/* Desktop Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-900 transition-all"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 active:scale-[0.98] transition-all"
          >
            Get Started Free
          </Link>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="flex md:hidden items-center gap-2">
          <Link
            href="/login"
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white"
          >
            Sign in
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 focus:outline-none cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-4 animate-fade-in shadow-2xl">
          <nav className="flex flex-col space-y-1 text-sm font-medium text-slate-300">
            <Link
              href="/#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
            >
              Features
            </Link>
            <Link
              href="/#workflow"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
            >
              Workflow
            </Link>
            <Link
              href="/#security"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
            >
              Security Architecture
            </Link>
            <Link
              href="/privacy"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
            >
              Privacy & Legal
            </Link>
          </nav>

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
            <Link
              href="/register"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full py-3 rounded-xl bg-indigo-600 text-center text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
            >
              Create Free Account &rarr;
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
