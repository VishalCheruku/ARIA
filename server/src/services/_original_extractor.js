const fs = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-parse");
const { ocrImage, ocrScannedPdf } = require("./ocr");

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"]);

async function extractDocument(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  let text = "";
  let extraction = {
    mode: "structured_text",
    confidence: 100,
    pages: 1,
    processedPages: 1
  };

  if (extension === ".json") {
    const raw = await fs.readFile(file.path, "utf8");
    const parsed = JSON.parse(raw);
    text = JSON.stringify(parsed, null, 2);
  } else if (extension === ".txt") {
    text = await fs.readFile(file.path, "utf8");
  } else if (extension === ".pdf") {
    const buffer = await fs.readFile(file.path);
    const pdf = await pdfParse(buffer);
    text = pdf.text || "";
    extraction.pages = pdf.numpages || 1;
    extraction.processedPages = pdf.numpages || 1;

    if (text.trim().length < 40) {
      extraction = await ocrScannedPdf(file.path);
      text = extraction.text;
    } else {
      extraction.mode = "selectable_pdf_text";
    }
  } else if (imageExtensions.has(extension)) {
    extraction = await ocrImage(file.path);
    text = extraction.text;
  } else {
    throw new Error("Unsupported file type. Upload PDF, image, TXT, or JSON.");
  }

  return {
    text: normalizeText(text),
    source: {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      extraction
    }
  };
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPatientFields(text) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const joined = lines.join("\n");

  const patient = {
    name: firstMatch(joined, [
      /(?:patient|name)\s*[:\-]\s*([A-Z][A-Za-z ]{2,60})/i,
      /\b(Asha Devi|Ravi Kumar|Meena Joseph|Vikram Singh|Surya|Vikas)\b/i
    ]) || "Unknown Patient",
    age: toNumber(firstMatch(joined, [/\bage\s*[:\-]?\s*(\d{1,3})/i, /\b(\d{1,3})\s*(?:years|yrs|y\/o)\b/i])),
    phone: firstMatch(joined, [/(\+\d{10,15})/, /\b(?:phone|mobile|contact)\s*[:\-]\s*([0-9 +\-]{10,18})/i]),
    diagnosis: firstMatch(joined, [/(?:diagnosis|dx|impression|assessment)\s*[:\-]\s*([^\n]+)/i]) || inferDiagnosis(joined),
    dischargeDate: firstMatch(joined, [/(?:discharge date|discharged on|date of discharge)\s*[:\-]\s*([^\n]+)/i]),
    medicalHistory: sectionList(joined, ["history", "past history", "medical history", "c/o"]),
    medicines: extractMedicines(joined)
  };

  patient.name = titleCase(patient.name);
  patient.phone = normalizePhone(patient.phone) || process.env.DEMO_DEFAULT_PHONE || "";

  return patient;
}

function firstMatch(text, regexes) {
  for (const regex of regexes) {
    const match = text.match(regex);
    if (match && match[1]) return match[1].trim();
  }
  return "";
}

function toNumber(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function sectionList(text, labels) {
  const found = [];
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*[:\\-]\\s*([^\\n]+)`, "i");
    const match = text.match(regex);
    if (match) found.push(...splitList(match[1]));
  }
  return [...new Set(found)].slice(0, 8);
}

function extractMedicines(text) {
  const medicines = [];
  const rx = text.match(/(?:rx|medicines|medications|drugs)\s*[:\-]?\s*([\s\S]{0,700})/i);
  const source = rx ? rx[1] : text;
  const medWords = /(metformin|insulin|atorvastatin|rosuvastatin|amlodipine|telmisartan|losartan|aspirin|clopidogrel|furosemide|lasix|warfarin|apixaban|salbutamol|budesonide|pantoprazole|azithromycin|amoxicillin|cefixime|antibiotic|steroid|diuretic)/gi;
  const matches = source.match(medWords) || [];
  medicines.push(...matches.map(titleCase));

  const bulletMeds = source
    .split(/\n|,|;/)
    .map((item) => item.replace(/^[-*0-9. ]+/, "").trim())
    .filter((item) => /\b(mg|ml|tab|tablet|cap|capsule|od|bd|tds|daily|insulin)\b/i.test(item));

  medicines.push(...bulletMeds);
  return [...new Set(medicines)].slice(0, 12);
}

function splitList(value) {
  return value
    .split(/,|;|\band\b/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferDiagnosis(text) {
  const conditions = [
    ["heart failure", /heart failure|chf|cardiac failure/i],
    ["diabetes", /diabetes|dm type|hypergly/i],
    ["pneumonia", /pneumonia|lower respiratory/i],
    ["copd", /copd|asthma|bronchitis/i],
    ["kidney disease", /ckd|renal|kidney/i],
    ["hypertension", /hypertension|high bp|htn/i]
  ];

  return conditions.filter(([, regex]) => regex.test(text)).map(([label]) => label).join(", ") || "Not clearly stated";
}

function normalizePhone(value) {
  if (!value) return "";
  const cleaned = value.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.length === 10) return `+91${cleaned}`;
  return cleaned;
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

module.exports = { extractDocument, extractPatientFields };
