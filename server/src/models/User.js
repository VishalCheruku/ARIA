const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ["admin", "clinician", "care_coordinator", "member"],
      default: "member"
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active"
    },
    lastLoginAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
