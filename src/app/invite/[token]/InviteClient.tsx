"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/shared/components/Logo";

interface InviteClientProps {
  token: string;
  invitation: {
    id: string;
    email: string;
    role: string;
    business: {
      id: string;
      name: string;
      legalName: string | null;
      currency: string;
    };
    inviter: {
      name: string;
      email: string;
    };
  };
  currentUser: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export default function InviteClient({
  token,
  invitation,
  currentUser,
}: InviteClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // New user registration state
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const isEmailMatching =
    currentUser &&
    currentUser.email.toLowerCase() === invitation.email.toLowerCase();

  const handleAcceptLoggedIn = async () => {
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/invitations/${token}`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invitation");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
      setSubmitting(false);
    }
  };

  const handleRegisterAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/invitations/${token}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          Array.isArray(data.error) ? data.error[0]?.message : data.error || "Failed to join workspace"
        );
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-hidden bg-slate-950 text-slate-100 antialiased p-4">
      {/* Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 mx-auto w-full max-w-7xl py-4 flex items-center justify-between">
        <Logo href="/" size="md" />
        <Link href="/" className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors">
          &larr; Back to Home
        </Link>
      </header>

      {/* Card Content */}
      <div className="relative z-10 mx-auto w-full max-w-md my-8">
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800/80 p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xl mx-auto">
              🏢
            </div>
            <h1 className="text-xl font-bold text-slate-100">
              Join {invitation.business.name}
            </h1>
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-slate-300">{invitation.inviter.name}</span> has invited you to join their workspace
            </p>
          </div>

          {/* Invitation Details Banner */}
          <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Invited Email:</span>
              <span className="font-medium text-slate-200">{invitation.email}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Assigned Role:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {invitation.role}
              </span>
            </div>
          </div>

          {/* Scenario 1: User is already logged in with matching email */}
          {currentUser && isEmailMatching && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 text-center">
                Signed in as <span className="font-semibold text-slate-100">{currentUser.email}</span>
              </div>

              {error && (
                <p className="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                  {error}
                </p>
              )}

              <button
                onClick={handleAcceptLoggedIn}
                disabled={submitting}
                className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
              >
                {submitting ? "Joining Workspace..." : "Accept Invitation & Enter Dashboard"}
              </button>
            </div>
          )}

          {/* Scenario 2: User is logged in with a DIFFERENT email */}
          {currentUser && !isEmailMatching && (
            <div className="space-y-4 text-center">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                You are currently signed in as <strong>{currentUser.email}</strong>, but this invitation was sent to <strong>{invitation.email}</strong>.
              </div>
              <Link
                href="/login"
                className="block w-full rounded-xl bg-slate-800 border border-slate-700 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all"
              >
                Switch Account / Sign In
              </Link>
            </div>
          )}

          {/* Scenario 3: User is not logged in */}
          {!currentUser && (
            <div className="space-y-4">
              <form onSubmit={handleRegisterAndAccept} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Create Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className={inputCls}
                  />
                </div>

                {error && (
                  <p className="text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-center">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all disabled:opacity-50"
                >
                  {submitting ? "Setting up Account..." : "Set Password & Join Workspace"}
                </button>
              </form>

              <div className="pt-2 text-center text-xs text-slate-500">
                Already have an account?{" "}
                <Link
                  href={`/login?callbackUrl=/invite/${token}`}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Sign in here
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 mx-auto w-full max-w-7xl py-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} BusinessOS. All rights reserved.</p>
        <div className="flex items-center gap-4 text-[11px]">
          <Link href="/privacy" className="hover:text-slate-400">
            Privacy Policy
          </Link>
          <span>&bull;</span>
          <Link href="/terms" className="hover:text-slate-400">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition";
