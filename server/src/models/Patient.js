const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    name: String,
    age: Number,
    phone: String,
    diagnosis: String,
    medicalHistory: [String],
    medicines: [String],
    dischargeDate: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
