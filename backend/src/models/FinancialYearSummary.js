const mongoose = require('mongoose');

const customerSnapshotSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    customerName: { type: String, required: true },
    totalBilled: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    closingBalance: { type: Number, default: 0 }, // due at FY end
  },
  { _id: false }
);

const financialYearSummarySchema = new mongoose.Schema(
  {
    financialYear: {
      type: String,
      required: true,
      unique: true,
      index: true,
      // Format: "2024-2025"
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalSales: {
      type: Number,
      default: 0,
    },
    totalPurchases: {
      type: Number,
      default: 0,
    },
    totalPaymentsReceived: {
      type: Number,
      default: 0,
    },
    totalSupplierPayments: {
      type: Number,
      default: 0,
    },
    totalSalaryExpense: {
      type: Number,
      default: 0,
    },
    totalAdvances: {
      type: Number,
      default: 0,
    },
    totalCustomExpenses: {
      type: Number,
      default: 0,
    },
    outstandingDue: {
      type: Number,
      default: 0,
    },
    billCount: { type: Number, default: 0 },
    paymentCount: { type: Number, default: 0 },
    purchaseCount: { type: Number, default: 0 },
    attendanceCount: { type: Number, default: 0 },
    advanceCount: { type: Number, default: 0 },
    salaryRecordCount: { type: Number, default: 0 },
    stockLogCount: { type: Number, default: 0 },
    activityLogCount: { type: Number, default: 0 },
    supplierPaymentCount: { type: Number, default: 0 },
    customExpenseCount: { type: Number, default: 0 },
    customerSnapshots: [customerSnapshotSchema],
    isDeleted: {
      type: Boolean,
      default: false,
      // Set to true after data deletion is completed
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FinancialYearSummary', financialYearSummarySchema);
