// PLACEHOLDER GRAPHICS — generic SVGs drawn here, none reused from the source site.
// Swap any of these for your own assets later.

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function NavIcon({ type, size = 56 }) {
  const common = { width: size, height: size, viewBox: "0 0 48 48" };
  switch (type) {
    case "info":
      return (
        <svg {...common} aria-hidden>
          <circle cx="24" cy="24" r="18" {...stroke} />
          <line x1="24" y1="22" x2="24" y2="33" {...stroke} />
          <circle cx="24" cy="15" r="1.6" fill="currentColor" />
        </svg>
      );
    case "link":
      return (
        <svg {...common} aria-hidden>
          <rect x="6" y="18" width="20" height="12" rx="6" {...stroke} transform="rotate(-30 16 24)" />
          <rect x="22" y="18" width="20" height="12" rx="6" {...stroke} transform="rotate(-30 32 24)" />
        </svg>
      );
    case "folder":
      return (
        <svg {...common} aria-hidden>
          <path d="M6 14h12l4 4h20v22H6z" {...stroke} />
          <line x1="6" y1="26" x2="42" y2="26" {...stroke} />
        </svg>
      );
    case "question":
      return (
        <svg {...common} aria-hidden>
          <path d="M12 8h18l6 6v26H12z" {...stroke} />
          <path d="M21 22a3 3 0 1 1 4 2.8c-1 .6-1.5 1.2-1.5 2.7" {...stroke} />
          <circle cx="23.5" cy="33" r="1.4" fill="currentColor" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common} aria-hidden>
          <rect x="6" y="12" width="36" height="24" rx="2" {...stroke} />
          <path d="M6 14l18 13 18-13" {...stroke} />
        </svg>
      );
    default:
      return <svg {...common} aria-hidden><rect x="8" y="8" width="32" height="32" rx="4" {...stroke} /></svg>;
  }
}

export function SocialIcon({ size = 18 }) {
  // generic "social" placeholder badge
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" {...stroke} />
      <circle cx="12" cy="12" r="4" {...stroke} />
    </svg>
  );
}

export function SunIcon({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="4.5" {...stroke} />
      {[...Array(8)].map((_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={12 + Math.cos(a) * 7}
            y1={12 + Math.sin(a) * 7}
            x2={12 + Math.cos(a) * 9.5}
            y2={12 + Math.sin(a) * 9.5}
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

// --- Mascot placeholders (replace the original star & frog) ---

export function StarMascot({ size = 70 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label="mascot placeholder">
      <path
        d="M50 8l11 26 28 2-21 18 6 28-24-15-24 15 6-28-21-18 28-2z"
        fill="#ffe08a"
        stroke="#e0a93b"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="42" cy="48" r="2.5" fill="#7a5a17" />
      <circle cx="58" cy="48" r="2.5" fill="#7a5a17" />
      <path d="M44 56q6 5 12 0" fill="none" stroke="#7a5a17" strokeWidth="2.5" strokeLinecap="round" />
      <text x="50" y="90" textAnchor="middle" fontSize="8" fill="#b98a2a">mascot</text>
    </svg>
  );
}

export function FrogMascot({ size = 90 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 100" aria-label="mascot placeholder">
      <ellipse cx="60" cy="86" rx="46" ry="10" fill="#8fbf5a" opacity="0.7" />
      <circle cx="60" cy="56" r="30" fill="#9fd06a" stroke="#6fa53e" strokeWidth="3" />
      <circle cx="48" cy="40" r="9" fill="#9fd06a" stroke="#6fa53e" strokeWidth="3" />
      <circle cx="72" cy="40" r="9" fill="#9fd06a" stroke="#6fa53e" strokeWidth="3" />
      <circle cx="48" cy="40" r="3" fill="#2c3a16" />
      <circle cx="72" cy="40" r="3" fill="#2c3a16" />
      <path d="M48 64q12 8 24 0" fill="none" stroke="#2c3a16" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="42" cy="58" r="4" fill="#e58aa0" opacity="0.6" />
      <circle cx="78" cy="58" r="4" fill="#e58aa0" opacity="0.6" />
    </svg>
  );
}
