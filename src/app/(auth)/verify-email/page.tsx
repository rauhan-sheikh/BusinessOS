import Link from "next/link";

/**
 * This page is shown immediately after registration.
 * Better Auth sends the verification email. The link in the email
 * points to /api/auth/verify-email?token=...&callbackURL=/dashboard
 * which Better Auth handles server-side — it does NOT come back here.
 *
 * After the user clicks the link, Better Auth verifies the token and
 * redirects them to /dashboard (callbackURL). autoSignInAfterVerification
 * is enabled so they'll be signed in automatically.
 */
export default function VerifyEmailPage() {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20">
        <svg
          className="h-8 w-8 text-indigo-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
          />
        </svg>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-100">Check your email</h1>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">
          We sent a verification link to your email address. Click it to
          activate your account and you&apos;ll be taken straight to your
          dashboard.
        </p>
        <p className="text-xs text-slate-500 pt-1">The link expires in 1 hour.</p>
      </div>

      <p className="text-sm text-slate-500">
        Wrong account?{" "}
        <Link
          href="/login"
          className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
