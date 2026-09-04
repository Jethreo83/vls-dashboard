// VlsMark.tsx — the firm's actual brand emblem, traced from the logo file:
// two vertically-mirrored trapezoids (top narrows down, bottom narrows up)
// with a diamond gap between them, and an inner kite shape with a
// downward V-notch centered in that gap. Colors match the real logo:
// maroon background #800020, warm gold/beige fill #d4b896.
export function VlsMark({ size = 30, background = true }: { size?: number; background?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      {background && <rect x="0" y="0" width="40" height="40" fill="#800020" />}
      {/* Top trapezoid: wide top edge, narrower bottom edge */}
      <polygon points="4,5 36,5 27,15 13,15" fill="#d4b896" />
      {/* Bottom trapezoid: mirror of the top */}
      <polygon points="4,35 36,35 27,25 13,25" fill="#d4b896" />
      {/* Inner kite with a downward V-notch, centered in the diamond gap */}
      <polygon points="20,15 27,21 20,25 20,22 13,21" fill="#d4b896" />
    </svg>
  );
}
