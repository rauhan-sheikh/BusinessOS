import React from "react";

interface LogoIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
}

/**
 * BusinessOS Non-Text Icon Mark
 * Represents structured double-entry ledger balance, atomic security, and liquidity flow.
 */
export default function LogoIcon({
  className = "w-6 h-6",
  size,
  ...props
}: LogoIconProps) {
  const width = size || props.width || 24;
  const height = size || props.height || 24;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        {/* Primary Indigo to Violet Gradient */}
        <linearGradient id="bos-grad-primary" x1="2" y1="4" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>

        {/* Accent Emerald Glow Gradient */}
        <linearGradient id="bos-grad-accent" x1="16" y1="6" x2="28" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* Inner Plate Translucency */}
        <linearGradient id="bos-grad-glass" x1="6" y1="12" x2="26" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A5B4FC" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.2" />
        </linearGradient>

        {/* Ambient shadow */}
        <filter id="bos-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#6366F1" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Outer Rounded Isometric Ledger Frame */}
      <rect
        x="3"
        y="3"
        width="26"
        height="26"
        rx="8"
        fill="#0F172A"
        stroke="url(#bos-grad-primary)"
        strokeWidth="1.5"
        filter="url(#bos-glow)"
      />

      {/* Layer 1: Left Balance Column (Debit / Asset Pillar) */}
      <rect
        x="7.5"
        y="8.5"
        width="4.5"
        height="15"
        rx="2.25"
        fill="url(#bos-grad-primary)"
      />

      {/* Layer 2: Right Balance Column (Credit / Revenue Pillar) */}
      <rect
        x="20"
        y="12"
        width="4.5"
        height="11.5"
        rx="2.25"
        fill="url(#bos-grad-primary)"
        opacity="0.8"
      />

      {/* Layer 3: Central Ledger Connector / Cross-Entry Node */}
      <path
        d="M9.75 14H22.25"
        stroke="url(#bos-grad-glass)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Layer 4: Liquidity / Precision Anchor (Emerald Dot) */}
      <circle
        cx="22.25"
        cy="8.5"
        r="2.25"
        fill="url(#bos-grad-accent)"
      />
    </svg>
  );
}
