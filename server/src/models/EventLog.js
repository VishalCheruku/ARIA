const mongoose = require("mongoose");

const eventLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["sms", "call", "family_alert", "doctor_alert", "medication_reply"],
      required: true
    },
    patientName: String,
    phone: String,
    riskLevel: String,
    status: String,
    message: String,
    providerId: String,
    metadata: Object
  },
  { timestamps: true }
);

module.exports = mongoose.model("EventLog", eventLogSchema);
