const demoPolicy = new Map([
  ["asha devi", "HIGH"],
  ["ravi kumar", "MEDIUM"],
  ["meena joseph", "HIGH"],
  ["vikram singh", "LOW"],
  ["surya", "HIGH"],
  ["vikas", "HIGH"]
]);

function assessRisk(patient, extractedText) {
  const normalizedName = String(patient.name || "").trim().toLowerCase();
  const policyRisk = demoPolicy.get(normalizedName);
  const text = `${extractedText}\n${JSON.stringify(patient)}`.toLowerCase();

  let score = 18;
  const factors = [];

  if (patient.age >= 65) add(18, "Age 65 or above");
  if (/heart failure|chf|stroke|sepsis|copd|pneumonia|renal|ckd|kidney|cancer|infarction/.test(text)) add(22, "High-risk diagnosis");
  if (/diabetes|hypertension|asthma|coronary|cad|kidney/.test(text)) add(12, "Chronic condition present");
  if (/prior admission|readmission|admitted.*again|icu|emergency/.test(text)) add(18, "Prior admission or urgent care signal");
  if (/non[- ]?adherence|missed dose|poor compliance|no family support|lives alone/.test(text)) add(16, "Adherence or support concern");
  if (/breathless|chest pain|fever|confusion|swelling|bleeding|warning sign|urgent/.test(text)) add(20, "Urgent warning signs found");
  if ((patient.medicines || []).length >= 5) add(10, "Multiple medicines");
  if (/insulin|warfarin|apixaban|clopidogrel|furosemide|steroid/.test(text)) add(10, "High-monitoring medicine");

  /* abnormal vitals recorded in the document */
  const vitals = patient.vitals || {};
  if (vitals.bpSystolic >= 150 || vitals.bpDiastolic >= 95) add(12, "High blood pressure recorded");
  if (vitals.spo2 && vitals.spo2 < 94) add(16, "Low oxygen saturation recorded");
  if (vitals.temp >= 100) add(14, "Fever recorded in vitals");
  if (vitals.sugar >= 200) add(10, "High blood sugar recorded");

  let level = score >= 70 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW";

  if (policyRisk) {
    level = policyRisk;
    factors.unshift(`Demo patient policy: ${patient.name} is ${policyRisk} risk`);
    score = policyRisk === "HIGH" ? Math.max(score, 82) : policyRisk === "MEDIUM" ? Math.max(55, Math.min(score, 69)) : Math.min(score, 32);
  }

  return {
    level,
    score: Math.max(1, Math.min(100, score)),
    factors: factors.length ? factors : ["No major red flags detected in the uploaded document"],
    recommendation: recommendationFor(level),
    carePlan: carePlanFor(level),
    /* voice calls go out for MEDIUM and HIGH risk; LOW gets SMS monitoring only */
    requiresCall: level === "HIGH" || level === "MEDIUM"
  };

  function add(points, factor) {
    score += points;
    factors.push(factor);
  }
}

function recommendationFor(level) {
  if (level === "HIGH") return "Call patient/caregiver today, verify medication adherence, and alert care team for follow-up.";
  if (level === "MEDIUM") return "Call the patient now, send SMS confirmation, and schedule a nurse follow-up within 24-48 hours.";
  return "Continue SMS monitoring and routine preventive-care reminders.";
}

function carePlanFor(level) {
  if (level === "HIGH") {
    return [
      "Nurse call today",
      "Doctor dashboard alert",
      "Family/caregiver escalation if symptoms worsen",
      "Medication adherence check twice daily for 3 days"
    ];
  }

  if (level === "MEDIUM") {
    return [
      "Voice call + SMS reminder now",
      "Nurse follow-up within 24-48 hours",
      "Medication confirmation prompt",
      "Warning-sign monitoring for 7 days"
    ];
  }

  return [
    "SMS monitoring",
    "Routine medication reminder",
    "Preventive-care check-in after 7 days",
    "No voice call required"
  ];
}

module.exports = { assessRisk };
