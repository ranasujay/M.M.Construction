const mongoose = require('mongoose');

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
  },
  {
    timestamps: true,
  }
);

workerSchema.index({ name: 'text', phone: 'text' });
workerSchema.index({ isActive: 1 });
workerSchema.index({ role: 1 });

module.exports = mongoose.model('Worker', workerSchema);
