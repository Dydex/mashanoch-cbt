"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-[#5b58d6] px-4 py-2 text-sm font-semibold text-white
                 transition hover:bg-[#4b48c4]"
    >
      Print
    </button>
  );
}
