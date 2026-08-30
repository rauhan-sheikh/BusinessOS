"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Logo from "@/shared/components/Logo";

interface OnboardingHeaderProps {
  userName: string;
}

export default function OnboardingHeader({ userName }: OnboardingHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => router.push("/login"),
      },
    });
  };

  return (
    <header className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
      <Logo href="/" badge="Workspace Setup" size="md" />

      <div className="flex items-center gap-3 text-xs">
        <span className="text-slate-400 hidden sm:inline">
          Signed in as <span className="text-slate-200 font-medium">{userName}</span>
        </span>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
