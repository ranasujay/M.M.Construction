const mongoose = require('mongoose');

const backupRecordSchema = new mongoose.Schema(
  {
    financialYear: {
      type: String,
      required: true,
      index: true,
      // Format: "2024-2025"
    },
    fileName: {
      type: String,
      required: true,
    },
    localPath: {
      type: String,
      default: '',
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
    },
    backupDate: {
      type: Date,
      default: Date.now,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
      // Set true when owner confirms they downloaded the backup
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

backupRecordSchema.index({ financialYear: 1, verified: 1 });

module.exports = mongoose.model('BackupRecord', backupRecordSchema);
