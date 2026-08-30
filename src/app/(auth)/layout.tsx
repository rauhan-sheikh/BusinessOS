import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Logo from "@/shared/components/Logo";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-slate-950 text-slate-100 antialiased">
      {/* Decorative ambient background */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <Logo href="/" size="md" />
        <Link
          href="/"
          className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
        >
          <span>&larr;</span> Back to Home
        </Link>
      </header>

      {/* Centered Content */}
      <div className="relative z-10 mx-auto w-full max-w-md px-4 py-8">
        {children}
      </div>

      {/* Bottom Footer */}
      <footer className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} BusinessOS. All rights reserved.</p>
        <div className="flex items-center gap-4 text-[11px]">
          <Link href="/privacy" className="hover:text-slate-400 transition-colors">
            Privacy Policy
          </Link>
          <span>&bull;</span>
          <Link href="/terms" className="hover:text-slate-400 transition-colors">
            Terms of Service
          </Link>
          <span>&bull;</span>
          <Link href="/security" className="hover:text-slate-400 transition-colors">
            Security
          </Link>
        </div>
      </footer>
    </div>
  );
}
