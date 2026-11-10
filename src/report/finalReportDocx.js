// Event final report as a real Word document (.docx), built from the same
// block model the screen shows. The docx library is loaded on demand.
//
// model: { title, eventName, lines: [string], eventLogo, promoters: [dataUrl],
//          sections: [{ heading, newPage?, blocks: [...] }] }
// blocks: { type: "p", text, small? } · { type: "h3", text } · { type: "kv", rows: [[k, v]] }
//         { type: "table", head: [..], rows: [[cell]], total?: [cell], num: [colIdx] }
//         { type: "ranks", items: [{ title, rows: [{ pos, team, logo }] }] } · { type: "image", src }
// cell: string | { text, logo }

const NAVY = "1F3A5F", ACCENT = "2E6DB4", LIGHT = "EEF2F7", LINE = "C9D2DE", GREY = "6B7280";
const FONT = "Calibri";

function decode(dataUrl) {
  const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/i.exec(String(dataUrl || ""));
  if (!m) return null;
  const bin = atob(m[2]);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  return { type: m[1].toLowerCase().replace("jpeg", "jpg"), data };
}
const size = (src) => new Promise((res) => {
  const i = new Image();
  i.onload = () => res({ w: i.naturalWidth || 1, h: i.naturalHeight || 1 });
  i.onerror = () => res(null);
  i.src = src;
});

export async function buildFinalReportDocx(model) {
  const d = await import("docx");
  const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, AlignmentType,
    BorderStyle, ShadingType, Header, Footer, PageNumber, VerticalAlign, TableLayoutType } = d;

  // Pre-load every image (bytes + natural size).
  const cache = new Map();
  const want = [model.eventLogo, ...(model.promoters || [])];
  for (const s of model.sections) for (const b of s.blocks) {
    if (b.type === "image") want.push(b.src);
    if (b.type === "ranks") for (const it of b.items) for (const r of it.rows) want.push(r.logo);
  }
  for (const src of want) {
    if (!src || cache.has(src)) continue;
    const bytes = decode(src);
    const dim = bytes && (await size(src));
    cache.set(src, bytes && dim ? { ...bytes, ...dim } : null);
  }
  // An image fitted into a box (px), or null.
  const img = (src, maxW, maxH) => {
    const c = src && cache.get(src);
    if (!c) return null;
    const k = Math.min(maxW / c.w, maxH / c.h, 1.5);
    return new ImageRun({ type: c.type, data: c.data, transformation: { width: Math.round(c.w * k), height: Math.round(c.h * k) } });
  };

  const run = (text, o = {}) => new TextRun({ text: String(text ?? ""), font: FONT, ...o });
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
  const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const gridBorders = { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin };
  const margins = { top: 70, bottom: 70, left: 110, right: 110 };

  const para = (children, o = {}) => new Paragraph({ children, spacing: { after: 120, line: 276 }, ...o });
  const cellOf = (c, { head, bold, right, fill } = {}) => {
    const text = typeof c === "object" && c ? c.text : c;
    const logo = typeof c === "object" && c?.logo ? img(c.logo, 18, 18) : null;
    return new TableCell({
      verticalAlign: VerticalAlign.CENTER,
      shading: head ? { type: ShadingType.CLEAR, fill: NAVY, color: "auto" } : fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
      margins,
      children: [new Paragraph({
        alignment: right ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [...(logo ? [logo, run("  ")] : []), run(text, { bold: head || bold, color: head ? "FFFFFF" : undefined, size: 20 })],
      })],
    });
  };
  const table = (b) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: gridBorders,
    rows: [
      new TableRow({ tableHeader: true, children: b.head.map((h, i) => cellOf(h, { head: true, right: b.num?.includes(i) })) }),
      ...b.rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cellOf(c, { right: b.num?.includes(i), fill: ri % 2 ? "F7F9FC" : undefined })) })),
      ...(b.total ? [new TableRow({ children: b.total.map((c, i) => cellOf(c, { bold: true, right: b.num?.includes(i), fill: LIGHT })) })] : []),
    ],
  });
  const kv = (b) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: gridBorders,
    columnWidths: [2800, 6800],
    layout: TableLayoutType.FIXED,
    rows: b.rows.map(([k, v]) => new TableRow({ children: [
      new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: LIGHT, color: "auto" }, margins, children: [new Paragraph({ children: [run(k, { bold: true, color: NAVY, size: 20 })] })] }),
      new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, margins, children: [new Paragraph({ children: [run(v, { size: 20 })] })] }),
    ] })),
  });
  const rankTable = (it) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: gridBorders,
    rows: [
      new TableRow({ tableHeader: true, children: [new TableCell({ columnSpan: 2, shading: { type: ShadingType.CLEAR, fill: NAVY, color: "auto" }, margins, children: [new Paragraph({ children: [run(it.title, { bold: true, color: "FFFFFF", size: 20 })] })] })] }),
      ...it.rows.map((r) => new TableRow({ cantSplit: true, children: [
        cellOf(r.pos, { right: true, bold: true, fill: Number(String(r.pos).replace(/\D/g, "")) <= 3 ? "FFF6DB" : undefined }),
        cellOf({ text: r.team, logo: r.logo }),
      ] })),
    ],
  });
  // Rankings two per row.
  const ranks = (b) => {
    const rows = [];
    for (let i = 0; i < b.items.length; i += 2) {
      const pair = b.items.slice(i, i + 2);
      rows.push(new TableRow({ cantSplit: true, children: [0, 1].map((k) => new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        margins: { top: 0, bottom: 160, left: k ? 120 : 0, right: k ? 0 : 120 },
        children: pair[k] ? [rankTable(pair[k]), new Paragraph({ children: [] })] : [new Paragraph({ children: [] })],
      })) }));
    }
    return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows });
  };

  const blocks = (list) => list.flatMap((b) => {
    if (b.type === "p") return [para([run(b.text, b.small ? { size: 18, color: GREY, italics: true } : {})])];
    if (b.type === "h3") return [para([run(b.text, { bold: true, color: ACCENT, size: 22 })], { spacing: { before: 200, after: 80 }, keepNext: true })];
    if (b.type === "kv") return [kv(b), para([])];
    if (b.type === "table") return [table(b), para([])];
    if (b.type === "ranks") return [ranks(b)];
    if (b.type === "image") { const r = img(b.src, 640, 820); return r ? [para([r], { alignment: AlignmentType.CENTER })] : []; }
    return [];
  });

  const heading = (text, newPage) => new Paragraph({
    pageBreakBefore: !!newPage, keepNext: true,
    spacing: { before: newPage ? 0 : 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 4 } },
    children: [run(text, { bold: true, size: 28, color: NAVY })],
  });

  // Cover: big event logo, title, event, dates · venue, promoters.
  const promoterRow = (h) => (model.promoters || []).map((p) => img(p, h * 2.2, h)).filter(Boolean)
    .flatMap((r, i) => (i ? [run("      "), r] : [r]));
  const cover = [
    ...(img(model.eventLogo, 220, 150) ? [para([img(model.eventLogo, 220, 150)], { alignment: AlignmentType.CENTER, spacing: { after: 240 } })] : []),
    para([run(model.title, { bold: true, size: 44, color: NAVY })], { alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
    para([run(model.eventName, { size: 30, color: ACCENT })], { alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
    ...model.lines.filter(Boolean).map((l) => para([run(l, { size: 22, color: GREY })], { alignment: AlignmentType.CENTER, spacing: { after: 40 } })),
    ...(promoterRow(1).length ? [para(promoterRow(48), { alignment: AlignmentType.CENTER, spacing: { before: 360, after: 240 } })] : [para([], { spacing: { after: 240 } })]),
  ];

  const headerLogo = img(model.eventLogo, 90, 34);
  const header = new Header({ children: [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders: { ...noBorders, bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, margins: { bottom: 80 }, children: [new Paragraph({ children: headerLogo ? [headerLogo] : [] })] }),
      new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, margins: { bottom: 80 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(model.eventName, { size: 18, color: GREY }), run(" · " + model.title, { size: 18, color: GREY })] })] }),
    ] })],
  })] });
  const pageNo = new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: GREY })] });
  const footer = new Footer({ children: [
    ...(promoterRow(1).length ? [new Paragraph({ alignment: AlignmentType.CENTER, children: promoterRow(26) })] : []),
    pageNo,
  ] });

  const doc = new Document({
    creator: "Fistball Arena", title: `${model.title} — ${model.eventName}`,
    styles: { default: { document: { run: { font: FONT, size: 21, color: "222222" } } } },
    sections: [{
      properties: {
        titlePage: true,
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, bottom: 1200, left: 1134, right: 1134, header: 500, footer: 450 } },
      },
      headers: { default: header, first: new Header({ children: [] }) },
      footers: { default: footer, first: new Footer({ children: [pageNo] }) },
      children: [...cover, ...model.sections.flatMap((s) => [heading(s.heading, s.newPage), ...blocks(s.blocks)])],
    }],
  });
  return Packer.toBlob(doc);
}
