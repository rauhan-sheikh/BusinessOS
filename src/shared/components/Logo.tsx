import React from "react";
import Link from "next/link";
import LogoIcon from "./LogoIcon";

interface LogoProps {
  href?: string;
  badge?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

export default function Logo({
  href = "/",
  badge,
  size = "md",
  className = "",
  showText = true,
}: LogoProps) {
  const iconSizes = {
    sm: 20,
    md: 26,
    lg: 32,
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  };

  const content = (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={iconSizes[size]} className="flex-shrink-0" />
      {showText && (
        <div className="flex items-center gap-2">
          <span
            className={`${textSizes[size]} font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-indigo-300 bg-clip-text text-transparent`}
          >
            BusinessOS
          </span>
          {badge && (
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
