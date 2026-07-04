/*
 * Fortune God symbol graphics — hand-drawn inline SVGs, red/gold theme.
 * W wild, S scatter coin, M1 gold ingot, M2 red envelope,
 * M3 firecrackers, M4 jade ring, A/K/Q/J card gems.
 */

const FORTUNE_SVG = {
  W: `
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 3l26 29-26 29L6 32z" fill="#b3121f" stroke="#f5c542" stroke-width="3"/>
      <path d="M32 10l20 22-20 22-20-22z" fill="none" stroke="#f5c542" stroke-width="1.5" opacity="0.6"/>
      <text x="32" y="37.5" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="13" fill="#ffe08a">WILD</text>
    </svg>`,
  S: `
    <svg viewBox="0 0 64 64" fill="none">
      <g opacity="0.85">
        <path d="M32 2v8M32 54v8M2 32h8M54 32h8M11 11l6 6M47 47l6 6M53 11l-6 6M17 47l-6 6" stroke="#f5c542" stroke-width="3" stroke-linecap="round"/>
      </g>
      <circle cx="32" cy="32" r="20" fill="#f0b429" stroke="#c98d0a" stroke-width="2"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#ffe08a" stroke-width="1.5"/>
      <rect x="26" y="26" width="12" height="12" fill="#8a5f05"/>
      <rect x="27.5" y="27.5" width="9" height="9" fill="#1a1626"/>
    </svg>`,
  M1: `
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M8 40c0-6 8-16 24-16s24 10 24 16-4 10-8 10H16c-4 0-8-4-8-10z" fill="#f0b429"/>
      <ellipse cx="32" cy="30" rx="13" ry="8" fill="#ffd873"/>
      <path d="M8 40c4-2 12-4 24-4s20 2 24 4c0 3-4 10-8 10H16c-4 0-8-7-8-10z" fill="#d19314"/>
      <ellipse cx="32" cy="27" rx="6" ry="3" fill="#fff0c2" opacity="0.8"/>
    </svg>`,
  M2: `
    <svg viewBox="0 0 64 64" fill="none">
      <rect x="16" y="8" width="32" height="48" rx="4" fill="#c41e2f"/>
      <path d="M16 12a4 4 0 014-4h24a4 4 0 014 4l-16 14z" fill="#e5384c"/>
      <circle cx="32" cy="30" r="9" fill="#f5c542"/>
      <circle cx="32" cy="30" r="6.5" fill="none" stroke="#b3121f" stroke-width="1.5"/>
      <path d="M28 30h8M32 26v8" stroke="#b3121f" stroke-width="1.5"/>
      <rect x="22" y="46" width="20" height="2.5" rx="1" fill="#f5c542" opacity="0.7"/>
    </svg>`,
  M3: `
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M30 6c4 2 8 0 10 4" stroke="#f5c542" stroke-width="2.5" stroke-linecap="round"/>
      <rect x="14" y="16" width="14" height="34" rx="4" fill="#c41e2f"/>
      <rect x="14" y="16" width="14" height="6" rx="3" fill="#f5c542"/>
      <rect x="14" y="44" width="14" height="6" rx="3" fill="#f5c542"/>
      <rect x="17" y="26" width="8" height="2" fill="#e5384c"/>
      <rect x="36" y="22" width="14" height="34" rx="4" fill="#e5384c"/>
      <rect x="36" y="22" width="14" height="6" rx="3" fill="#f5c542"/>
      <rect x="36" y="50" width="14" height="6" rx="3" fill="#f5c542"/>
      <rect x="39" y="32" width="8" height="2" fill="#c41e2f"/>
      <circle cx="41" cy="10" r="3" fill="#ffd873"/>
    </svg>`,
  M4: `
    <svg viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="22" fill="#2e9e6b"/>
      <circle cx="32" cy="32" r="22" fill="none" stroke="#1d7a4e" stroke-width="2"/>
      <circle cx="32" cy="32" r="8" fill="#14111e"/>
      <circle cx="32" cy="32" r="8" fill="none" stroke="#1d7a4e" stroke-width="2"/>
      <path d="M18 20a20 20 0 0126 -2" stroke="#7fd6ab" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
    </svg>`,
  A: gem("#c41e2f", "#e5384c", "A"),
  K: gem("#b07a0a", "#f0b429", "K"),
  Q: gem("#6b3fa0", "#9b6fd0", "Q"),
  J: gem("#1f6fb0", "#43a3e8", "J"),
};

function gem(dark, light, letter) {
  return `
    <svg viewBox="0 0 64 64" fill="none">
      <path d="M32 6l22 14v24L32 58 10 44V20z" fill="${dark}"/>
      <path d="M32 6l22 14-22 10-22-10z" fill="${light}" opacity="0.55"/>
      <text x="32" y="42" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="26" fill="#ffffff">${letter}</text>
    </svg>`;
}

const FORTUNE_NAME = {
  W: "Wild",
  S: "Fortune Coin",
  M1: "Gold Ingot",
  M2: "Red Envelope",
  M3: "Firecrackers",
  M4: "Jade Ring",
  A: "Ace", K: "King", Q: "Queen", J: "Jack",
};
