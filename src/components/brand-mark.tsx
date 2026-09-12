"use client";

import { useState } from "react";

const SIZES = {
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-24 w-24",
} as const;

/**
 * The school crest, on a white chip so its black lettering stays legible
 * against the dark sidebar and hero panel.
 *
 * If public/logo.jpg is missing or fails to load, this renders the lettermark
 * badge — or nothing at all when `fallback` is "none" — rather than a broken
 * image icon.
 */
export function BrandMark({
  size = "md",
  className = "",
  fallback = "lettermark",
}: {
  size?: keyof typeof SIZES;
  className?: string;
  /**
   * What to show when public/logo.jpg is missing. The sidebar needs something
   * in that slot, but the sign-in hero already carries the school name in
   * type, so an "M" badge there is just noise.
   */
  fallback?: "lettermark" | "none";
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    if (fallback === "none") return null;
    return (
      <span
        aria-hidden
        className={`${SIZES[size]} grid shrink-0 place-items-center rounded-xl
                    bg-indigo-500 font-bold text-white
                    shadow-[0_8px_24px_rgba(99,102,241,.35)] ${className}`}
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
      {/* The crest occupies only the middle of a 482x356 image and sits above
          its centre, so scaling alone pushed it up and clipped the ribbon.
          Scale trims the white margin; the nudge down re-centres the shield in
          the chip. Both numbers are tuned to this artwork. */}
      <img
        src="/logo.jpg"
        alt="Mashanoch Private Schools"
        className="h-full w-full origin-center translate-y-[15%] scale-[1.8] object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
