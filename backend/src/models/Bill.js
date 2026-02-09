const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true, // snapshot at billing time
    },
    category: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity / weight is required'],
      min: 0.01,
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'sqft', 'piece', 'rft'],
    },
    rate: {
      type: Number,
      required: [true, 'Rate is required'],
      min: 0,
    },
    fittingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    fittingChargeType: {
      type: String,
      enum: ['per_kg', 'per_sqft', 'per_piece', 'fixed'],
      default: 'per_kg',
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const billSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required'],
      index: true,
    },
    items: {
      type: [lineItemSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: 'At least one line item is required',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['flat', 'percent'],
      default: 'flat',
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    advancePayment: {
      type: Number,
      default: 0,
      min: 0,
    },
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
    deliveryDate: {
      type: Date,
      default: null,
    },
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

// Calculate line totals and bill totals before validation
billSchema.pre('validate', function (next) {
  // Calculate each line item total
  this.items.forEach((item) => {
    const baseAmount = item.quantity * item.rate;
    let fittingAmount = 0;

    if (item.fittingCharge > 0) {
      switch (item.fittingChargeType) {
        case 'per_kg':
        case 'per_sqft':
        case 'per_piece':
          fittingAmount = item.quantity * item.fittingCharge;
          break;
        case 'fixed':
          fittingAmount = item.fittingCharge;
          break;
      }
    }

    item.lineTotal = Math.round((baseAmount + fittingAmount) * 100) / 100;
  });

  // Calculate subtotal
  this.subtotal =
    Math.round(this.items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;

  // Calculate grand total after discount
  let discountAmount = 0;
  if (this.discountType === 'percent') {
    discountAmount = (this.subtotal * this.discount) / 100;
  } else {
    discountAmount = this.discount;
  }
  this.grandTotal = Math.round((this.subtotal - discountAmount) * 100) / 100;
  if (this.grandTotal < 0) this.grandTotal = 0;

  // Calculate due
  // Only set totalPaid from advance on NEW bills (isNew), not on updates
  if (this.isNew) {
    this.totalPaid = this.advancePayment;
  }
  this.dueAmount = Math.round((this.grandTotal - this.totalPaid) * 100) / 100;
  if (this.dueAmount < 0) this.dueAmount = 0;

  // Set payment status
  if (this.dueAmount === 0) {
    this.paymentStatus = 'PAID';
  } else if (this.totalPaid > 0) {
    this.paymentStatus = 'PARTIAL';
  } else {
    this.paymentStatus = 'DUE';
  }

  next();
});

billSchema.index({ createdAt: -1 });
billSchema.index({ paymentStatus: 1 });
billSchema.index({ createdBy: 1 });

module.exports = mongoose.model('Bill', billSchema);
