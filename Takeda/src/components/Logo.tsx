export function LogoMark({ color = "#fff", size = 26 }: { color?: string; size?: number }) {
  // marca em losango (2x2 quadrados girados)
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="brand-mark">
      <g transform="rotate(45 20 20)" fill={color}>
        <rect x="9" y="9" width="10" height="10" />
        <rect x="21" y="9" width="10" height="10" />
        <rect x="9" y="21" width="10" height="10" />
        <rect x="21" y="21" width="10" height="10" />
      </g>
    </svg>
  );
}
