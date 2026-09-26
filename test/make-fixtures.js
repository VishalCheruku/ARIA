/* Generates test fixtures for the ARIA OCR pipeline: two PNGs (clean +
   noisy), one TXT, one JSON and one selectable-text PDF. */
const fs = require("fs");
const path = require("path");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

const outDir = path.join(__dirname, "fixtures");
fs.mkdirSync(outDir, { recursive: true });

try { GlobalFonts.registerFromPath("C:\\Windows\\Fonts\\arial.ttf", "Arial"); }
catch { try { GlobalFonts.registerFromPath("C:\\Windows\\Fonts\\calibri.ttf", "Arial"); } catch {} }

const REPORT = [
  ["CITY CARE HOSPITAL - DISCHARGE SUMMARY", "bold 30px Arial"],
  ["", null],
  ["Patient Name : Meera Nair", "26px Arial"],
  ["Age / Sex : 63 Years / Female", "26px Arial"],
  ["Contact No : +91 98470 11223", "26px Arial"],
  ["Date of Admission : 02/09/2026", "26px Arial"],
  ["Date of Discharge : 08 Sep 2026", "26px Arial"],
  ["Treating Doctor : Dr. Arun Prasad", "26px Arial"],
  ["", null],
  ["Diagnosis : Type 2 Diabetes Mellitus with Cellulitis of left leg", "26px Arial"],
  ["", null],
  ["Vitals at discharge :", "bold 26px Arial"],
  ["BP : 148/90 mmHg   Pulse : 96 bpm   SpO2 : 95%", "26px Arial"],
  ["Temp : 100.8 F   Sugar (RBS) : 246 mg/dl   Weight : 74 kg", "26px Arial"],
  ["", null],
  ["Rx :", "bold 26px Arial"],
  ["1. Tab Metformin 500 mg - twice daily", "26px Arial"],
  ["2. Tab Linagliptin 5 mg - once daily", "26px Arial"],
  ["3. Tab Pantoprazole 40 mg - once daily before food", "26px Arial"],
  ["4. Cap Amoxicillin 500 mg - three times daily", "26px Arial"],
  ["5. Insulin Mixtard 20 units in morning, 14 units at night", "26px Arial"],
  ["", null],
  ["Past History : Diabetes since 12 years, Hypertension", "26px Arial"],
  ["Advice : Review after 7 days with fasting sugar report.", "26px Arial"]
];

function drawReport(noisy) {
  const canvas = createCanvas(1050, 1150);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = noisy ? "#d8d2c6" : "#ffffff";
  ctx.fillRect(0, 0, 1050, 1150);
  if (noisy) {
    for (let i = 0; i < 3200; i++) {
      ctx.fillStyle = `rgba(60,55,45,${(Math.random() * .3).toFixed(2)})`;
      ctx.fillRect(Math.random() * 1050, Math.random() * 1150, 1 + Math.random() * 6, 1 + Math.random() * 3);
    }
    ctx.fillStyle = "rgba(80,70,60,.16)";
    ctx.fillRect(0, 292, 1050, 2);
    ctx.fillRect(130, 0, 2, 1150);
  }
  let y = 64;
  for (const [text, font] of REPORT) {
    if (text) {
      ctx.font = font;
      ctx.fillStyle = noisy ? "#332b1d" : "#141414";
      ctx.fillText(text, 60, y);
    }
    y += 42;
  }
  return canvas;
}

fs.writeFileSync(path.join(outDir, "clean-report.png"), drawReport(false).toBuffer("image/png"));
fs.writeFileSync(path.join(outDir, "noisy-report.png"), drawReport(true).toBuffer("image/png"));
console.log("PNG fixtures written");

fs.writeFileSync(path.join(outDir, "narrative-report.txt"), `
SUNRISE MULTISPECIALITY HOSPITAL
IP DISCHARGE SUMMARY

Name: Mr. Rajesh Pillai
Age/Sex: 58/M
Mobile: 098450-66778
UHID: SH-2026-11452
DOA: 21-Aug-2026
DOD: 27-Aug-2026

FINAL DIAGNOSIS : Acute inferior wall myocardial infarction with Type 2 Diabetes Mellitus

Past history : Hypertension since 8 years, smoker

VITALS ON DISCHARGE
BP 132/84 mmHg, PR 82/min, Sp02 97%, Temp 98.6 F

TREATMENT GIVEN
1) Tab Ecospirin 75 mg OD
2) Tab Atorvastatin 40 mg HS
3) Tab Clopidogrel 75 mg OD
4) Tab Metoprolol 25 mg BD
5) Inj Enoxaparin 40 mg SC BD
6) Tab Pantoprazole 40 mg OD

ADVICE
Continue medicines, review cardiology OPD after 1 week.

Dr. Harish Chandra
MD (Medicine), Consultant Cardiologist
`);

fs.writeFileSync(path.join(outDir, "structured-report.json"), JSON.stringify({
  record: {
    patientName: "Devika Rao",
    yearsOld: 47,
    contactNumber: "98220 33445",
    diagnosisText: "Bronchial asthma with acute exacerbation",
    consultant: "Dr. S. Iyer",
    dischargedOn: "15-Mar-2026",
    medicationList: [
      "Tab Montelukast 10 mg HS",
      "Inj Budesonide 0.5 mg nebulisation BD",
      "Tab Levocetirizine 5 mg OD"
    ]
  }
}, null, 2));

/* minimal valid selectable-text PDF */
function buildPdf(lines) {
  const objects = [];
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objects[2] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>";
  let stream = `BT /F1 13 Tf 60 720 Td (${lines[0].replace(/([()\\])/g, "\\$1")}) Tj`;
  for (const line of lines.slice(1)) {
    stream += ` 0 -22 Td (${line.replace(/([()\\])/g, "\\$1")}) Tj`;
  }
  stream += " ET";
  objects[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

fs.writeFileSync(path.join(outDir, "digital-report.pdf"), buildPdf([
  "ARIA TEST DISCHARGE NOTE",
  "Patient: Kamala Devi",
  "Age: 71 years Female",
  "Diagnosis: Pneumonia with mild sepsis",
  "Discharge Date: 05/09/2026",
  "Rx: Tab Azithromycin 500 mg OD, Tab Paracetamol 650 mg SOS"
]));

console.log("All fixtures written to", outDir);
