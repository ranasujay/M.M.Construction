const mongoose = require('mongoose');

const rateHistorySchema = new mongoose.Schema(
  {
    dailyWage: { type: Number, default: 0, min: 0 },
    monthlySalary: { type: Number, default: 0, min: 0 },
    overtimeRate: { type: Number, default: 0, min: 0 },
    effectiveFrom: { type: Date, required: true },
  },
  { _id: false }
);

const workerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Worker name is required'],
      trim: true,
      maxlength: 200,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 15,
    },
    role: {
      type: String,
      required: [true, 'Worker role is required'],
      enum: ['Welder', 'Fitter', 'Helper', 'Painter', 'Mason', 'Electrician', 'Supervisor', 'Other'],
      default: 'Helper',
    },
    salaryType: {
      type: String,
      required: [true, 'Salary type is required'],
      enum: ['Daily', 'Monthly'],
      default: 'Daily',
    },
    dailyWage: {
      type: Number,
      default: 0,
      min: 0,
    },
    monthlySalary: {
      type: Number,
      default: 0,
      min: 0,
    },
    overtimeRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Rate change history — each entry records what rate was active from what date
    rateHistory: [rateHistorySchema],
  },
  {
    timestamps: true,
  }
);

/**
 * Helper: get the applicable rate for a specific date
 * Looks through rateHistory (sorted by effectiveFrom) and returns
 * the last entry where effectiveFrom <= the given date.
 * Falls back to the current worker rates if no history exists.
 */
workerSchema.methods.getRateForDate = function (date) {
  if (!this.rateHistory || this.rateHistory.length === 0) {
    return {
      dailyWage: this.dailyWage,
      monthlySalary: this.monthlySalary,
      overtimeRate: this.overtimeRate,
    };
  }

  const sorted = [...this.rateHistory].sort(
    (a, b) => new Date(a.effectiveFrom) - new Date(b.effectiveFrom)
  );

  let applicable = {
    dailyWage: this.dailyWage,
    monthlySalary: this.monthlySalary,
    overtimeRate: this.overtimeRate,
  };

  for (const entry of sorted) {
    if (new Date(entry.effectiveFrom) <= new Date(date)) {
      applicable = {
        dailyWage: entry.dailyWage,
        monthlySalary: entry.monthlySalary,
        overtimeRate: entry.overtimeRate,
      };
    }
  }

  return applicable;
};

workerSchema.index({ name: 'text', phone: 'text' });
workerSchema.index({ isActive: 1 });
workerSchema.index({ role: 1 });

module.exports = mongoose.model('Worker', workerSchema);
