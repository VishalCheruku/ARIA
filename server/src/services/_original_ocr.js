const fs = require("fs/promises");
const { createCanvas } = require("@napi-rs/canvas");
const { createWorker } = require("tesseract.js");

async function ocrImage(imagePath) {
  const worker = await createConfiguredWorker();
  const result = await worker.recognize(imagePath);
  await worker.terminate();

  return {
    text: result.data.text || "",
    confidence: Math.round(result.data.confidence || 0),
    pages: 1,
    mode: "image_ocr"
  };
}

async function ocrScannedPdf(pdfPath, maxPages = 6) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const document = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const worker = await createConfiguredWorker();
  const pageCount = Math.min(document.numPages, maxPages);
  const chunks = [];
  const confidences = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");

    await page.render({ canvasContext: context, viewport }).promise;
    const image = canvas.toBuffer("image/png");
    const result = await worker.recognize(image);

    chunks.push(`--- Page ${pageNumber} ---\n${result.data.text || ""}`);
    confidences.push(result.data.confidence || 0);
  }

  await worker.terminate();

  return {
    text: chunks.join("\n\n"),
    confidence: Math.round(confidences.reduce((sum, value) => sum + value, 0) / Math.max(confidences.length, 1)),
    pages: document.numPages,
    processedPages: pageCount,
    mode: "scanned_pdf_ocr"
  };
}

async function createConfiguredWorker() {
  const worker = await createWorker("eng", 1, {
    logger: () => {}
  });

  await worker.setParameters({
    tessedit_pageseg_mode: "6",
    preserve_interword_spaces: "1"
  });

  return worker;
}

module.exports = { ocrImage, ocrScannedPdf };
