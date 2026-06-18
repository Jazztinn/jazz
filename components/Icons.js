// Toolbar icons (theme + sound). currentColor follows --icon.

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function SunIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="4.2" {...stroke} />
      {[...Array(8)].map((_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={12 + Math.cos(a) * 7}
            y1={12 + Math.sin(a) * 7}
            x2={12 + Math.cos(a) * 9.4}
            y2={12 + Math.sin(a) * 9.4}
            {...stroke}
          />
        );
      })}
    </svg>
  );
}

export function MoonIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M19 14.5A8 8 0 0 1 9.5 5a7 7 0 1 0 9.5 9.5z" {...stroke} />
    </svg>
  );
}

export function SoundIcon({ muted, size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9z" {...stroke} />
      {muted ? (
        <line x1="16" y1="9" x2="22" y2="15" {...stroke} />
      ) : (
        <path d="M16 9a4 4 0 0 1 0 6" {...stroke} />
      )}
    </svg>
  );
}
