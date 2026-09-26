const fs = require("fs/promises");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { createWorker } = require("tesseract.js");

const DEFAULT_MAX_PAGES = 8;
const TARGET_CONFIDENCE = 72;

async function ocrImage(imagePath) {
  const original = await recognizeWithWorker(imagePath);
  let best = original;

  if (original.confidence < TARGET_CONFIDENCE || original.text.length < 50) {
    const enhanced = await preprocessImage(imagePath);
    const secondPass = await recognizeWithWorker(enhanced);
    if (secondPass.confidence > best.confidence || secondPass.text.length > best.text.length) {
      best = secondPass;
      best.mode = "image_ocr_enhanced";
    }
    await fs.unlink(enhanced).catch(() => {});
  }

  return {
    text: best.text,
    confidence: Math.round(best.confidence),
    pages: 1,
    processedPages: 1,
    mode: best.mode || "image_ocr",
    passes: best.passes || 1,
    quality: qualityBand(best.confidence)
  };
}

async function ocrScannedPdf(pdfPath, maxPages = DEFAULT_MAX_PAGES) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const document = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pageCount = Math.min(document.numPages, maxPages);
  const worker = await createConfiguredWorker();
  const chunks = [];
  const confidences = [];
  let passes = 0;

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2.8 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;

      const first = await worker.recognize(canvas.toBuffer("image/png"));
      passes += 1;
      let result = first;

      if ((first.data.confidence || 0) < TARGET_CONFIDENCE || String(first.data.text || "").trim().length < 50) {
        const enhanced = enhanceCanvas(canvas);
        const second = await worker.recognize(enhanced.toBuffer("image/png"));
        passes += 1;
        if ((second.data.confidence || 0) > (first.data.confidence || 0) || String(second.data.text || "").length > String(first.data.text || "").length) {
          result = second;
        }
      }

      const pageText = String(result.data.text || "").trim();
      chunks.push(`--- Page ${pageNumber} ---\n${pageText}`);
      confidences.push(Number(result.data.confidence || 0));
      page.cleanup?.();
    }
  } finally {
    await worker.terminate();
    document.cleanup?.();
  }

  const confidence = Math.round(confidences.reduce((sum, value) => sum + value, 0) / Math.max(confidences.length, 1));
  return {
    text: chunks.join("\n\n"),
    confidence,
    pages: document.numPages,
    processedPages: pageCount,
    mode: "scanned_pdf_ocr",
    passes,
    quality: qualityBand(confidence),
    truncated: document.numPages > maxPages
  };
}

async function recognizeWithWorker(input) {
  const worker = await createConfiguredWorker();
  try {
    const result = await worker.recognize(input);
    return {
      text: String(result.data.text || "").trim(),
      confidence: Number(result.data.confidence || 0),
      passes: 1,
      mode: "image_ocr"
    };
  } finally {
    await worker.terminate();
  }
}

async function createConfiguredWorker() {
  const worker = await createWorker("eng", 1, { logger: () => {} });
  await worker.setParameters({
    tessedit_pageseg_mode: "6",
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;()[]{}+-/%#&'\"/ "
  });
  return worker;
}

async function preprocessImage(imagePath) {
  const image = await loadImage(imagePath);
  const scale = Math.min(2.2, Math.max(1, 1800 / Math.max(image.width, image.height)));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.55 + 128));
    const value = contrast > 185 ? 255 : contrast < 75 ? 0 : Math.round(contrast);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);

  const out = `${imagePath}.aria-enhanced.png`;
  await fs.writeFile(out, canvas.toBuffer("image/png"));
  return out;
}

function enhanceCanvas(source) {
  const canvas = createCanvas(source.width, source.height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const value = gray > 180 ? 255 : gray < 90 ? 0 : Math.round(gray);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function qualityBand(confidence) {
  if (confidence >= 85) return "excellent";
  if (confidence >= TARGET_CONFIDENCE) return "good";
  if (confidence >= 50) return "fair";
  return "low";
}

module.exports = { ocrImage, ocrScannedPdf };
