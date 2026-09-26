ARIA AI Next — upgrade set

Frontend
- New white editorial healthcare UI.
- Animated red ECG line runs through the landing experience and dashboard reveal.
- Intro sequence starts with stethoscope + ECG sweep.
- Drag/drop intake, OCR status, risk routing, decision banner, live activity timeline.
- Demo patient shortcuts retained.

OCR
- Tesseract.js English OCR for images and scanned PDFs.
- Automatic preprocessing pass: resize, grayscale, contrast and threshold.
- Two-pass fallback when OCR confidence is weak.
- Scanned PDFs rendered at higher resolution with per-page processing.
- OCR confidence, quality band, page count, pass count and character/word counts returned.
- Selectable PDFs stay on the faster text extraction path; scans use Tesseract.

Backend
- Existing SMS/call/MongoDB contracts retained.
- Demo patient risk policy retained.
- /health now exposes OCR engine and capabilities.

Required existing dependencies
- tesseract.js
- @napi-rs/canvas
- pdfjs-dist
- pdf-parse
- express, multer, cors, mongoose, twilio, dotenv
