import sharp from "sharp";

export type LocalVisualFormat = "social" | "story" | "email" | "rcu";

const dimensions: Record<LocalVisualFormat, { width: number; height: number }> = {
  social: { width: 1024, height: 1024 },
  story: { width: 1024, height: 1536 },
  email: { width: 1536, height: 1024 },
  rcu: { width: 1024, height: 1536 }
};

function safeHex(value: string | null | undefined, fallback: string) {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value! : fallback;
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getLocalVisualDimensions(format: LocalVisualFormat) {
  return dimensions[format];
}

export async function createBrandedLocalVisualFallback({
  format,
  primaryColor,
  secondaryColor,
  accentColor,
  seed
}: {
  format: LocalVisualFormat;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  seed: string;
}) {
  const { width, height } = dimensions[format];
  const primary = safeHex(primaryColor, "#4C1D95");
  const secondary = safeHex(secondaryColor, "#F3E8FF");
  const accent = safeHex(accentColor, "#A855F7");
  const hash = hashText(seed);
  const firstX = 18 + hash % 55;
  const firstY = 12 + Math.floor(hash / 7) % 55;
  const secondX = 20 + Math.floor(hash / 13) % 62;
  const secondY = 24 + Math.floor(hash / 19) % 58;
  const rotation = -18 + hash % 37;
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${secondary}"/>
          <stop offset="0.58" stop-color="${primary}"/>
          <stop offset="1" stop-color="${accent}"/>
        </linearGradient>
        <radialGradient id="glow">
          <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.78"/>
          <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
        </radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="${Math.round(width * 0.055)}"/></filter>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="${hash % 97}"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer><feFuncA type="table" tableValues="0 0.075"/></feComponentTransfer>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#background)"/>
      <ellipse cx="${firstX}%" cy="${firstY}%" rx="42%" ry="34%" fill="url(#glow)" filter="url(#blur)"/>
      <ellipse cx="${secondX}%" cy="${secondY}%" rx="31%" ry="42%" fill="${accent}" fill-opacity="0.34" filter="url(#blur)"/>
      <g transform="rotate(${rotation} ${width / 2} ${height / 2})" fill="none" stroke="#FFFFFF" stroke-opacity="0.2">
        <rect x="${width * 0.12}" y="${height * 0.18}" width="${width * 0.76}" height="${height * 0.64}" rx="${width * 0.18}" stroke-width="${Math.max(3, width * 0.006)}"/>
        <rect x="${width * 0.21}" y="${height * 0.26}" width="${width * 0.58}" height="${height * 0.48}" rx="${width * 0.14}" stroke-width="${Math.max(2, width * 0.003)}"/>
      </g>
      <path d="M0 ${height * 0.72} C ${width * 0.24} ${height * 0.58}, ${width * 0.62} ${height * 0.92}, ${width} ${height * 0.66} L ${width} ${height} L 0 ${height} Z" fill="${primary}" fill-opacity="0.28"/>
      <rect width="${width}" height="${height}" filter="url(#grain)" opacity="0.72"/>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function prepareFallbackPhoto({
  input,
  format,
  primaryColor,
  accentColor
}: {
  input: Buffer;
  format: LocalVisualFormat;
  primaryColor?: string | null;
  accentColor?: string | null;
}) {
  const { width, height } = dimensions[format];
  const primary = safeHex(primaryColor, "#4C1D95");
  const accent = safeHex(accentColor, "#A855F7");
  const wash = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${primary}" stop-opacity="0.15"/>
          <stop offset="0.55" stop-color="${primary}" stop-opacity="0"/>
          <stop offset="1" stop-color="${accent}" stop-opacity="0.12"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#wash)"/>
    </svg>
  `);

  return sharp(input)
    .rotate()
    .resize(width, height, { fit: "cover", position: "attention" })
    .composite([{ input: wash, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
