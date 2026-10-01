"use client";

import { useState } from "react";

const SIZES = {
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-24 w-24",
} as const;

export function BrandMark({
  size = "md",
  className = "",
  fallback = "lettermark",
}: {
  size?: keyof typeof SIZES;
  className?: string;
  fallback?: "lettermark" | "none";
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    if (fallback === "none") return null;
    return (
      <span
        aria-hidden
        className={`${SIZES[size]} grid shrink-0 place-items-center rounded-xl
                    bg-[var(--primary)] font-serif font-bold text-white
                    shadow-[0_8px_24px_rgba(176,18,26,.35)] ${className}`}
      >
        M
      </span>
    );
  }

  return (
    <span
      className={`${SIZES[size]} grid shrink-0 place-items-center overflow-hidden
                  rounded-xl bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,.25)] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.jpg"
        alt="Mashanoch Private Schools"
        className="h-full w-full origin-center translate-y-[15%] scale-[1.8] object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
