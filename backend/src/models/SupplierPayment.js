const mongoose = require('mongoose');

const supplierPaymentSchema = new mongoose.Schema(
  {
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: [true, 'Supplier is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: 0.01,
    },
    mode: {
      type: String,
      enum: ['Cash', 'UPI', 'Bank', 'Cheque'],
      default: 'Cash',
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

supplierPaymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SupplierPayment', supplierPaymentSchema);
