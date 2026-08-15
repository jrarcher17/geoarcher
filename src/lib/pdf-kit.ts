import type { jsPDF } from "jspdf";

/** Shared jsPDF drawing primitives for GEO Archer's branded reports. */

export type JsPDFDoc = jsPDF;
export type RGB = [number, number, number];

export const PAGE_W = 612;
export const PAGE_H = 792;
export const MARGIN = 44;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const FOOTER_ZONE = 46;

// Palette (matches the app's sky/slate theme)
export const NAVY: RGB = [15, 23, 42]; // slate-900
export const SLATE: RGB = [71, 85, 105]; // slate-600
export const MUTED: RGB = [148, 163, 184]; // slate-400
export const FAINT: RGB = [226, 232, 240]; // slate-200
export const PANEL: RGB = [248, 250, 252]; // slate-50
export const SKY: RGB = [14, 165, 233]; // sky-500
export const GREEN: RGB = [16, 185, 129]; // emerald-500
export const AMBER: RGB = [245, 158, 11]; // amber-500
export const ROSE: RGB = [244, 63, 94]; // rose-500

export function scoreColor(score: number): RGB {
  if (score >= 80) return GREEN;
  if (score >= 60) return AMBER;
  return ROSE;
}

export function ensureSpace(doc: JsPDFDoc, y: number, need: number): number {
  if (y + need > PAGE_H - FOOTER_ZONE) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

export function setText(
  doc: JsPDFDoc,
  size: number,
  color: RGB,
  bold = false
): void {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

/** jsPDF's built-in Helvetica is Latin-1 only; smart punctuation in AI text
 *  renders as garbled, widely spaced glyphs. Map it to ASCII equivalents. */
export function clean(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "");
}

export function wrapText(
  doc: JsPDFDoc,
  text: string,
  size: number,
  maxWidth: number
): string[] {
  doc.setFontSize(size);
  return doc.splitTextToSize(clean(text), maxWidth) as string[];
}

/** Thick round-capped arc approximated with short segments (for gauges). */
export function drawArc(
  doc: JsPDFDoc,
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  color: RGB,
  width: number
): void {
  const steps = Math.max(2, Math.ceil(Math.abs(endDeg - startDeg) / 5));
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.setLineCap("round");
  let prevX = cx + r * Math.cos((startDeg * Math.PI) / 180);
  let prevY = cy + r * Math.sin((startDeg * Math.PI) / 180);
  for (let i = 1; i <= steps; i++) {
    const a = ((startDeg + ((endDeg - startDeg) * i) / steps) * Math.PI) / 180;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    doc.line(prevX, prevY, x, y);
    prevX = x;
    prevY = y;
  }
  doc.setLineCap("butt");
}

/** Donut gauge with the value centered inside. */
export function drawGauge(
  doc: JsPDFDoc,
  cx: number,
  cy: number,
  r: number,
  value: number,
  valueLabel: string,
  subLabel: string
): void {
  drawArc(doc, cx, cy, r, -90, 270, FAINT, 7);
  const pct = Math.max(0, Math.min(100, value));
  if (pct > 0) {
    drawArc(doc, cx, cy, r, -90, -90 + (360 * pct) / 100, scoreColor(pct), 7);
  }
  setText(doc, 19, NAVY, true);
  doc.text(valueLabel, cx, cy + 2, { align: "center" });
  setText(doc, 7, MUTED);
  doc.text(subLabel, cx, cy + 12, { align: "center" });
}

/** Small pill-shaped label chip, returns its width. */
export function drawChip(
  doc: JsPDFDoc,
  x: number,
  y: number,
  label: string,
  color: RGB
): number {
  label = clean(label);
  setText(doc, 7, color, true);
  const w = doc.getTextWidth(label) + 12;
  doc.setFillColor(
    Math.round(color[0] + (255 - color[0]) * 0.88),
    Math.round(color[1] + (255 - color[1]) * 0.88),
    Math.round(color[2] + (255 - color[2]) * 0.88)
  );
  doc.roundedRect(x, y, w, 13, 6.5, 6.5, "F");
  doc.text(label, x + 6, y + 9);
  return w;
}

export function sectionHeading(doc: JsPDFDoc, y: number, title: string): number {
  y = ensureSpace(doc, y, 40);
  doc.setFillColor(...SKY);
  doc.rect(MARGIN, y, 3, 14, "F");
  setText(doc, 13, NAVY, true);
  doc.text(title, MARGIN + 10, y + 11);
  return y + 28;
}

/** Branded dark header band. Returns the y position content should start at. */
export function drawHeaderBand(
  doc: JsPDFDoc,
  title: string,
  host: string,
  metaLine: string
): number {
  const H = 128;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, H, "F");
  doc.setFillColor(...SKY);
  doc.rect(0, H - 3, PAGE_W, 3, "F");

  setText(doc, 20, SKY, true);
  doc.text("GEO", MARGIN, 44);
  doc.setTextColor(255, 255, 255);
  doc.text(" Archer", MARGIN + doc.getTextWidth("GEO"), 44);

  setText(doc, 26, [255, 255, 255], true);
  doc.text(title, MARGIN, 78);

  setText(doc, 12, [186, 230, 253]); // sky-200
  doc.text(host, MARGIN, 98);
  setText(doc, 8.5, MUTED);
  doc.text(metaLine, MARGIN, 112);
  return H + 26;
}

/** Divider + page numbers on every page. */
export function drawFooters(doc: JsPDFDoc, label: string): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...FAINT);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 34, PAGE_W - MARGIN, PAGE_H - 34);
    setText(doc, 7.5, MUTED);
    doc.text(label, MARGIN, PAGE_H - 22);
    doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - 22, {
      align: "right",
    });
  }
}

/** Horizontal score bar row (label · track · value). Returns new y. */
export function drawScoreBar(
  doc: JsPDFDoc,
  y: number,
  label: string,
  score: number,
  labelW = 128
): number {
  const rowH = 21;
  const valueW = 34;
  const barMaxW = CONTENT_W - labelW - valueW;
  y = ensureSpace(doc, y, rowH);
  const barY = y + 4;
  setText(doc, 8.5, SLATE);
  doc.text(clean(label), MARGIN, barY + 8);
  doc.setFillColor(...FAINT);
  doc.roundedRect(MARGIN + labelW, barY, barMaxW, 10, 5, 5, "F");
  const w = Math.max(10, (barMaxW * Math.max(0, Math.min(100, score))) / 100);
  doc.setFillColor(...scoreColor(score));
  doc.roundedRect(MARGIN + labelW, barY, w, 10, 5, 5, "F");
  setText(doc, 8.5, NAVY, true);
  doc.text(`${score}`, MARGIN + labelW + barMaxW + valueW, barY + 8, {
    align: "right",
  });
  return y + rowH;
}

/** Line chart of 0-100 values over time. Returns new y. */
export function drawLineChart(
  doc: JsPDFDoc,
  y: number,
  points: { date: string; value: number }[]
): number {
  if (points.length < 2) return y;
  const chartH = 130;
  const axisW = 26;
  y = ensureSpace(doc, y, chartH + 30);

  const plotX = MARGIN + axisW;
  const plotW = CONTENT_W - axisW;
  const plotY = y;

  for (let v = 0; v <= 100; v += 25) {
    const gy = plotY + chartH - (chartH * v) / 100;
    doc.setDrawColor(...FAINT);
    doc.setLineWidth(0.5);
    doc.line(plotX, gy, plotX + plotW, gy);
    setText(doc, 7, MUTED);
    doc.text(`${v}`, plotX - 6, gy + 2, { align: "right" });
  }

  const stepX = plotW / (points.length - 1);
  const coords = points.map((p, i) => ({
    x: plotX + i * stepX,
    y: plotY + chartH - (chartH * p.value) / 100,
    label: new Date(p.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    value: p.value,
  }));

  doc.setDrawColor(...SKY);
  doc.setLineWidth(2);
  doc.setLineCap("round");
  for (let i = 1; i < coords.length; i++) {
    doc.line(coords[i - 1].x, coords[i - 1].y, coords[i].x, coords[i].y);
  }
  doc.setLineCap("butt");

  for (const c of coords) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...SKY);
    doc.setLineWidth(1.5);
    doc.circle(c.x, c.y, 3.5, "FD");
    setText(doc, 7.5, NAVY, true);
    doc.text(`${c.value}`, c.x, c.y - 8, { align: "center" });
  }

  const every = Math.max(1, Math.ceil(coords.length / 8));
  setText(doc, 7, MUTED);
  coords.forEach((c, i) => {
    if (i % every === 0 || i === coords.length - 1) {
      doc.text(c.label, c.x, plotY + chartH + 14, { align: "center" });
    }
  });

  return plotY + chartH + 34;
}
