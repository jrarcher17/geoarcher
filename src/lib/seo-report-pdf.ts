import { jsPDF } from "jspdf";
import {
  AMBER,
  CONTENT_W,
  FAINT,
  GREEN,
  MARGIN,
  MUTED,
  NAVY,
  PANEL,
  ROSE,
  SKY,
  SLATE,
  type JsPDFDoc,
  type RGB,
  drawChip,
  drawFooters,
  drawGauge,
  drawHeaderBand,
  drawLineChart,
  drawScoreBar,
  ensureSpace,
  sectionHeading,
  setText,
  wrapText,
} from "@/lib/pdf-kit";
import type { SeoOverviewDto } from "@/lib/seo/types";
import { gradeFor, hostOf } from "@/lib/utils";

function drawKpis(doc: JsPDFDoc, y: number, overview: SeoOverviewDto): number {
  const audit = overview.audit!;
  const kpis: { value: number; label: string; sub: string; note: string }[] = [];
  if (audit.overallScore != null) {
    kpis.push({
      value: audit.overallScore,
      label: `${audit.overallScore}`,
      sub: `Grade ${gradeFor(audit.overallScore)}`,
      note: "SEO Score",
    });
  }
  if (overview.geoOverall != null) {
    kpis.push({
      value: overview.geoOverall,
      label: `${overview.geoOverall}`,
      sub: `Grade ${gradeFor(overview.geoOverall)}`,
      note: "GEO Score",
    });
  }
  if (audit.overallScore != null && overview.geoOverall != null) {
    const combined = Math.round((audit.overallScore + overview.geoOverall) / 2);
    kpis.push({
      value: combined,
      label: `${combined}`,
      sub: "SEO + GEO",
      note: "Combined Visibility",
    });
  }
  if (kpis.length === 0) return y;

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

function drawCategories(doc: JsPDFDoc, y: number, overview: SeoOverviewDto): number {
  const categories = overview.audit?.categories ?? [];
  if (categories.length === 0) return y;
  y = sectionHeading(doc, y, "SEO category scores");
  for (const c of categories) {
    y = drawScoreBar(doc, y, c.label, c.score);
  }

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

function drawTrend(doc: JsPDFDoc, y: number, overview: SeoOverviewDto): number {
  const points = overview.history.map((h) => ({ date: h.date, value: h.overall }));
  if (points.length < 2) return y;
  y = sectionHeading(doc, y, "SEO score trend");
  return drawLineChart(doc, y, points);
}

function drawIssues(doc: JsPDFDoc, y: number, overview: SeoOverviewDto): number {
  const audit = overview.audit!;
  const failing = (audit.siteChecks ?? []).filter((c) => c.status !== "pass");
  if (failing.length === 0) return y;

  y = sectionHeading(doc, y, "Site-wide findings");

  const totals = audit.totals;
  if (totals) {
    y = ensureSpace(doc, y, 20);
    setText(doc, 9, SLATE);
    doc.text(
      `Across ${audit.pagesCrawled} pages: ${totals.critical} critical - ${totals.warning} warnings - ${totals.info} notices`,
      MARGIN,
      y
    );
    y += 20;
  }

  for (const check of failing.slice(0, 14)) {
    const innerW = CONTENT_W - 40;
    const titleLines = wrapText(doc, check.label, 10, innerW);
    const detailLines = wrapText(doc, check.detail, 8.5, innerW);
    const blockH = titleLines.length * 13 + detailLines.length * 11 + 16;
    y = ensureSpace(doc, y, blockH);

    const color = check.status === "fail" ? ROSE : AMBER;
    doc.setFillColor(...color);
    doc.circle(MARGIN + 5, y + 4, 3, "F");

    let ty = y + 8;
    setText(doc, 10, NAVY, true);
    for (const line of titleLines) {
      doc.text(line, MARGIN + 18, ty);
      ty += 13;
    }
    setText(doc, 8.5, SLATE);
    for (const line of detailLines) {
      doc.text(line, MARGIN + 18, ty);
      ty += 11;
    }
    y += blockH;
  }
  return y + 10;
}

function drawOpportunities(doc: JsPDFDoc, y: number, overview: SeoOverviewDto): number {
  const opps = overview.opportunities
    .filter((o) => o.status !== "DISMISSED" && o.status !== "COMPLETED")
    .slice(0, 8);
  if (opps.length === 0) return y;

  y = sectionHeading(doc, y, "Top opportunities");

  opps.forEach((o, i) => {
    const innerW = CONTENT_W - 58;
    const titleLines = wrapText(doc, o.title, 10.5, innerW);
    const descLines = wrapText(doc, o.description, 8.5, innerW);
    const cardH = 16 + titleLines.length * 13 + 6 + 15 + descLines.length * 11 + 10;
    y = ensureSpace(doc, y, cardH + 10);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...FAINT);
    doc.setLineWidth(0.75);
    doc.roundedRect(MARGIN, y, CONTENT_W, cardH, 6, 6, "FD");
    const impactColor =
      o.impact === "high" ? GREEN : o.impact === "medium" ? AMBER : MUTED;
    doc.setFillColor(...impactColor);
    doc.rect(MARGIN, y + 6, 3, cardH - 12, "F");

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
    cx += drawChip(doc, cx, ty - 9, `SCORE ${o.opportunityScore}`, SKY) + 6;
    cx += drawChip(doc, cx, ty - 9, `${o.impact.toUpperCase()} IMPACT`, impactColor) + 6;
    drawChip(doc, cx, ty - 9, `${o.difficulty.toUpperCase()} DIFFICULTY`, SLATE);
    ty += 15;

    setText(doc, 8.5, SLATE);
    for (const line of descLines) {
      doc.text(line, tx, ty);
      ty += 11;
    }
    y += cardH + 10;
  });

  return y + 14;
}

/** Builds the stakeholder SEO Autopilot report for one site. */
export function buildSeoReportPdf(overview: SeoOverviewDto): JsPDFDoc {
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  const date = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const pages = overview.audit?.pagesCrawled;
  let y = drawHeaderBand(
    doc,
    "SEO Autopilot Report",
    hostOf(overview.siteUrl),
    `${overview.siteUrl}  ·  Generated ${date}${pages ? `  ·  ${pages} pages audited` : ""}`
  );
  y = drawKpis(doc, y, overview);
  y = drawCategories(doc, y, overview);
  y = drawTrend(doc, y, overview);
  y = drawIssues(doc, y, overview);
  drawOpportunities(doc, y, overview);
  drawFooters(doc, `GEO Archer · ${hostOf(overview.siteUrl)}`);

  return doc;
}

export function downloadSeoReportPdf(overview: SeoOverviewDto): void {
  const doc = buildSeoReportPdf(overview);
  const filename = `seo-autopilot-report-${hostOf(overview.siteUrl).replace(/\./g, "-")}.pdf`;
  doc.save(filename);
}
