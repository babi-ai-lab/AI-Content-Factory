function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildCarouselSlideSvg({ imageDataUrl, lines, slideNumber, totalSlides = 5 }) {
  if (typeof imageDataUrl !== "string" || !/^data:image\/(?:png|jpe?g|webp|avif);base64,/i.test(imageDataUrl)) {
    throw new TypeError("Carousel SVG requires an embedded raster image data URL.");
  }
  if (!Array.isArray(lines)) throw new TypeError("Carousel SVG text lines must be an array.");
  if (!Number.isInteger(slideNumber) || slideNumber < 1 || !Number.isInteger(totalSlides) || totalSlides < 1) {
    throw new RangeError("Carousel slide numbers must be positive integers.");
  }

  const safeLines = lines.slice(0, 7).map((line) => String(line ?? ""));
  const startY = Math.max(780, 1270 - safeLines.length * 62);
  const textElements = safeLines.map((line, index) => (
    `<text x="960" y="${startY + index * 62}">${escapeXml(line)}</text>`
  )).join("");

  const title = `اسلاید ${slideNumber.toLocaleString("fa-IR")} از ${totalSlides.toLocaleString("fa-IR")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <defs>
    <linearGradient id="overlay" x1="0" y1="560" x2="0" y2="1350" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0c142a" stop-opacity="0"/>
      <stop offset="0.35" stop-color="#0c142a" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#0c142a" stop-opacity="0.92"/>
    </linearGradient>
    <filter id="text-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.24"/>
    </filter>
  </defs>
  <image href="${escapeXml(imageDataUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="0" width="1080" height="1350" fill="url(#overlay)"/>
  <g font-family="Vazirmatn, Tahoma, sans-serif" font-size="44" font-weight="700" fill="#ffffff" direction="rtl" unicode-bidi="plaintext" text-anchor="end" filter="url(#text-shadow)">
    ${textElements}
  </g>
  <rect x="120" y="1270" width="90" height="5" fill="#FFD54F"/>
  <text x="960" y="1325" direction="rtl" unicode-bidi="plaintext" text-anchor="end" font-family="Vazirmatn, Tahoma, sans-serif" font-size="25" font-weight="600" fill="#ffffff">${escapeXml(title)}</text>
</svg>`;
}
