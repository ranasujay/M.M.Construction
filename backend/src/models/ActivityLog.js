const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        'BILL_CREATED',
        'BILL_UPDATED',
        'BILL_DELETED',
        'PAYMENT_ADDED',
        'PAYMENT_DELETED',
        'CUSTOMER_CREATED',
        'CUSTOMER_UPDATED',
        'PRODUCT_CREATED',
        'PRODUCT_UPDATED',
        'PRODUCT_PRICE_CHANGED',
        'PROMISE_CREATED',
        'PROMISE_UPDATED',
        'DUE_ADJUSTED',
        'PROMISE_FULFILLED',
        'USER_LOGIN',
        'USER_CREATED',
        'USER_STATUS_CHANGED',
        'USER_CREDENTIALS_UPDATED',
      ],
    },
    entity: {
      type: String,
      required: true,
      enum: ['bill', 'payment', 'customer', 'product', 'promise', 'user'],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ entity: 1, entityId: 1 });
activityLogSchema.index({ performedBy: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
