/** Strip chatbot offers ("If you want, I can also…") from finished drafts. */
function stripChatTail(text: string): string {
  let out = text.trim();
  const patterns = [
    /\n---+\s*\n[\s\S]*$/i,
    /\n+\*?\*?If you want[\s\S]*$/i,
    /\n+Would you like[\s\S]*$/i,
    /\n+Let me know[\s\S]*$/i,
    /\n+I can also[\s\S]*$/i,
    /\n+Feel free to ask[\s\S]*$/i,
  ];
  let prev = "";
  while (prev !== out) {
    prev = out;
    for (const re of patterns) {
      out = out.replace(re, "").trim();
    }
  }
  return out;
}

/** Turn "H2: Title" / "• H3: Title" lines into real markdown headings. */
function normalizePseudoHeadings(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const bulletH3 = line.match(/^(\s*)[-•*]\s*H3:\s*(.+)$/i);
      if (bulletH3) return `${bulletH3[1]}### ${bulletH3[2].trim()}`;

      const bulletH2 = line.match(/^(\s*)[-•*]\s*H2:\s*(.+)$/i);
      if (bulletH2) return `${bulletH2[1]}## ${bulletH2[2].trim()}`;

      const h1 = line.match(/^(\s*)H1:\s*(.+)$/i);
      if (h1) return `${h1[1]}# ${h1[2].trim()}`;

      const h2 = line.match(/^(\s*)H2:\s*(.+)$/i);
      if (h2) return `${h2[1]}## ${h2[2].trim()}`;

      const h3 = line.match(/^(\s*)H3:\s*(.+)$/i);
      if (h3) return `${h3[1]}### ${h3[2].trim()}`;

      return line;
    })
    .join("\n");
}

/** Post-process model output before showing or copying. */
export function polishGeneratedContent(content: string, kind: string): string {
  let out = stripChatTail(content);
  if (kind === "brief" || kind === "service-content" || kind === "comparison-page") {
    out = normalizePseudoHeadings(out);
  }
  return out.trim();
}
