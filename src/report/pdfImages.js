// Render the pages of a PDF (data URL) to JPEG data URLs — used to put a venue
// map uploaded as PDF into the final report. pdf.js is loaded on demand.
export async function pdfToImages(dataUrl, { maxPages = 3, width = 1800 } = {}) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const b64 = String(dataUrl).split(",")[1] || "";
  const bin = atob(b64);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  const doc = await pdfjs.getDocument({ data }).promise;
  const out = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, width / base.width) });
    const c = document.createElement("canvas");
    c.width = Math.round(viewport.width); c.height = Math.round(viewport.height);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push(c.toDataURL("image/jpeg", 0.85));
  }
  doc.destroy();
  return out;
}
