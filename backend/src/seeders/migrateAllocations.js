/**
 * Migration Script: Backfill Payment Allocations
 *
 * This script migrates existing Payment and SupplierPayment documents
 * from the legacy single-bill reference to the new allocations array format.
 * It also backfills PurchaseBill totalPaid/dueAmount/paymentStatus fields.
 *
 * Run once after deploying the schema changes:
 *   cd backend && node src/seeders/migrateAllocations.js
 *
 * Safe to re-run — it only processes documents that haven't been migrated yet.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config');
const Payment = require('../models/Payment');
const SupplierPayment = require('../models/SupplierPayment');
const Bill = require('../models/Bill');
const PurchaseBill = require('../models/PurchaseBill');

async function migrate() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB\n');

    // ────────────────────────────────────────────────────────────
    // 1. Migrate Customer Payments
    // ────────────────────────────────────────────────────────────
    console.log('=== Migrating Customer Payments ===');

    const payments = await Payment.find({
      $or: [
        { allocations: { $exists: false } },
        { allocations: { $size: 0 } },
      ],
    });

    let custMigrated = 0;
    let custOnAccount = 0;

    for (const payment of payments) {
      const update = {};

      if (payment.bill) {
        // Legacy: single bill reference → convert to allocations
        update.allocations = [{ bill: payment.bill, amount: payment.amount }];
        update.unallocatedAmount = 0;
        custMigrated++;
      } else {
        // No bill → on-account / advance payment
        update.allocations = [];
        update.unallocatedAmount = payment.amount;
        custOnAccount++;
      }

      await Payment.updateOne({ _id: payment._id }, { $set: update });
    }

    console.log(`  Payments with bill allocation: ${custMigrated}`);
    console.log(`  On-account payments: ${custOnAccount}`);
    console.log(`  Total processed: ${payments.length}\n`);

    // Recalculate bill payment statuses from allocations
    console.log('=== Recalculating Bill Payment Statuses ===');
    const allBills = await Bill.find({});
    let billsUpdated = 0;

    for (const bill of allBills) {
      // Sum all allocations pointing to this bill
      const result = await Payment.aggregate([
        { $unwind: '$allocations' },
        { $match: { 'allocations.bill': bill._id } },
        { $group: { _id: null, total: { $sum: '$allocations.amount' } } },
      ]);

      const allocatedTotal = result.length > 0 ? result[0].total : 0;

      // Also count legacy payments that haven't been migrated
      // (shouldn't remain after migration, but just in case)
      const legacySum = await Payment.aggregate([
        {
          $match: {
            bill: bill._id,
            $or: [
              { allocations: { $exists: false } },
              { allocations: { $size: 0 } },
            ],
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const legacyTotal = legacySum.length > 0 ? legacySum[0].total : 0;

      const totalPaid = Math.round((allocatedTotal + legacyTotal + (bill.advancePayment || 0)) * 100) / 100;
      const dueAmount = Math.max(0, Math.round((bill.grandTotal - totalPaid) * 100) / 100);
      const paymentStatus = dueAmount <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'DUE';

      if (bill.totalPaid !== totalPaid || bill.dueAmount !== dueAmount || bill.paymentStatus !== paymentStatus) {
        await Bill.updateOne(
          { _id: bill._id },
          { $set: { totalPaid, dueAmount, paymentStatus } }
        );
        billsUpdated++;
      }
    }
    console.log(`  Bills recalculated: ${billsUpdated} / ${allBills.length}\n`);

    // ────────────────────────────────────────────────────────────
    // 2. Migrate Supplier Payments
    // ────────────────────────────────────────────────────────────
    console.log('=== Migrating Supplier Payments ===');

    const sPayments = await SupplierPayment.find({
      $or: [
        { allocations: { $exists: false } },
        { allocations: { $size: 0 } },
      ],
    });

    let suppMigrated = 0;
    let suppOnAccount = 0;

    for (const sp of sPayments) {
      const update = {};

      if (sp.purchaseBill) {
        update.allocations = [{ purchaseBill: sp.purchaseBill, amount: sp.amount }];
        update.unallocatedAmount = 0;
        suppMigrated++;
      } else {
        update.allocations = [];
        update.unallocatedAmount = sp.amount;
        suppOnAccount++;
      }

      await SupplierPayment.updateOne({ _id: sp._id }, { $set: update });
    }

    console.log(`  Supplier payments with bill allocation: ${suppMigrated}`);
    console.log(`  On-account supplier payments: ${suppOnAccount}`);
    console.log(`  Total processed: ${sPayments.length}\n`);

    // ────────────────────────────────────────────────────────────
    // 3. Backfill PurchaseBill payment tracking fields
    // ────────────────────────────────────────────────────────────
    console.log('=== Backfilling PurchaseBill Payment Status ===');

    const allPurchases = await PurchaseBill.find({});
    let purchasesUpdated = 0;

    for (const pb of allPurchases) {
      // Sum all allocations pointing to this purchase bill
      const result = await SupplierPayment.aggregate([
        { $unwind: '$allocations' },
        { $match: { 'allocations.purchaseBill': pb._id } },
        { $group: { _id: null, total: { $sum: '$allocations.amount' } } },
      ]);

      const allocatedTotal = result.length > 0 ? result[0].total : 0;

      // Also count legacy supplier payments
      const legacySum = await SupplierPayment.aggregate([
        {
          $match: {
            purchaseBill: pb._id,
            $or: [
              { allocations: { $exists: false } },
              { allocations: { $size: 0 } },
            ],
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const legacyTotal = legacySum.length > 0 ? legacySum[0].total : 0;

      const paidFromBill = pb.paidAmount || 0; // Initial payment recorded on the purchase bill
      const totalPaid = Math.round((allocatedTotal + legacyTotal + paidFromBill) * 100) / 100;
      const dueAmount = Math.max(0, Math.round((pb.grandTotal - totalPaid) * 100) / 100);
      const paymentStatus = dueAmount <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'DUE';

      await PurchaseBill.updateOne(
        { _id: pb._id },
        { $set: { totalPaid, dueAmount, paymentStatus } }
      );
      purchasesUpdated++;
    }

    console.log(`  Purchase bills updated: ${purchasesUpdated}\n`);

    // ────────────────────────────────────────────────────────────
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
