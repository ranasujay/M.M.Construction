const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['Grill', 'Shutter', 'Railing', 'Window', 'Gate', 'Custom'],
    },
    baseRate: {
      type: Number,
      required: [true, 'Base rate is required'],
      min: 0,
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      enum: ['kg', 'sqft', 'piece', 'rft'],
      default: 'kg',
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
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });

module.exports = mongoose.model('Product', productSchema);
