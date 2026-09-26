const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    patient: Object,
    extractedText: String,
    risk: Object,
    routedContact: String,
    sms: Object,
    call: Object,
    dispatch: {
      status: String,
      dispatchedAt: String,
      token: String
    },
    monitoring: {
      days: Number,
      startedAt: String,
      schedule: [Object]
    },
    timeline: [Object],
    uploadedBy: String,
    file: {
      originalName: String,
      storedName: String,
      size: Number,
      mimetype: String
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", reportSchema);
