const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      maxlength: 200,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      unique: true,
      index: true,
    },
    altPhone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: 500,
    },
    // Denormalized ledger summary — updated on every bill/payment action
    totalBilled: {
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
      min: 0,
    },
    advanceBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Promise tracking
    nextPromiseDate: {
      type: Date,
      default: null,
    },
    nextPromiseAmount: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    // Opening balance — pre-existing dues when customer was first added
    openingBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Text index for search
customerSchema.index({ name: 'text', phone: 'text' });
customerSchema.index({ currentDue: -1 });

module.exports = mongoose.model('Customer', customerSchema);
