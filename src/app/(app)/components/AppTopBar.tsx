"use client";

import { useState } from "react";
import { signOut } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "@/shared/components/Logo";

type AppTopBarProps = {
  user: { name: string; email: string };
  businessName: string;
};

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Parties", href: "/parties" },
  { label: "Ledger", href: "/transactions" },
  { label: "Settings", href: "/settings" },
];

export default function AppTopBar({ user, businessName }: AppTopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut({ fetchOptions: { onSuccess: () => router.push("/login") } });
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo + Business name + Desktop Nav */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Logo href="/dashboard" size="md" />
              <div className="h-4 w-px bg-slate-800 hidden sm:block" />
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 max-w-[120px] sm:max-w-[160px] truncate">
                {businessName}
              </span>
            </div>

            {/* Desktop Navigation links */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-slate-800 text-slate-100 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Desktop User info + logout */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-medium text-slate-300">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all cursor-pointer"
            >
              Sign out
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 focus:outline-none cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                // Close icon (X)
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // Hamburger icon
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl px-4 pt-2 pb-6 space-y-4 animate-fade-in shadow-2xl">
          {/* Navigation Links */}
          <nav className="flex flex-col space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-between ${
                    isActive
                      ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/20"
                      : "text-slate-300 hover:bg-slate-900"
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />}
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout on Mobile */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-3">
            <div className="px-2">
              <p className="text-xs font-semibold text-slate-200">{user.name}</p>
              <p className="text-[11px] text-slate-500">{user.email}</p>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-rose-400 hover:bg-slate-800 transition-all cursor-pointer"
            >
              Sign out of Workspace
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
