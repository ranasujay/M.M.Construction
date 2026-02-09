const mongoose = require('mongoose');

const promiseSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    bill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      default: null,
    },
    promiseDate: {
      type: Date,
      required: [true, 'Promise date is required'],
    },
    promisedAmount: {
      type: Number,
      required: [true, 'Promised amount is required'],
      min: 0.01,
    },
    status: {
      type: String,
      enum: ['pending', 'fulfilled', 'overdue', 'broken'],
      default: 'pending',
    },
    fulfilledDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
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

promiseSchema.index({ promiseDate: 1 });
promiseSchema.index({ status: 1 });

module.exports = mongoose.model('Promise', promiseSchema);
