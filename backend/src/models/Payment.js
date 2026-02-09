const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    bill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      default: null,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer reference is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: 0.01,
    },
    mode: {
      type: String,
      required: [true, 'Payment mode is required'],
      enum: ['Cash', 'UPI', 'Bank', 'Cheque'],
    },
    referenceNumber: {
      type: String,
      trim: true, // cheque number, UPI ref, etc.
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
