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
      trim: true,
    },
    baseRate: {
      type: Number,
      required: [true, 'Base rate is required'],
      min: 0,
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      enum: ['kg', 'sqft', 'piece', 'rft', 'meter', 'foot'],
      default: 'kg',
    },
    fittingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    fittingChargeType: {
      type: String,
      enum: ['per_kg', 'per_sqft', 'per_piece', 'per_rft', 'per_meter', 'per_foot', 'fixed'],
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
    materialConsumption: [
      {
        rawMaterial: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'RawMaterial',
          required: true,
        },
        quantityPerUnit: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ name: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Product', productSchema);
