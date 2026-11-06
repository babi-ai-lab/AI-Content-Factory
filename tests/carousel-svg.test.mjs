import test from "node:test";
import assert from "node:assert/strict";
import { buildCarouselSlideSvg } from "../lib/carousel-svg.mjs";

test("creates a self-contained SVG with editable RTL text and an embedded image", () => {
  const svg = buildCarouselSlideSvg({
    imageDataUrl: "data:image/png;base64,AA==",
    lines: ["عنوان <ویژه> & متن", "خط دوم"],
    slideNumber: 1,
    totalSlides: 5,
  });

  assert.match(svg, /<svg[^>]+width="1080" height="1350"/);
  assert.match(svg, /href="data:image\/png;base64,AA=="/);
  assert.match(svg, /direction="rtl"/);
  assert.match(svg, /عنوان &lt;ویژه&gt; &amp; متن/);
  assert.match(svg, /اسلاید ۱ از ۵/);
  assert.doesNotMatch(svg, /<script/i);
});

test("rejects external image URLs and invalid slide numbers", () => {
  assert.throws(() => buildCarouselSlideSvg({
    imageDataUrl: "https://example.com/image.png",
    lines: [],
    slideNumber: 1,
  }), /embedded raster image/);
  assert.throws(() => buildCarouselSlideSvg({
    imageDataUrl: "data:image/png;base64,AA==",
    lines: [],
    slideNumber: 0,
  }), /positive integers/);
});
