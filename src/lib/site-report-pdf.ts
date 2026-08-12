import { jsPDF } from "jspdf";
import type { SiteInsight } from "@/lib/useInsights";
import { estimatedGain, gradeFor, hostOf } from "@/lib/utils";

type JsPDFDoc = jsPDF;
type RGB = [number, number, number];

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 44;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_ZONE = 46;

// Palette (matches the app's sky/slate theme)
const NAVY: RGB = [15, 23, 42]; // slate-900
const SLATE: RGB = [71, 85, 105]; // slate-600
const MUTED: RGB = [148, 163, 184]; // slate-400
const FAINT: RGB = [226, 232, 240]; // slate-200
const PANEL: RGB = [248, 250, 252]; // slate-50
const SKY: RGB = [14, 165, 233]; // sky-500
const GREEN: RGB = [16, 185, 129]; // emerald-500
const AMBER: RGB = [245, 158, 11]; // amber-500
const ROSE: RGB = [244, 63, 94]; // rose-500

function scoreColor(score: number): RGB {
  if (score >= 80) return GREEN;
  if (score >= 60) return AMBER;
  return ROSE;
}

function ensureSpace(doc: JsPDFDoc, y: number, need: number): number {
  if (y + need > PAGE_H - FOOTER_ZONE) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function setText(doc: JsPDFDoc, size: number, color: RGB, bold = false): void {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

/** jsPDF's built-in Helvetica is Latin-1 only; smart punctuation in AI text
 *  renders as garbled, widely spaced glyphs. Map it to ASCII equivalents. */
function clean(text: string): string {
  return text
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "");
}

function wrapText(
  doc: JsPDFDoc,
  text: string,
  size: number,
  maxWidth: number
): string[] {
  doc.setFontSize(size);
  return doc.splitTextToSize(clean(text), maxWidth) as string[];
}

/** Thick round-capped arc approximated with short segments (for gauges). */
function drawArc(
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
function drawGauge(
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
function drawChip(
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

function sectionHeading(doc: JsPDFDoc, y: number, title: string): number {
  y = ensureSpace(doc, y, 40);
  doc.setFillColor(...SKY);
  doc.rect(MARGIN, y, 3, 14, "F");
  setText(doc, 13, NAVY, true);
  doc.text(title, MARGIN + 10, y + 11);
  return y + 28;
}

// ---- Header band ----

function drawHeader(doc: JsPDFDoc, site: SiteInsight): number {
  const H = 128;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, H, "F");
  // Accent line along the bottom of the band
  doc.setFillColor(...SKY);
  doc.rect(0, H - 3, PAGE_W, 3, "F");

  setText(doc, 20, SKY, true);
  doc.text("GEO", MARGIN, 44);
  doc.setTextColor(255, 255, 255);
  doc.text(" Archer", MARGIN + doc.getTextWidth("GEO"), 44);

  setText(doc, 26, [255, 255, 255], true);
  doc.text("AI Visibility Report", MARGIN, 78);

  setText(doc, 12, [186, 230, 253]); // sky-200
  doc.text(hostOf(site.url), MARGIN, 98);
  setText(doc, 8.5, MUTED);
  const date = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const pages = site.latestScan?.pagesCrawled;
  doc.text(
    `${site.url}  ·  Generated ${date}${pages ? `  ·  ${pages} pages analyzed` : ""}`,
    MARGIN,
    112
  );
  return H + 26;
}

// ---- KPI gauges row ----

function drawKpiRow(doc: JsPDFDoc, y: number, site: SiteInsight): number {
  const a = site.analysis!;
  const kpis: { value: number; label: string; sub: string; note: string }[] = [
    {
      value: a.geoOverall,
      label: `${a.geoOverall}`,
      sub: `Grade ${gradeFor(a.geoOverall)}`,
      note: "GEO Score",
    },
    {
      value: a.understanding,
      label: `${a.understanding}`,
      sub: "/100",
      note: "AI Understanding",
    },
  ];
  if (site.visibility) {
    kpis.push({
      value: site.visibility.overall,
      label: `${site.visibility.overall}%`,
      sub: "overall",
      note: "AI Visibility",
    });
  }

  const gap = 14;
  const cardW = (CONTENT_W - gap * (kpis.length - 1)) / kpis.length;
  const cardH = 108;
  y = ensureSpace(doc, y, cardH);

  kpis.forEach((k, i) => {
    const x = MARGIN + i * (cardW + gap);
    doc.setFillColor(...PANEL);
    doc.setDrawColor(...FAINT);
    doc.setLineWidth(0.75);
    doc.roundedRect(x, y, cardW, cardH, 6, 6, "FD");
    drawGauge(doc, x + cardW / 2, y + 46, 28, k.value, k.label, k.sub);
    setText(doc, 9, SLATE, true);
    doc.text(k.note, x + cardW / 2, y + cardH - 14, { align: "center" });
  });

  return y + cardH + 24;
}

// ---- Executive summary ----

function drawSummary(doc: JsPDFDoc, y: number, site: SiteInsight): number {
  const a = site.analysis!;
  y = sectionHeading(doc, y, "Executive summary");
  const lines = wrapText(doc, a.businessSummary, 10, CONTENT_W - 28);
  const boxH = lines.length * 14 + 24;
  y = ensureSpace(doc, y, boxH);
  doc.setFillColor(...PANEL);
  doc.setDrawColor(...FAINT);
  doc.setLineWidth(0.75);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 6, 6, "FD");
  setText(doc, 10, SLATE);
  let ty = y + 18;
  for (const line of lines) {
    doc.text(line, MARGIN + 14, ty);
    ty += 14;
  }
  return y + boxH + 24;
}

// ---- Component score bar chart ----

function drawComponentChart(doc: JsPDFDoc, y: number, site: SiteInsight): number {
  const components = site.analysis!.components;
  if (components.length === 0) return y;

  const rowH = 21;
  const labelW = 128;
  const valueW = 34;
  const barMaxW = CONTENT_W - labelW - valueW;
  const chartH = components.length * rowH + 8;

  // Keep the heading with at least a few bars
  y = ensureSpace(doc, y, 40 + Math.min(chartH, rowH * 4));
  y = sectionHeading(doc, y, "GEO component scores");

  for (const c of components) {
    y = ensureSpace(doc, y, rowH);
    const barY = y + 4;
    setText(doc, 8.5, SLATE);
    doc.text(c.name, MARGIN, barY + 8);
    // Track
    doc.setFillColor(...FAINT);
    doc.roundedRect(MARGIN + labelW, barY, barMaxW, 10, 5, 5, "F");
    // Fill (min width so tiny scores still render as a dot)
    const w = Math.max(10, (barMaxW * Math.max(0, Math.min(100, c.score))) / 100);
    doc.setFillColor(...scoreColor(c.score));
    doc.roundedRect(MARGIN + labelW, barY, w, 10, 5, 5, "F");
    setText(doc, 8.5, NAVY, true);
    doc.text(`${c.score}`, MARGIN + labelW + barMaxW + valueW, barY + 8, {
      align: "right",
    });
    y += rowH;
  }

  // Legend
  y += 6;
  let lx = MARGIN;
  const legend: { label: string; color: RGB }[] = [
    { label: "Strong (80+)", color: GREEN },
    { label: "Needs work (60-79)", color: AMBER },
    { label: "Critical (<60)", color: ROSE },
  ];
  for (const item of legend) {
    doc.setFillColor(...item.color);
    doc.circle(lx + 3, y + 3, 3, "F");
    setText(doc, 7.5, MUTED);
    doc.text(item.label, lx + 10, y + 6);
    lx += doc.getTextWidth(item.label) + 34;
  }
  return y + 26;
}

// ---- Score trend line chart ----

function drawTrendChart(doc: JsPDFDoc, y: number, site: SiteInsight): number {
  const points = site.history.filter((h) => h.geo != null);
  if (points.length < 2) return y;

  const chartH = 130;
  const axisW = 26;
  y = ensureSpace(doc, y, 40 + chartH + 30);
  y = sectionHeading(doc, y, "GEO score trend");

  const plotX = MARGIN + axisW;
  const plotW = CONTENT_W - axisW;
  const plotY = y;

  // Gridlines + y-axis labels at 0/25/50/75/100
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
    y: plotY + chartH - (chartH * (p.geo as number)) / 100,
    label: new Date(p.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    value: p.geo as number,
  }));

  // Line
  doc.setDrawColor(...SKY);
  doc.setLineWidth(2);
  doc.setLineCap("round");
  for (let i = 1; i < coords.length; i++) {
    doc.line(coords[i - 1].x, coords[i - 1].y, coords[i].x, coords[i].y);
  }
  doc.setLineCap("butt");

  // Points + value labels
  for (const c of coords) {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...SKY);
    doc.setLineWidth(1.5);
    doc.circle(c.x, c.y, 3.5, "FD");
    setText(doc, 7.5, NAVY, true);
    doc.text(`${c.value}`, c.x, c.y - 8, { align: "center" });
  }

  // X-axis labels (thin out if crowded)
  const every = Math.max(1, Math.ceil(coords.length / 8));
  setText(doc, 7, MUTED);
  coords.forEach((c, i) => {
    if (i % every === 0 || i === coords.length - 1) {
      doc.text(c.label, c.x, plotY + chartH + 14, { align: "center" });
    }
  });

  return plotY + chartH + 34;
}

// ---- Assistant visibility bars ----

function drawVisibilityChart(doc: JsPDFDoc, y: number, site: SiteInsight): number {
  const assistants = site.visibility?.assistants ?? [];
  if (assistants.length === 0) return y;

  const rowH = 24;
  y = ensureSpace(doc, y, 40 + rowH * Math.min(assistants.length, 3));
  y = sectionHeading(doc, y, "Visibility by AI assistant");

  const labelW = 90;
  const valueW = 40;
  const barMaxW = CONTENT_W - labelW - valueW;
  for (const a of assistants) {
    y = ensureSpace(doc, y, rowH);
    const barY = y + 4;
    setText(doc, 9, NAVY, true);
    doc.text(a.assistant, MARGIN, barY + 9);
    doc.setFillColor(...FAINT);
    doc.roundedRect(MARGIN + labelW, barY, barMaxW, 12, 6, 6, "F");
    const w = Math.max(12, (barMaxW * Math.max(0, Math.min(100, a.score))) / 100);
    doc.setFillColor(...scoreColor(a.score));
    doc.roundedRect(MARGIN + labelW, barY, w, 12, 6, 6, "F");
    setText(doc, 9, NAVY, true);
    doc.text(`${a.score}%`, MARGIN + labelW + barMaxW + valueW, barY + 9, {
      align: "right",
    });
    y += rowH;
  }
  return y + 20;
}

// ---- Recommendations ----

function drawRecommendations(doc: JsPDFDoc, y: number, site: SiteInsight): number {
  const recs = site.analysis!.recommendations.slice(0, 8);
  if (recs.length === 0) return y;

  y = sectionHeading(doc, y, "Top recommendations");

  recs.forEach((r, i) => {
    const innerW = CONTENT_W - 58;
    const titleLines = wrapText(doc, r.title, 10.5, innerW);
    const whyLines = wrapText(doc, r.why, 8.5, innerW);
    const cardH = 16 + titleLines.length * 13 + 6 + 15 + whyLines.length * 11 + 10;
    y = ensureSpace(doc, y, cardH + 10);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...FAINT);
    doc.setLineWidth(0.75);
    doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 6, 6, "FD");
    // Impact-colored spine
    const impactColor =
      r.impact === "high" ? GREEN : r.impact === "medium" ? AMBER : MUTED;
    doc.setFillColor(...impactColor);
    doc.rect(MARGIN, y + 6, 3, cardH - 12, "F");

    // Number badge
    doc.setFillColor(...NAVY);
    doc.circle(MARGIN + 24, y + 22, 9, "F");
    setText(doc, 9, [255, 255, 255], true);
    doc.text(`${i + 1}`, MARGIN + 24, y + 25, { align: "center" });

    const tx = MARGIN + 42;
    let ty = y + 18;
    setText(doc, 10.5, NAVY, true);
    for (const line of titleLines) {
      doc.text(line, tx, ty);
      ty += 13;
    }

    ty += 2;
    let cx = tx;
    cx += drawChip(doc, cx, ty - 9, `${r.impact.toUpperCase()} IMPACT`, impactColor) + 6;
    cx += drawChip(doc, cx, ty - 9, `${r.effort.toUpperCase()} EFFORT`, SLATE) + 6;
    drawChip(doc, cx, ty - 9, `EST. ${estimatedGain(r.impact)}`, SKY);
    ty += 15;

    setText(doc, 8.5, SLATE);
    for (const line of whyLines) {
      doc.text(line, tx, ty);
      ty += 11;
    }
    y += cardH + 10;
  });

  return y + 14;
}

// ---- Content opportunities ----

function drawOpportunities(doc: JsPDFDoc, y: number, site: SiteInsight): number {
  const gaps = site.analysis!.contentGaps;
  y = sectionHeading(doc, y, "Content opportunities");

  if (gaps.length === 0) {
    y = ensureSpace(doc, y, 18);
    setText(doc, 9.5, SLATE);
    doc.text("No content gaps identified in the latest scan.", MARGIN, y);
    return y + 24;
  }

  for (const g of gaps) {
    const innerW = CONTENT_W - 40;
    const qLines = wrapText(doc, `"${g.question}"`, 10, innerW);
    const wLines = wrapText(doc, g.whyItMatters, 8.5, innerW);
    const blockH = qLines.length * 13 + wLines.length * 11 + 18;
    y = ensureSpace(doc, y, blockH);

    doc.setFillColor(...SKY);
    doc.circle(MARGIN + 5, y + 4, 3, "F");
    let ty = y + 8;
    setText(doc, 10, NAVY, true);
    for (const line of qLines) {
      doc.text(line, MARGIN + 18, ty);
      ty += 13;
    }
    setText(doc, 8.5, SLATE);
    for (const line of wLines) {
      doc.text(line, MARGIN + 18, ty);
      ty += 11;
    }
    y += blockH;
  }
  return y + 10;
}

// ---- Footer on every page ----

function drawFooters(doc: JsPDFDoc, site: SiteInsight): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...FAINT);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 34, PAGE_W - MARGIN, PAGE_H - 34);
    setText(doc, 7.5, MUTED);
    doc.text(`GEO Archer · ${hostOf(site.url)}`, MARGIN, PAGE_H - 22);
    doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - 22, {
      align: "right",
    });
  }
}

/** Builds a stakeholder PDF for one site. */
export function buildSiteReportPdf(site: SiteInsight): JsPDFDoc {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  let y = drawHeader(doc, site);
  y = drawKpiRow(doc, y, site);
  y = drawSummary(doc, y, site);
  y = drawComponentChart(doc, y, site);
  y = drawTrendChart(doc, y, site);
  y = drawVisibilityChart(doc, y, site);
  y = drawRecommendations(doc, y, site);
  drawOpportunities(doc, y, site);
  drawFooters(doc, site);

  return doc;
}

export function downloadSiteReportPdf(site: SiteInsight): void {
  const doc = buildSiteReportPdf(site);
  const filename = `geo-archer-report-${hostOf(site.url).replace(/\./g, "-")}.pdf`;
  doc.save(filename);
}
