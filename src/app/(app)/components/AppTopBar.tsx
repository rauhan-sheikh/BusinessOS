"use client";

import { useState, useRef, useEffect } from "react";
import { signOut } from "@/lib/auth-client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Logo from "@/shared/components/Logo";
import type { BusinessRole } from "@/generated/prisma/client";

export interface WorkspaceMembership {
  id: string;
  name: string;
  role: BusinessRole;
}

type AppTopBarProps = {
  user: { name: string; email: string };
  businessName: string;
  activeBusinessId?: string;
  activeRole?: BusinessRole;
  memberships?: WorkspaceMembership[];
};

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Parties", href: "/parties" },
  { label: "Ledger", href: "/transactions" },
  { label: "Settings", href: "/settings" },
];

export default function AppTopBar({
  user,
  businessName,
  activeBusinessId,
  activeRole = "OWNER",
  memberships = [],
}: AppTopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await signOut({ fetchOptions: { onSuccess: () => router.push("/login") } });
  };

  const handleSwitchWorkspace = async (businessId: string) => {
    if (businessId === activeBusinessId) {
      setWorkspaceDropdownOpen(false);
      return;
    }

    setSwitching(true);
    try {
      const res = await fetch("/api/businesses/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      if (!res.ok) {
        throw new Error("Failed to switch workspace");
      }

      setWorkspaceDropdownOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to switch workspace");
    } finally {
      setSwitching(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setWorkspaceDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: Logo + Workspace Switcher + Desktop Nav */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Logo href="/dashboard" size="md" />

              <div className="h-4 w-px bg-slate-800 hidden sm:block" />

              {/* Workspace Switcher Trigger */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-xs font-semibold transition-all cursor-pointer group"
                >
                  <span className="text-indigo-400 max-w-[110px] sm:max-w-[150px] truncate">
                    {businessName}
                  </span>
                  <span className="text-[10px] text-slate-500 group-hover:text-slate-300">
                    ▼
                  </span>
                </button>

                {/* Workspace Switcher Menu Dropdown */}
                {workspaceDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-fade-in text-xs space-y-1">
                    <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
                      Workspaces
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-0.5 py-1">
                      {memberships.map((m) => {
                        const isCurrent = m.id === activeBusinessId;
                        return (
                          <button
                            key={m.id}
                            disabled={switching}
                            onClick={() => handleSwitchWorkspace(m.id)}
                            className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                              isCurrent
                                ? "bg-indigo-600/15 text-indigo-300 font-semibold"
                                : "text-slate-300 hover:bg-slate-800"
                            }`}
                          >
                            <div className="truncate pr-2">
                              <p className="truncate text-xs">{m.name}</p>
                              <span className="text-[10px] text-slate-500 font-normal">
                                {m.role}
                              </span>
                            </div>
                            {isCurrent && (
                              <span className="text-indigo-400 font-bold">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-1 border-t border-slate-800/80">
                      <Link
                        href="/onboarding"
                        onClick={() => setWorkspaceDropdownOpen(false)}
                        className="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-indigo-400 hover:bg-indigo-500/10 transition-colors flex items-center gap-1.5"
                      >
                        <span>+</span> Create New Workspace
                      </Link>
                    </div>
                  </div>
                )}
              </div>
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
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-[10px] text-slate-500">{user.email}</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                  {activeRole}
                </span>
              </div>
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
          {/* Workspaces List in Mobile Drawer */}
          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-900/70 border border-slate-800/80">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Switch Workspace ({memberships.length})
            </p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {memberships.map((m) => {
                const isCurrent = m.id === activeBusinessId;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleSwitchWorkspace(m.id);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between text-xs transition-colors ${
                      isCurrent
                        ? "bg-indigo-600/20 text-indigo-300 font-bold"
                        : "text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <span>{m.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {m.role}
                    </span>
                  </button>
                );
              })}
            </div>
            <Link
              href="/onboarding"
              onClick={() => setMobileMenuOpen(false)}
              className="block pt-1 text-center text-xs font-semibold text-indigo-400 hover:underline"
            >
              + Create New Workspace
            </Link>
          </div>

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
            <div className="px-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-200">{user.name}</p>
                <p className="text-[11px] text-slate-500">{user.email}</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                {activeRole}
              </span>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-rose-400 hover:bg-slate-800 transition-all cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
