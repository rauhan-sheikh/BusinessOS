import Link from "next/link";
import LogoIcon from "@/shared/components/LogoIcon";

interface AppFooterProps {
  businessName?: string;
}

export default function AppFooter({ businessName }: AppFooterProps) {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950/80 text-slate-500 text-xs py-6 mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Business Context & Copyright */}
        <div className="flex items-center gap-2.5">
          <LogoIcon size={18} />
          <span className="font-extrabold tracking-tight bg-gradient-to-r from-slate-200 via-slate-300 to-indigo-300 bg-clip-text text-transparent">
            BusinessOS
          </span>
          <span className="text-slate-700">&bull;</span>
          <span className="text-slate-400">
            {businessName ? `${businessName} Workspace` : "SME Operating System"}
          </span>
          <span className="text-slate-700">&bull;</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>

        {/* Right: Quick Links & Status */}
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
            <span>Neon DB Connected</span>
          </div>
          <span className="text-slate-700">&bull;</span>
          <Link href="/privacy" className="hover:text-slate-300 transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-slate-300 transition-colors">
            Terms
          </Link>
          <Link href="/security" className="hover:text-slate-300 transition-colors">
            Security
          </Link>
          <Link href="/cookies" className="hover:text-slate-300 transition-colors">
            Cookies
          </Link>
        </div>
      </div>
    </footer>
  );
}
