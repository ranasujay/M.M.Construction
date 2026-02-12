const mongoose = require('mongoose');

const stockLogSchema = new mongoose.Schema(
  {
    rawMaterial: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RawMaterial',
      required: true,
      index: true,
    },
    changeType: {
      type: String,
      required: true,
      enum: ['PURCHASE', 'SALE', 'MANUAL_ADJUSTMENT'],
    },
    quantityChanged: {
      type: Number,
      required: true,
      // Can be positive (purchase) or negative (sale/adjustment)
    },
    balanceAfter: {
      type: Number,
      // Stock level after this change
    },
    relatedDocument: {
      type: mongoose.Schema.Types.ObjectId,
      // Could be a PurchaseBill _id or Bill _id
    },
    relatedDocumentType: {
      type: String,
      enum: ['PurchaseBill', 'Bill', null],
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

stockLogSchema.index({ createdAt: -1 });
stockLogSchema.index({ changeType: 1 });

module.exports = mongoose.model('StockLog', stockLogSchema);
