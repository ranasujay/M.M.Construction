const mongoose = require('mongoose');

const rawMaterialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Raw material name is required'],
      trim: true,
      maxlength: 200,
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      enum: ['kg', 'piece', 'meter', 'sqft', 'rft', 'foot'],
      default: 'kg',
    },
    currentStock: {
      type: Number,
      default: 0,
      // Intentionally NO min — stock can go negative
    },
    minimumStockAlert: {
      type: Number,
      default: 0,
      min: 0,
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

rawMaterialSchema.index({ name: 1 }, { unique: true });
rawMaterialSchema.index({ isActive: 1 });

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);
