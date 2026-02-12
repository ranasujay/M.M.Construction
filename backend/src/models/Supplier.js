const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: 200,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    // Denormalized ledger summary — updated on every purchase/payment action
    totalPurchased: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentDue: {
      type: Number,
      default: 0,
      // Can be negative (advance given to supplier)
    },
    advanceBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Opening balance — pre-existing dues when supplier was first added
    openingBalance: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
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

supplierSchema.index({ name: 1 }, { unique: true });
supplierSchema.index({ isActive: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
