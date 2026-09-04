// VlsMark.tsx — brand emblem: a simple geometric shield/V mark in gold,
// evoking the firm's actual logo (upward chevron with a diamond accent).
// Kept intentionally simple/clean rather than an exact pixel trace —
// swap for the real logo SVG file if Jed provides one as a vector asset.
export function VlsMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <polygon points="20,4 36,32 4,32" fill="none" stroke="#e6c288" strokeWidth="3" />
      <polygon points="20,16 26,27 14,27" fill="#e6c288" />
    </svg>
  );
}
