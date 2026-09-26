const fs = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-parse");
const { ocrImage, ocrScannedPdf } = require("./ocr");

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"]);
const supportedExtensions = new Set([...imageExtensions, ".pdf", ".txt", ".json"]);

/* ============================================================
   ARIA clinical extraction engine
   Reads any discharge summary / prescription / medical report
   (image OCR, PDF, TXT, JSON) and pulls out structured patient
   data: identity, diagnosis, medicines, vitals, dates, doctor.
   ============================================================ */

/* ---------- label aliases per field ---------- */
const LABELS = {
  name: ["patient name", "patient", "name of the patient", "name of patient", "name"],
  age: ["age", "age sex", "age gender", "age years"],
  phone: ["phone", "phone no", "phone number", "mobile", "mobile no", "mobile number", "contact", "contact no", "contact number", "cell", "tel", "telephone", "whatsapp"],
  diagnosis: ["diagnosis", "final diagnosis", "provisional diagnosis", "primary diagnosis", "admission diagnosis", "dx", "disease", "condition", "impression", "assessment", "chief complaint", "chief complaints", "complaint", "complaints", "reason for admission", "reason for visit", "admitted for", "presenting complaint"],
  dischargeDate: ["date of discharge", "discharge date", "discharged on", "discharge dt", "dod", "date of discharge from hospital"],
  admissionDate: ["date of admission", "admission date", "admitted on", "doa", "date of admission to hospital"],
  doctor: ["doctor", "treating doctor", "consultant", "consultant doctor", "physician", "surgeon", "attending physician", "signed by", "clinician"],
  history: ["history", "past history", "medical history", "patient history", "comorbidities", "comorbidity", "co morbidities", "h/o", "known case of", "past medical history", "surgical history"],
  medicines: ["rx", "r/x", "medicines", "medication", "medications", "drugs", "drug chart", "prescription", "treatment", "treatment given", "advice"],
  vitals: ["vitals", "vital signs", "observations"]
};

/* ---------- clinical vocabulary ---------- */
const CONDITION_MAP = [
  ["Heart failure", /heart failure|\bchf\b|congestive cardiac failure|cardiac failure|lv dysfunction/i],
  ["Stroke", /\bstroke\b|\bcva\b|cerebrovascular|hemiplegia|infarct.*brain|brain infarct/i],
  ["Diabetes", /diabetes|mellitus|\bdm\b(?!.*\\w)|hyperglyc|\bsugar\b.*\bhigh\b/i],
  ["Hypertension", /hypertension|\bhtn\b|\bhigh bp\b|blood pressure.*high|raised bp/i],
  ["COPD", /\bcopd\b|chronic obstructive/i],
  ["Asthma", /\basthma\b|bronchial asthma/i],
  ["Pneumonia", /pneumonia|lower respiratory|lobar consolidation/i],
  ["Tuberculosis", /tuberculosis|\btb\b(?!.*\bvaccin)|pulmonary tb/i],
  ["Chronic kidney disease", /\bckd\b|chronic kidney|renal failure|kidney failure|nephropathy/i],
  ["Acute kidney injury", /\baki\b|acute kidney|acute renal/i],
  ["Gastritis", /gastritis|gastric ulcer|peptic ulcer|\b pud\b|acidity/i],
  ["Anemia", /anemia|anaemia|low hemoglobin|low hb\b/i],
  ["Dengue", /dengue/i],
  ["Malaria", /malaria/i],
  ["Typhoid", /typhoid|enteric fever/i],
  ["Sepsis", /\bsepsis\b|septicemia|septicaemia|septic shock/i],
  ["Fracture", /fracture|broken bone/i],
  ["Cancer", /cancer|carcinoma|tumor|tumour|malignan|oncology|lymphoma|leukemia/i],
  ["Migraine", /migraine/i],
  ["Epilepsy", /epilepsy|seizure|convulsion|fits/i],
  ["Thyroid disorder", /thyroid|hypothyroid|hyperthyroid|goiter|goitre/i],
  ["Liver disease", /cirrhosis|hepatitis|liver disease|jaundice|fatty liver/i],
  ["Pancreatitis", /pancreatitis/i],
  ["Appendicitis", /appendicitis/i],
  ["Kidney stones", /renal stone|kidney stone|nephrolithiasis|urolithiasis/i],
  ["Arthritis", /arthritis|joint pain.*chronic|osteoarthritis|rheumatoid/i],
  ["Cellulitis", /cellulitis|skin infection/i],
  ["Covid", /covid|sars.?cov/i],
  ["Allergic reaction", /allergic reaction|anaphyla/i],
  ["Coronary artery disease", /coronary|\bcad\b|angina|heart attack|myocardial infarction|\bmi\b(?!.*\\w)|stent/i]
];

const DOSAGE_FORM = /\b(tab\.?|tabs\.?|tablet|tablets|cap\.?|caps\.?|capsule|capsules|syrup|syp\.?|inj\.?|injection|drops|drop|ointment|cream|gel|lotion|patch|inhaler|rotacap|sachet|powder|respule|vial|suppository|spray)\b/i;

const FREQUENCY = /\b(od|bd|tds|tid|qid|qhs|hs|sos|stat|q\d+\s*h|once a day|once daily|twice a day|twice daily|thrice a day|three times|four times|every\s+\d+\s*(hours?|hrs?|days?)|morning|afternoon|night|bedtime|before food|after food|before meals|after meals|weekly|on alternate days)\b/i;

const STRENGTH = /\b\d+(?:\.\d+)?\s*(mg|mcg|µg|ug|g|gm|ml|iu|units?|meq|%)\b/i;

const DRUG_WORDS = [
  "paracetamol", "acetaminophen", "aspirin", "ibuprofen", "diclofenac", "aceclofenac", "naproxen", "tramadol", "morphine", "codeine",
  "amoxicillin", "ampicillin", "azithromycin", "cefixime", "ceftriaxone", "cefuroxime", "cephalexin", "ciprofloxacin", "levofloxacin", "ofloxacin",
  "doxycycline", "metronidazole", "clindamycin", "cotrimoxazole", "trimethoprim", "nitrofurantoin", "piperacillin", "meropenem", "vancomycin", "gentamicin",
  "pantoprazole", "omeprazole", "rabeprazole", "esomeprazole", "lansoprazole", "ranitidine", "famotidine", "domperidone", "ondansetron", "granisetron",
  "sucralfate", "dicyclomine", "digene", "lactulose", "ors",
  "metformin", "glimepiride", "gliclazide", "glipizide", "sitagliptin", "vildagliptin", "dapagliflozin", "empagliflozin", "pioglitazone", "acarbose",
  "insulin", "huminsulin", "lantus", "mixtard",
  "amlodipine", "nifedipine", "telmisartan", "losartan", "valsartan", "enalapril", "ramipril", "lisinopril", "captopril", "atenolol", "metoprolol",
  "bisoprolol", "propranolol", "carvedilol", "hydrochlorothiazide", "chlorthalidone", "indapamide", "furosemide", "lasix", "torsemide", "spironolactone", "eplerenone", "clonidine", "moxonidine", "diltiazem", "verapamil",
  "atorvastatin", "rosuvastatin", "simvastatin", "pravastatin", "fenofibrate", "ezetimibe", "clopidogrel", "ticagrelor", "prasugrel", "warfarin", "apixaban", "rivaroxaban", "dabigatran", "heparin", "enoxaparin", "aspirin",
  "salbutamol", "levosalbutamol", "budesonide", "formoterol", "salmeterol", "ipratropium", "tiotropium", "montelukast", "doxofylline", "theophylline", "ambroxol", "acebrophylline", "levocetirizine", "cetirizine", "fexofenadine", "chlorpheniramine", "hydroxyzine", "montair",
  "prednisolone", "prednisone", "deflazacort", "dexamethasone", "hydrocortisone", "methylprednisolone", "betamethasone",
  "levothyroxine", "thyronorm", "eltroxin", "carbimazole", "methimazole", "neomercazole",
  "alprazolam", "clonazepam", "lorazepam", "diazepam", "zolpidem", "escitalopram", "sertraline", "fluoxetine", "amitriptyline", "nortriptyline", "gabapentin", "pregabalin", "duloxetine", "levetiracetam", "sodium valproate", "valproate", "phenytoin", "carbamazepine",
  "ferrous", "ferric", "folic", "cyanocobalamin", "methylcobalamin", "cholecalciferol", "calcium", "zinc", "multivitamin", "antioxidant",
  "tamsulosin", "sildenafil", "tadalafil", "allopurinol", "febuxostat", "colchicine", "serratiopeptidase", "trypsin", "rabeprazole",
  "chloramphenicol", "moxifloxacin", "tobramycin", "neomycin", "clotrimazole", "miconazole", "fluconazole", "terbinafine", "aciclovir", "acyclovir", "oseltamivir", "hydroxychloroquine", "artemether", "lumefantrine", "primaquine", "albendazole", "ivermectin", "diethylcarbamazine"
];

const DRUG_RE = new RegExp(`\\b(${[...new Set(DRUG_WORDS)].sort((a, b) => b.length - a.length).join("|")})\\b`, "i");

const MED_LINE_HINT = new RegExp(
  `${DRUG_RE.source}|\\d+\\s*(mg|mcg|ml|iu)|${DOSAGE_FORM.source}|${FREQUENCY.source}|${STRENGTH.source}`, "i"
);

/* ---------- section header detection ---------- */
const SECTION_HEADER_LINES = [
  ...LABELS.medicines, ...LABELS.diagnosis, ...LABELS.history, ...LABELS.vitals,
  "investigations", "investigation", "lab reports", "reports", "lab findings", "findings",
  "advice", "discharge advice", "instructions", "follow up", "follow-up", "review",
  "vitals", "vital signs", "general exam", "examination", "on examination",
  "operation", "procedure", "surgery", "hospital course", "course in hospital", "summary",
  "discharge summary", "treatment given", "symptoms", "allergies", "notes"
];

function extractDocument(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!supportedExtensions.has(extension)) {
    throw new Error("Unsupported file type. Upload PDF, scanned PDF, image, TXT, or JSON.");
  }

  if (extension === ".json") return extractJson(file);
  return extractTextLike(file, extension);
}

async function extractTextLike(file, extension) {
  let text = "";
  let extraction = {
    mode: "structured_text",
    confidence: 100,
    pages: 1,
    processedPages: 1,
    passes: 1,
    quality: "excellent"
  };

  if (extension === ".txt") {
    text = await fs.readFile(file.path, "utf8");
    extraction.mode = "plain_text";
  } else if (extension === ".pdf") {
    const buffer = await fs.readFile(file.path);
    let selectableText = "";
    let numpages = 1;
    try {
      const pdf = await pdfParse(buffer);
      selectableText = normalizeText(pdf.text || "");
      numpages = pdf.numpages || 1;
    } catch (_error) {
      selectableText = ""; /* some PDFs break pdf-parse — fall through to pdfjs */
    }
    if (selectableText.length < 40) {
      /* direct text layer read via pdfjs (handles PDFs pdf-parse rejects) */
      selectableText = normalizeText(await extractSelectablePdfText(buffer));
    }
    extraction.pages = numpages;
    extraction.processedPages = numpages;

    if (selectableText.length >= 40) {
      text = selectableText;
      extraction.mode = "selectable_pdf_text";
      extraction.confidence = 100;
      extraction.quality = "excellent";
    } else {
      const scanned = await ocrScannedPdf(file.path);
      text = scanned.text;
      extraction = scanned;
      if (!text.trim()) {
        throw new Error("Tesseract could not extract readable text from this scanned PDF.");
      }
    }
  } else if (imageExtensions.has(extension)) {
    extraction = await ocrImage(file.path);
    text = extraction.text;
    if (!text.trim()) {
      throw new Error("Tesseract could not extract readable text from this image.");
    }
  }

  text = normalizeText(text);
  const patient = extractPatientFields(text);

  return {
    text,
    patient,
    source: {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      extension,
      extraction: {
        ...extraction,
        characters: text.length,
        words: text ? text.split(/\s+/).length : 0,
        language: extraction.mode?.includes("ocr") ? "eng" : "structured"
      }
    }
  };
}

/* ---------- JSON reports: smart key mapping ---------- */
async function extractJson(file) {
  const raw = await fs.readFile(file.path, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    throw new Error("This JSON file could not be parsed. Check the file format.");
  }

  const flat = {};
  (function walk(node, prefix) {
    for (const [key, value] of Object.entries(node || {})) {
      const fullKey = `${prefix} ${key}`.trim().toLowerCase();
      if (value && typeof value === "object" && !Array.isArray(value)) {
        walk(value, fullKey);
      } else {
        flat[fullKey] = Array.isArray(value) ? value.map(item => String(item)).join("\n") : String(value ?? "");
      }
    }
  })(parsed, "");

  const findValue = patterns => {
    for (const [key, value] of Object.entries(flat)) {
      if (value && patterns.some(p => p.test(key))) return value;
    }
    return "";
  };

  const freeText = findValue([/^text$/, /^content$/, /^report$/, /notes?$/, /raw ?text$/]);
  const textParts = [];
  const patient = extractPatientFields(normalizeText(freeText)) || {};

  const name = findValue([/patient ?name/, /^(full ?)?name$/, /^name\b/, /patient/]);
  const age = findValue([/^age$/, /\bage\b/, /years?/]);
  const phone = findValue([/phone/, /mobile/, /contact/, /whatsapp/, /\bphone\b/]);
  const diagnosis = findValue([/diagnos/, /\bdx\b/, /disease/, /condition/, /complaint/]);
  const dischargeDate = findValue([/discharge date|discharged|date of discharge/, /discharge/]);
  const doctor = findValue([/doctor|consultant|physician|surgeon/]);
  const medicinesRaw = findValue([/medicin/, /medication/, /\bdrugs?\b/, /\brx\b/, /prescription/]);
  const historyRaw = findValue([/history|comorbid/]);

  const meds = Array.isArray(parsed.medicines || parsed.medications || parsed.prescription)
    ? (parsed.medicines || parsed.medications || parsed.prescription).map(String)
    : String(medicinesRaw || "").split(/\n|;|(?:,\s*(?=tab|cap|syr|inj))/i);

  if (freeText && freeText.length > 40) textParts.push(freeText);
  if (!textParts.length) {
    textParts.push(JSON.stringify(parsed, null, 2));
  }
  const text = normalizeText(textParts.join("\n\n"));

  const merged = {
    ...patient,
    name: cleanField(name) || patient.name || "Unknown Patient",
    age: toInt(age) ?? patient.age ?? null,
    phone: normalizePhone(cleanField(phone)) || patient.phone || "",
    diagnosis: cleanField(diagnosis) || patient.diagnosis || "Not clearly stated",
    dischargeDate: parseDate(cleanField(dischargeDate)) || patient.dischargeDate || "",
    doctor: titleCase(cleanField(doctor)) || patient.doctor || "",
    medicines: parseMedicineList(meds).length ? parseMedicineList(meds) : patient.medicines || [],
    medicalHistory: splitList(String(historyRaw || "")).length ? splitList(String(historyRaw || "")) : patient.medicalHistory || []
  };

  return {
    text,
    patient: finalizePatient(merged, text),
    source: {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      extension: ".json",
      extraction: {
        mode: "json_structured",
        confidence: 100,
        pages: 1,
        processedPages: 1,
        passes: 1,
        quality: "excellent",
        characters: text.length,
        words: text.split(/\s+/).filter(Boolean).length,
        language: "structured"
      }
    }
  };
}

/* ============================================================
   Main field extraction
   ============================================================ */
function extractPatientFields(text) {
  const clean = normalizeText(text);
  const lines = clean.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const sections = segmentSections(lines);
  const joined = lines.join("\n");

  const name = pickName(lines, joined, sections);
  const age = pickAge(lines, joined, sections);
  const gender = pickGender(joined);
  const phone = pickPhone(lines, joined, sections);
  const diagnosis = pickDiagnosis(joined, sections);
  const dischargeDate = pickDate(joined, [...LABELS.dischargeDate]) || pickDate(joined, [...LABELS.admissionDate]);
  const doctor = pickDoctor(lines, joined, sections);
  const medicines = pickMedicines(joined, sections);
  const medicalHistory = pickHistory(joined, sections);
  const vitals = pickVitals(joined);

  return finalizePatient({
    name: name || "Unknown Patient",
    age,
    gender,
    phone,
    diagnosis: diagnosis || "Not clearly stated",
    dischargeDate,
    doctor,
    medicines,
    medicalHistory,
    vitals
  }, clean);
}

/* Split the document into labelled sections so medicine lines, for
   example, are not mistaken for diagnosis text. */
function segmentSections(lines) {
  const sections = {};
  let current = null;
  for (const line of lines) {
    const header = matchSectionHeader(line);
    if (header) {
      current = header;
      sections[current] = sections[current] || [];
      const inlineValue = line.replace(new RegExp(`^${escapeRegex(header)}\\s*[:\\-]?`, "i"), "").trim();
      if (inlineValue && inlineValue.length > 1) sections[current].push(inlineValue);
      continue;
    }
    if (current) sections[current].push(line);
  }
  return sections;
}

function matchSectionHeader(line) {
  const trimmed = line.replace(/^[#*•·\-–\s]+/, "").replace(/[:\-]+$/, "").trim();
  if (!trimmed || trimmed.length > 42) return null;
  const lower = trimmed.toLowerCase();
  for (const header of SECTION_HEADER_LINES) {
    if (lower === header || lower.replace(/\s+/g, " ") === header) return header;
  }
  /* "Rx : Tab ..." inline headers are handled by label matching instead */
  return null;
}

function labeledValue(lines, labels, joined) {
  for (const label of labels) {
    const escaped = escapeRegex(label);
    /* label and value on the same line */
    const inline = joined.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*(?:#|no\\.?|number|number:)?\\s*[:\\-–|]?\\s*([^\\n]+)`, "i"));
    if (inline && inline[1] && hasContent(inline[1])) return inline[1].trim();
    /* value on the following line */
    for (let i = 0; i < lines.length; i++) {
      if (new RegExp(`^${escaped}\\s*[:\\-–|]?$`, "i").test(lines[i].trim())) {
        const next = lines[i + 1];
        if (next && hasContent(next) && !isSectionHeaderLine(next)) return next.trim();
      }
    }
  }
  return "";
}

function hasContent(value) {
  const v = String(value).trim();
  if (!v) return false;
  if (/^[:\-–|\s]+$/.test(v)) return false;
  return v.replace(/[^a-z0-9]/gi, "").length >= 2;
}

function isSectionHeaderLine(line) {
  return SECTION_HEADER_LINES.includes(line.replace(/[:\-]+$/, "").trim().toLowerCase());
}

/* ---------- name ---------- */
function pickName(lines, joined, sections) {
  let value = labeledValue(lines, LABELS.name, joined);
  if (value) {
    /* cut anything that looks like a following label ("John Doe Age 45") */
    value = value.split(/\b(?:age|sex|gender|dob|phone|mobile|contact|dx|diagnosis|bed|ward|ipd|opd|uhid|date)\b/i)[0];
    value = cleanField(value).replace(/^(?:mr|mrs|ms|miss|master)\.?\s+/i, "");
  }
  if (!value) {
    const honorific = joined.match(/\b(?:mr|mrs|ms|master)\.?\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/);
    if (honorific) value = honorific[1];
  }
  if (!value) return "";
  const words = value.split(/\s+/).filter(w => /^[A-Za-z.'-]+$/.test(w)).slice(0, 4);
  return titleCase(words.join(" ")).trim();
}

/* ---------- age ---------- */
function pickAge(lines, joined, sections) {
  let value = labeledValue(lines, LABELS.age, joined);
  if (value) {
    const m = String(value).match(/(\d{1,3})\s*(?:y(?:ea)?rs?|y\/o|yo|y\b)?/i);
    if (m) return toInt(m[1]);
  }
  const patterns = [
    /\b(\d{1,3})\s*(?:years?|yrs?|y\/o)\s*(?:old\b)?/i,
    /\b(?:age[d]?)\s*(?:is|of)?\s*(\d{1,3})/i
  ];
  for (const p of patterns) {
    const m = joined.match(p);
    if (m) {
      const n = toInt(m[1]);
      if (n !== null && n > 0 && n < 130) return n;
    }
  }
  /* "45/M" or "M/45" shorthand */
  const slash = joined.match(/\b(?:([0-9]{1,3})\s*\/\s*[MFT])|(?:[MFT]\s*\/\s*([0-9]{1,3}))\b/i);
  if (slash) return toInt(slash[1] || slash[2]);
  const dob = joined.match(/(?:dob|date of birth)\s*[:\-]?\s*([^\n]+)/i);
  if (dob) {
    const year = String(dob[1]).match(/\b(19|20)\d{2}\b/);
    if (year) return new Date().getFullYear() - toInt(year[0]);
  }
  return null;
}

/* ---------- gender ---------- */
function pickGender(joined) {
  const m = joined.match(/\b(?:sex|gender)\s*[:\-]?\s*(male|female|other|m|f)\b/i)
    || joined.match(/\b(male|female)\b/i)
    || joined.match(/\b([MFT])\s*(?:\/|\|)\s*\d{1,3}\b/)
    || joined.match(/\b\d{1,3}\s*\/\s*([MFT])\b/);
  if (!m) return "";
  const v = (m[1] || "").toLowerCase();
  if (v.startsWith("m")) return "male";
  if (v.startsWith("f")) return "female";
  return v || "";
}

/* ---------- phone ---------- */
function pickPhone(lines, joined, sections) {
  const labeled = labeledValue(lines, LABELS.phone, joined);
  const candidates = [];
  if (labeled) candidates.push(labeled);

  /* any phone-shaped token in the document */
  const tokens = joined.match(/\+?\d[\d\s\-().]{8,18}\d/g) || [];
  candidates.push(...tokens);

  for (const candidate of candidates) {
    const phone = normalizePhone(candidate);
    if (phone) return phone;
  }
  return "";
}

function normalizePhone(value) {
  if (!value) return "";
  /* OCR reads 0 as O/o inside numbers — fix digits-only context */
  let text = String(value).replace(/[oO]/g, "0").replace(/[ilI|]/g, "1");
  let cleaned = text.replace(/[^\d+]/g, "");
  cleaned = cleaned.replace(/(?!^)\+/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return "";
  if (cleaned.startsWith("+")) return cleaned;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  if (digits.length === 10) return `+91${digits}`;
  return cleaned;
}

/* ---------- diagnosis ---------- */
function pickDiagnosis(joined, sections) {
  const labeled = labeledValue([], LABELS.diagnosis.filter(l => l !== "complaint" && l !== "complaints" && l !== "assessment" && l !== "impression"), joined)
    || labeledValue([], ["diagnosis", "final diagnosis", "provisional diagnosis", "dx", "impression", "disease", "condition", "admitted for", "reason for admission"], joined);
  if (labeled && hasContent(labeled) && !/^(?:as per|not|nil|—|-|unknown)/i.test(labeled.trim())) {
    return tidyDiagnosis(labeled);
  }
  const sectionKey = Object.keys(sections).find(k => /diagnos|dx|impression|disease|condition|complaint/.test(k));
  if (sectionKey && sections[sectionKey].length) {
    const body = sections[sectionKey].join(" ").trim();
    if (body && hasContent(body)) return tidyDiagnosis(body.split(/(?=\b(?:age|sex|phone|mobile|date)\b)/i)[0]);
  }
  const found = CONDITION_MAP.filter(([, re]) => re.test(joined)).map(([label]) => label);
  return found.length ? found.join(", ") : "Not clearly stated";
}

function tidyDiagnosis(value) {
  let v = cleanField(value).split(/\b(?:age|sex|gender|phone|mobile|contact|bed|ward|doctor|dr\b|date)\b/i)[0].trim();
  v = v.replace(/^[#*•·\-–\s]+/, "").replace(/[.,;]+$/, "");
  if (v.length > 160) v = `${v.slice(0, 157).trim()}…`;
  return titleCaseSmart(v) || "Not clearly stated";
}

/* ---------- dates ---------- */
function pickDate(joined, labels) {
  const labeled = labeledValue([], labels, joined);
  if (labeled) {
    const parsed = parseDate(labeled);
    if (parsed) return parsed;
  }
  /* scan for a date near the label keyword anywhere */
  for (const label of labels) {
    const escaped = escapeRegex(label);
    const m = joined.match(new RegExp(`${escaped}[^\\n]{0,24}`, "i"));
    if (m) {
      const parsed = parseDate(m[0]);
      if (parsed) return parsed;
    }
  }
  return "";
}

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";

function parseDate(value) {
  const clean = cleanField(value);
  if (!clean) return "";
  /* 12 Jan 2025 · 12th January 2025 · 12-Jan-2026 · 08.Sep.2026 */
  let m = clean.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s,./\\-]+(?:${MONTHS})[a-z]*[\\s,./\\-]+((?:19|20)\\d{2}|\\d{2})\\b`, "i"));
  if (m) return formatIso(m[2], monthNumberOf(m[0]), toInt(m[1]));
  /* Jan 12 2025 · January 12th, 2025 · Mar-15-2026 */
  m = clean.match(new RegExp(`\\b(?:${MONTHS})[a-z]*[\\s,./\\-]+(\\d{1,2})(?:st|nd|rd|th)?[\\s,./\\-]+((?:19|20)\\d{2}|\\d{2})\\b`, "i"));
  if (m) return formatIso(m[2], monthNumberOf(m[0]), toInt(m[1]));
  /* 12/05/2025 · 12-05-25 · 12.05.2025 */
  m = clean.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = `20${y}`;
    if (toInt(y) < 1990 || toInt(y) > 2035) return "";
    const day = toInt(a), month = toInt(b);
    if (day > 12 && month <= 12) return formatIso(y, month, day);
    if (month > 12 && day <= 12) return formatIso(y, day, month);
    /* ambiguous — Indian reports are dd/mm/yyyy */
    return formatIso(y, month, day);
  }
  /* 2025-05-12 */
  m = clean.match(/\b((?:19|20)\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return formatIso(m[1], toInt(m[2]), toInt(m[3]));
  const isoTry = new Date(clean);
  if (!Number.isNaN(isoTry.getTime()) && /\d{4}/.test(clean)) {
    /* use local calendar parts — toISOString shifts the day across timezones */
    return `${isoTry.getFullYear()}-${String(isoTry.getMonth() + 1).padStart(2, "0")}-${String(isoTry.getDate()).padStart(2, "0")}`;
  }
  return "";
}

function monthNumberOf(text) {
  const m = String(text).match(new RegExp(MONTHS, "i"));
  if (!m) return 0;
  const idx = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    .indexOf(m[0].slice(0, 3).toLowerCase());
  return idx + 1;
}

function formatIso(year, month, day) {
  if (!month || !day) return "";
  const y = String(year).length === 2 ? `20${year}` : year;
  if (toInt(month) < 1 || toInt(month) > 12 || toInt(day) < 1 || toInt(day) > 31) return "";
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/* ---------- doctor ---------- */
const GENERIC_TITLE_WORDS = new Set([
  "cardiologist", "physician", "surgeon", "pediatrician", "paediatrician", "neurologist",
  "orthopedic", "nephrologist", "dermatologist", "gynecologist", "medicine", "consultant",
  "resident", "registrar", "specialist", "doctor"
]);

function pickDoctor(lines, joined, sections) {
  let value = labeledValue(lines, LABELS.doctor, joined);
  if (value) value = value.split(/\b(?:age|sex|phone|mobile|date|reg(?:istration)?\.? no)\b/i)[0];
  if (!value || isGenericTitle(value)) {
    const m = joined.match(/\b(?:dr\.?|doctor)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/i);
    if (m) value = m[1];
  }
  if (!value || isGenericTitle(value)) return "";
  value = cleanField(value).replace(/^(?:dr\.?|doctor)\s+/i, "");
  const DEGREES = /^(md|ms|dnb|mch|dm|mbbs|frcs|frca)$/;
  const words = value.split(/\s+/)
    .filter(w => /^[A-Za-z.'-]+$/.test(w) && !DEGREES.test(w.toLowerCase()))
    .slice(0, 4);
  const name = words.join(" ");
  return name && !isGenericTitle(name) ? `Dr. ${titleCase(name)}` : "";
}

function isGenericTitle(value) {
  const words = String(value).toLowerCase().split(/\s+/).filter(Boolean);
  return words.length === 0 || words.every(w => GENERIC_TITLE_WORDS.has(w) || /^(md|ms|dnb|mch|dm|mbbs|frcs)$/.test(w));
}

/* ---------- history ---------- */
function pickHistory(joined, sections) {
  const labeled = labeledValue([], LABELS.history, joined);
  const sectionKey = Object.keys(sections).find(k => /history|comorbid|known case/.test(k));
  const body = labeled || (sectionKey ? sections[sectionKey].join(" ") : "");
  return splitList(body).slice(0, 8);
}

/* ============================================================
   Medicines — dictionary + dosage-form + frequency aware
   ============================================================ */
function pickMedicines(joined, sections) {
  const results = [];
  const seen = new Set();

  const add = chip => {
    const c = cleanMedicineChip(chip);
    if (!c || c.length < 4 || c.length > 120) return;
    if (!/\d/.test(c) && !DRUG_RE.test(c) && !DOSAGE_FORM.test(c)) return;
    const key = c.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return;
    seen.add(key);
    results.push(c);
  };

  /* 1. labelled medicine sections (Rx:, Medicines:, Prescription: …) */
  for (const label of LABELS.medicines) {
    const escaped = escapeRegex(label);
    const block = joined.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*[:\\-]?\\s*\\n?([\\s\\S]{0,1200}?)(?=(?:\\n\\s*[^\\n]{0,42}[:\\-]\\s*\\n)|$)`, "i"));
    if (block && block[1]) {
      block[1].split(/\n|;|(?:,\s*(?=\s*(?:tab|cap|syr|inj|tablet|capsule|syrup|injection)\b))/i)
        .forEach(part => {
          if (MED_LINE_HINT.test(part) || DRUG_RE.test(part)) add(part);
        });
    }
  }

  /* 2. any line anywhere that looks like a prescription line */
  joined.split(/\n|(?<=\))\s*;\s*/).forEach(line => {
    if (isSectionHeaderLine(line.trim())) return;
    /* "Rx: a, b, c" lines are handled by the labelled block parser above */
    if (/^\s*(rx|r\/x|medicines?|medications?|drugs?|prescription|treatment( given)?|advice)\s*[:\-]/i.test(line)) return;
    if (line.length > 140) return;
    if (/\b(?:diagnosis|history|vitals|address|hospital|symptom|complaint|doctor)\b/i.test(line) && !DRUG_RE.test(line)) return;
    const hasDrug = DRUG_RE.test(line);
    const hasDose = DOSAGE_FORM.test(line) || STRENGTH.test(line);
    if (hasDrug && (hasDose || FREQUENCY.test(line))) add(line);
    else if (DOSAGE_FORM.test(line) && /\d/.test(line)) add(line);
  });

  /* 3. bare drug names mentioned anywhere (no dose info) — last resort */
  if (results.length < 3) {
    const bare = joined.match(new RegExp(DRUG_RE.source, "gi")) || [];
    bare.forEach(word => add(word));
  }

  /* drop chips fully contained inside a richer chip ("Aspirin" vs "Tab Aspirin 75 mg OD") */
  const final = results.filter(chip => {
    const key = chip.toLowerCase();
    return !results.some(other => other !== chip && other.toLowerCase().includes(key));
  });
  return final.slice(0, 14);
}

function parseMedicineList(items) {
  const out = [];
  (items || []).forEach(item => {
    String(item).split(/\n|;|(?:,\s*(?=\s*(?:tab|cap|syr|inj|tablet|capsule|syrup|injection)\b))/i)
      .forEach(part => {
        const c = cleanMedicineChip(part);
        if (c && c.length >= 4) out.push(c);
      });
  });
  const deduped = [...new Map(out.map(c => [c.toLowerCase().replace(/[^a-z0-9]/g, ""), c])).values()];
  return deduped.slice(0, 14);
}

function cleanMedicineChip(chip) {
  let c = String(chip)
    .replace(/^[\s#*•·\-–\d.)\]]+/, "") /* numbering bullets */
    .replace(/\s+/g, " ")
    .replace(/\s*([.,;])\s*$/, "")
    .trim();
  /* cut trailing commentary ("… for 5 days, review sooner") keeps dose + frequency */
  if (c.length > 90) c = c.slice(0, 90);
  return c.replace(/\b(signature|reg no|licence|license)\b.*$/i, "").trim();
}

/* ---------- vitals ---------- */
function pickVitals(joined) {
  const vitals = {};
  const bp = joined.match(/(?:bp|blood pressure)\s*[:\-]?\s*(\d{2,3})\s*[/\\]\s*(\d{2,3})/i)
    || joined.match(/\b(\d{2,3})\s*[/\\]\s*(\d{2,3})\s*(?:mmhg)?\b/i);
  if (bp) {
    const sys = toInt(bp[1]), dia = toInt(bp[2]);
    if (sys >= 60 && sys <= 260 && dia >= 30 && dia <= 180) {
      vitals.bp = `${sys}/${dia}`;
      vitals.bpSystolic = sys;
      vitals.bpDiastolic = dia;
    }
  }
  const pulse = joined.match(/(?:pulse|heart rate|\bhr\b|\bpr\b)\s*[:\-]?\s*(\d{2,3})\s*(?:bpm)?/i);
  if (pulse) {
    const n = toInt(pulse[1]);
    if (n >= 30 && n <= 220) vitals.pulse = n;
  }
  const spo2 = joined.match(/(?:spo2|sp02|s\.?p0?2|o2 sat(?:uration)?|saturation)\s*[:\-]?\s*(\d{2,3})\s*%?/i);
  if (spo2) {
    const n = toInt(spo2[1]);
    if (n >= 50 && n <= 100) vitals.spo2 = n;
  }
  const temp = joined.match(/(?:temp(?:erature)?|fever)\s*[:\-]?\s*(\d{2,3}(?:\.\d)?)\s*°?\s*(?:f|c|far|cel)?/i);
  if (temp) {
    const n = Number(temp[1]);
    if (n >= 90 && n <= 111) vitals.temp = n;
  }
  const sugar = joined.match(/(?:rbs|fbs|ppbs|blood sugar|sugar|glucose)\s*(?:level)?\s*[:\-]?\s*(\d{2,3}(?:\.\d)?)/i);
  if (sugar) {
    const n = toInt(sugar[1]);
    if (n >= 30 && n <= 700) vitals.sugar = n;
  }
  const weight = joined.match(/(?:weight|\bwt\b)\s*[:\-]?\s*(\d{2,3}(?:\.\d)?)\s*kg/i);
  if (weight) {
    const n = Number(weight[1]);
    if (n >= 2 && n <= 300) vitals.weight = n;
  }
  return vitals;
}

/* ---------- finalize ---------- */
function finalizePatient(patient, text) {
  patient.name = cleanField(patient.name) || "Unknown Patient";
  patient.phone = normalizePhone(patient.phone) || process.env.DEMO_DEFAULT_PHONE || "";
  if (!patient.diagnosis) patient.diagnosis = inferDiagnosis(text || "");
  if (!Array.isArray(patient.medicines)) patient.medicines = [];
  if (!Array.isArray(patient.medicalHistory)) patient.medicalHistory = [];
  if (!patient.vitals) patient.vitals = {};
  return patient;
}

/* ---------- shared helpers ---------- */

/* Read a PDF's embedded text layer directly with pdfjs (page by page). */
async function extractSelectablePdfText(buffer, maxPages = 8) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(buffer);
    const document = await pdfjs.getDocument({ data, disableWorker: true }).promise;
    const pageCount = Math.min(document.numPages || 1, maxPages);
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const content = await (await document.getPage(pageNumber)).getTextContent();
      let pageText = "";
      for (const item of content.items) {
        pageText += item.str;
        pageText += item.hasEOL ? "\n" : " ";
      }
      pages.push(pageText);
    }
    return pages.join("\n");
  } catch (_error) {
    return "";
  }
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2022\u00B7\u25CF\u25AA\u2726]/g, "-")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstMatch(text, regexes) {
  for (const regex of regexes) {
    const match = text.match(regex);
    if (match && match[1]) return match[1].trim();
  }
  return "";
}

function cleanField(value) {
  return String(value || "").replace(/\s+/g, " ").replace(/[|]+$/g, "").trim();
}

function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value) {
  return String(value || "")
    .split(/,|;|\band\b/i)
    .map(item => cleanField(item))
    .filter(item => item.length > 2 && !/^(?:nil|none|no|not known|na)$/i.test(item))
    .slice(0, 10);
}

function inferDiagnosis(text) {
  const conditions = CONDITION_MAP.filter(([, regex]) => regex.test(text)).map(([label]) => label);
  return conditions.join(", ") || "Not clearly stated";
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?${}()|[\]\\]/g, "\\$&");
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

/* Title-case that keeps units/dosages intact ("Tab Aspirin 75 MG OD" → "Tab Aspirin 75mg OD" handled loosely) */
function titleCaseSmart(value) {
  return String(value || "")
    .split(/\s+/)
    .map(word => {
      if (/^\d/.test(word) || /^(mg|mcg|ml|iu|od|bd|tds|qid|hs|sos|q\d.*)$/i.test(word)) return word;
      if (/^[A-Z]{2,6}$/.test(word)) return word; /* acronyms: CKD, MI, TB */
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

module.exports = { extractDocument, extractPatientFields };
