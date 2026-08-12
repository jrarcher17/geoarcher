import { jsPDF } from "jspdf";

type JsPDFDoc = jsPDF;
type RGB = [number, number, number];

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_ZONE = 46;

const NAVY: RGB = [15, 23, 42];
const SLATE: RGB = [71, 85, 105];
const MUTED: RGB = [148, 163, 184];
const FAINT: RGB = [226, 232, 240];
const PANEL: RGB = [248, 250, 252];
const SKY: RGB = [14, 165, 233];

/** jsPDF's built-in Helvetica is Latin-1 only — normalize smart punctuation
 *  and strip markdown inline markers (**bold**, *em*, `code`). */
function cleanInline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "")
    .trim();
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

function writeLines(
  doc: JsPDFDoc,
  y: number,
  text: string,
  opts: {
    size: number;
    color: RGB;
    bold?: boolean;
    x?: number;
    width?: number;
    lineH?: number;
  }
): number {
  const x = opts.x ?? MARGIN;
  const width = opts.width ?? PAGE_W - x - MARGIN;
  const lineH = opts.lineH ?? opts.size + 4.5;
  setText(doc, opts.size, opts.color, opts.bold);
  const lines = doc.splitTextToSize(text, width) as string[];
  for (const line of lines) {
    y = ensureSpace(doc, y, lineH);
    doc.text(line, x, y);
    y += lineH;
  }
  return y;
}

// ---- Block parsing ----

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "bullet"; text: string; depth: number }
  | { type: "number"; text: string; index: number }
  | { type: "code"; lines: string[] }
  | { type: "table"; rows: string[][] };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "p", text: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", lines: code });
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length) {
        const rowLine = lines[i].trim();
        if (!(rowLine.startsWith("|") && rowLine.endsWith("|"))) break;
        // Skip the |---|---| separator row
        if (!/^\|[\s:-]+\|$/.test(rowLine.replace(/\|/g, "|"))) {
          const cells = rowLine
            .slice(1, -1)
            .split("|")
            .map((c) => cleanInline(c));
          if (cells.some((c) => c && !/^[-: ]+$/.test(c))) rows.push(cells);
        }
        i++;
      }
      i--;
      if (rows.length > 0) blocks.push({ type: "table", rows });
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      flush();
      const level = h[1].length as 1 | 2 | 3;
      blocks.push({ type: `h${level}` as "h1" | "h2" | "h3", text: cleanInline(h[2]) });
      continue;
    }

    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      const depth = bullet[1].length >= 2 ? 1 : 0;
      blocks.push({ type: "bullet", text: cleanInline(bullet[2]), depth });
      continue;
    }

    const num = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (num) {
      flush();
      blocks.push({
        type: "number",
        text: cleanInline(num[2]),
        index: parseInt(num[1], 10),
      });
      continue;
    }

    if (trimmed === "") {
      flush();
      continue;
    }

    paragraph.push(cleanInline(trimmed));
  }
  flush();
  return blocks;
}

// ---- Block rendering ----

function renderBlocks(doc: JsPDFDoc, y: number, blocks: Block[]): number {
  for (const block of blocks) {
    switch (block.type) {
      case "h1": {
        y = ensureSpace(doc, y, 34);
        y += 8;
        y = writeLines(doc, y, block.text, {
          size: 16,
          color: NAVY,
          bold: true,
          lineH: 20,
        });
        y += 4;
        break;
      }
      case "h2": {
        y = ensureSpace(doc, y, 40);
        y += 12;
        doc.setFillColor(...SKY);
        doc.rect(MARGIN, y - 10, 3, 13, "F");
        y = writeLines(doc, y, block.text, {
          size: 12.5,
          color: NAVY,
          bold: true,
          x: MARGIN + 10,
          lineH: 16,
        });
        y += 2;
        break;
      }
      case "h3": {
        y = ensureSpace(doc, y, 28);
        y += 8;
        y = writeLines(doc, y, block.text, {
          size: 10.5,
          color: NAVY,
          bold: true,
          lineH: 14,
        });
        break;
      }
      case "p": {
        y = writeLines(doc, y, block.text, { size: 9.5, color: SLATE, lineH: 13.5 });
        y += 4;
        break;
      }
      case "bullet": {
        const indent = MARGIN + 14 + block.depth * 14;
        y = ensureSpace(doc, y, 14);
        doc.setFillColor(...(block.depth === 0 ? SKY : MUTED));
        doc.circle(indent - 8, y - 3, 1.8, "F");
        y = writeLines(doc, y, block.text, {
          size: 9.5,
          color: SLATE,
          x: indent,
          lineH: 13.5,
        });
        y += 1;
        break;
      }
      case "number": {
        const indent = MARGIN + 22;
        y = ensureSpace(doc, y, 16);
        doc.setFillColor(...NAVY);
        doc.circle(indent - 12, y - 3, 6.5, "F");
        setText(doc, 7, [255, 255, 255], true);
        doc.text(`${block.index}`, indent - 12, y - 0.7, { align: "center" });
        y = writeLines(doc, y, block.text, {
          size: 9.5,
          color: SLATE,
          x: indent,
          lineH: 13.5,
        });
        y += 3;
        break;
      }
      case "code": {
        const lineH = 11;
        const pad = 10;
        // Render in chunks so long code blocks can break across pages
        let idx = 0;
        while (idx < block.lines.length) {
          const available = PAGE_H - FOOTER_ZONE - y - pad * 2;
          let fit = Math.max(1, Math.floor(available / lineH));
          if (fit < 3 && idx === 0 && block.lines.length > 3) {
            doc.addPage();
            y = MARGIN;
            fit = Math.floor((PAGE_H - FOOTER_ZONE - y - pad * 2) / lineH);
          }
          const chunk = block.lines.slice(idx, idx + fit);
          const boxH = chunk.length * lineH + pad * 2;
          y = ensureSpace(doc, y, Math.min(boxH, PAGE_H - FOOTER_ZONE - MARGIN));
          doc.setFillColor(...NAVY);
          doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 4, 4, "F");
          doc.setFont("courier", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(226, 232, 240);
          let cy = y + pad + 7;
          for (const codeLine of chunk) {
            doc.text(codeLine.slice(0, 110), MARGIN + pad, cy);
            cy += lineH;
          }
          y += boxH + 8;
          idx += fit;
        }
        break;
      }
      case "table": {
        const cols = Math.max(...block.rows.map((r) => r.length));
        const colW = CONTENT_W / cols;
        const cellPad = 6;
        block.rows.forEach((row, rowIdx) => {
          // Row height driven by the tallest wrapped cell
          setText(doc, 8.5, SLATE, rowIdx === 0);
          const wrapped = row.map(
            (cell) => doc.splitTextToSize(cell, colW - cellPad * 2) as string[]
          );
          const rowH = Math.max(...wrapped.map((w) => w.length)) * 11 + cellPad * 2 - 3;
          y = ensureSpace(doc, y, rowH);
          if (rowIdx === 0) {
            doc.setFillColor(...PANEL);
            doc.rect(MARGIN, y - 8, CONTENT_W, rowH, "F");
          }
          doc.setDrawColor(...FAINT);
          doc.setLineWidth(0.5);
          doc.line(MARGIN, y - 8 + rowH, MARGIN + CONTENT_W, y - 8 + rowH);
          setText(doc, 8.5, rowIdx === 0 ? NAVY : SLATE, rowIdx === 0);
          wrapped.forEach((cellLines, c) => {
            let cy = y + cellPad - 8 + 8;
            for (const cl of cellLines) {
              doc.text(cl, MARGIN + c * colW + cellPad, cy);
              cy += 11;
            }
          });
          y += rowH;
        });
        y += 10;
        break;
      }
    }
  }
  return y;
}

// ---- Document chrome ----

function drawHeader(doc: JsPDFDoc, docTitle: string, subtitle: string): number {
  const H = 106;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, H, "F");
  doc.setFillColor(...SKY);
  doc.rect(0, H - 3, PAGE_W, 3, "F");

  setText(doc, 16, SKY, true);
  doc.text("GEO", MARGIN, 38);
  doc.setTextColor(255, 255, 255);
  doc.text(" Archer", MARGIN + doc.getTextWidth("GEO"), 38);

  setText(doc, 22, [255, 255, 255], true);
  doc.text(docTitle, MARGIN, 68);

  setText(doc, 9, [186, 230, 253]);
  const date = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const sub = cleanInline(subtitle);
  doc.text(
    doc.splitTextToSize(`${sub}  ·  ${date}`, CONTENT_W) as string[],
    MARGIN,
    86
  );
  return H + 28;
}

function drawFooters(doc: JsPDFDoc, docTitle: string): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...FAINT);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 34, PAGE_W - MARGIN, PAGE_H - 34);
    setText(doc, 7.5, MUTED);
    doc.text(`GEO Archer · ${docTitle}`, MARGIN, PAGE_H - 22);
    doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - 22, {
      align: "right",
    });
  }
}

export interface GeneratedDocPdfOptions {
  markdown: string;
  docTitle: string;
  subtitle: string;
}

/** Render an AI-generated markdown document as a styled, branded PDF. */
export function buildGeneratedDocPdf({
  markdown,
  docTitle,
  subtitle,
}: GeneratedDocPdfOptions): JsPDFDoc {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const y = drawHeader(doc, docTitle, subtitle);
  renderBlocks(doc, y, parseBlocks(markdown));
  drawFooters(doc, docTitle);
  return doc;
}

export function downloadGeneratedDocPdf(options: GeneratedDocPdfOptions): void {
  const doc = buildGeneratedDocPdf(options);
  const slug = options.docTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`geo-archer-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
