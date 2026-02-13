const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    rawMaterial: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RawMaterial',
      required: true,
    },
    materialName: {
      type: String,
      required: true, // snapshot at purchase time
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: 0.01,
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'piece', 'meter', 'sqft', 'rft', 'foot'],
    },
    ratePerUnit: {
      type: Number,
      required: [true, 'Rate per unit is required'],
      min: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const purchaseBillSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    supplierName: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: 200,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    purchaseDate: {
      type: Date,
      required: [true, 'Purchase date is required'],
      default: Date.now,
    },
    items: {
      type: [purchaseItemSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: 'At least one item is required',
      },
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    loadingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    carryingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ─── Payment Tracking (mirrors Bill model) ──────────────
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    dueAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['PAID', 'PARTIAL', 'DUE'],
      default: 'DUE',
    },
    // ─────────────────────────────────────────────────────────
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
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

// Auto-calculate item totals and grand total before validation
purchaseBillSchema.pre('validate', function (next) {
  this.items.forEach((item) => {
    item.totalCost = Math.round(item.quantity * item.ratePerUnit * 100) / 100;
  });
  const itemsTotal = this.items.reduce((sum, item) => sum + item.totalCost, 0);
  const extras = (this.loadingCost || 0) + (this.carryingCost || 0);
  const disc = this.discount || 0;
  this.grandTotal = Math.round((itemsTotal + extras - disc) * 100) / 100;

  // Calculate payment status
  if (this.isNew) {
    this.totalPaid = this.paidAmount || 0;
  }
  this.dueAmount = Math.round((this.grandTotal - this.totalPaid) * 100) / 100;
  if (this.dueAmount < 0) this.dueAmount = 0;

  if (this.dueAmount === 0 && this.grandTotal > 0) {
    this.paymentStatus = 'PAID';
  } else if (this.totalPaid > 0) {
    this.paymentStatus = 'PARTIAL';
  } else {
    this.paymentStatus = 'DUE';
  }

  next();
});

purchaseBillSchema.index({ createdAt: -1 });
purchaseBillSchema.index({ supplierName: 1 });

module.exports = mongoose.model('PurchaseBill', purchaseBillSchema);
