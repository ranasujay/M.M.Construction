const mongoose = require('mongoose');
const AdmZip = require('adm-zip');

// Models
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const PurchaseBill = require('../models/PurchaseBill');
const StockLog = require('../models/StockLog');
const Attendance = require('../models/Attendance');
const Advance = require('../models/Advance');
const SalaryRecord = require('../models/SalaryRecord');
const ActivityLog = require('../models/ActivityLog');
const SupplierPayment = require('../models/SupplierPayment');
const CustomExpense = require('../models/CustomExpense');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Counter = require('../models/Counter');
const RawMaterial = require('../models/RawMaterial');
const Supplier = require('../models/Supplier');
const Worker = require('../models/Worker');
const PromiseModel = require('../models/Promise');
const FinancialYearSummary = require('../models/FinancialYearSummary');
const BackupRecord = require('../models/BackupRecord');
const User = require('../models/User');

// Utils
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');
const { exportToJSON, compressToZip, cleanupTempFiles } = require('../utils/backupHelper');
const fs = require('fs');

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Parse financial year string to date range.
 * "2024-2025" → { startDate: 2024-04-01, endDate: 2025-03-31T23:59:59.999 }
 */
function parseFYDates(fy) {
  const parts = fy.split('-');
  if (parts.length !== 2) throw new AppError('Invalid financial year format. Use YYYY-YYYY', 400);

  const startYear = parseInt(parts[0], 10);
  const endYear = parseInt(parts[1], 10);

  if (isNaN(startYear) || isNaN(endYear) || endYear !== startYear + 1) {
    throw new AppError('Invalid financial year. End year must be start year + 1.', 400);
  }

  const startDate = new Date(startYear, 3, 1); // April 1
  const endDate = new Date(endYear, 2, 31, 23, 59, 59, 999); // March 31

  return { startDate, endDate, startYear, endYear };
}

/**
 * Check if a financial year is the current one (cannot be deleted).
 */
function isCurrentFY(fy) {
  const now = new Date();
  const currentFYStart = now.getMonth() >= 3
    ? now.getFullYear()
    : now.getFullYear() - 1;
  const currentFY = `${currentFYStart}-${currentFYStart + 1}`;
  return fy === currentFY;
}

/**
 * Build date filter for createdAt or a custom date field.
 */
function dateFilter(startDate, endDate, field = 'createdAt') {
  return { [field]: { $gte: startDate, $lte: endDate } };
}

// ─── 1. GET FINANCIAL YEAR PREVIEW / SUMMARY ────────────────────────

const getFinancialYearPreview = asyncHandler(async (req, res) => {
  const { financialYear } = req.params;
  const { startDate, endDate } = parseFYDates(financialYear);

  if (isCurrentFY(financialYear)) {
    throw new AppError('Cannot preview current financial year for closing.', 400);
  }

  // Check if already deleted
  const existingSummary = await FinancialYearSummary.findOne({ financialYear });
  if (existingSummary?.isDeleted) {
    return res.json({
      success: true,
      data: {
        summary: existingSummary,
        alreadyDeleted: true,
        message: 'This financial year data has already been deleted.',
      },
    });
  }

  // Fetch all records in date range
  const [
    bills, payments, purchases, stockLogs,
    attendance, advances, salaryRecords,
    activityLogs, supplierPayments, customExpenses,
  ] = await Promise.all([
    Bill.find(dateFilter(startDate, endDate)).lean(),
    Payment.find(dateFilter(startDate, endDate)).lean(),
    PurchaseBill.find(dateFilter(startDate, endDate)).lean(),
    StockLog.find(dateFilter(startDate, endDate)).lean(),
    Attendance.find(dateFilter(startDate, endDate, 'date')).lean(),
    Advance.find(dateFilter(startDate, endDate, 'date')).lean(),
    SalaryRecord.find(dateFilter(startDate, endDate)).lean(),
    ActivityLog.find(dateFilter(startDate, endDate)).lean(),
    SupplierPayment.find(dateFilter(startDate, endDate)).lean(),
    CustomExpense.find(dateFilter(startDate, endDate, 'date')).lean(),
  ]);

  // Calculate totals
  const totalSales = bills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.grandTotal || 0), 0);
  const totalPaymentsReceived = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalSupplierPayments = supplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalSalaryExpense = salaryRecords.reduce((sum, s) => sum + (s.netPayable || 0), 0);
  const totalAdvances = advances.reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalCustomExpenses = customExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const outstandingDue = bills.reduce((sum, b) => sum + (b.dueAmount || 0), 0);

  // Customer closing balance snapshots
  const customerBills = {};
  const customerPaymentsTotals = {};

  for (const bill of bills) {
    const cid = bill.customer?.toString();
    if (!cid) continue;
    if (!customerBills[cid]) customerBills[cid] = { totalBilled: 0 };
    customerBills[cid].totalBilled += bill.grandTotal || 0;
  }

  for (const pmt of payments) {
    const cid = pmt.customer?.toString();
    if (!cid) continue;
    if (!customerPaymentsTotals[cid]) customerPaymentsTotals[cid] = 0;
    customerPaymentsTotals[cid] += pmt.amount || 0;
  }

  const allCustomerIds = [...new Set([...Object.keys(customerBills), ...Object.keys(customerPaymentsTotals)])];
  const customers = await Customer.find({ _id: { $in: allCustomerIds } }).lean();
  const customerMap = {};
  customers.forEach((c) => (customerMap[c._id.toString()] = c.name || c.firmName || 'Unknown'));

  const customerSnapshots = allCustomerIds.map((cid) => ({
    customer: cid,
    customerName: customerMap[cid] || 'Unknown',
    totalBilled: customerBills[cid]?.totalBilled || 0,
    totalPaid: customerPaymentsTotals[cid] || 0,
    closingBalance: (customerBills[cid]?.totalBilled || 0) - (customerPaymentsTotals[cid] || 0),
  }));

  const summary = {
    financialYear,
    startDate,
    endDate,
    totalSales: Math.round(totalSales * 100) / 100,
    totalPurchases: Math.round(totalPurchases * 100) / 100,
    totalPaymentsReceived: Math.round(totalPaymentsReceived * 100) / 100,
    totalSupplierPayments: Math.round(totalSupplierPayments * 100) / 100,
    totalSalaryExpense: Math.round(totalSalaryExpense * 100) / 100,
    totalAdvances: Math.round(totalAdvances * 100) / 100,
    totalCustomExpenses: Math.round(totalCustomExpenses * 100) / 100,
    outstandingDue: Math.round(outstandingDue * 100) / 100,
    billCount: bills.length,
    paymentCount: payments.length,
    purchaseCount: purchases.length,
    attendanceCount: attendance.length,
    advanceCount: advances.length,
    salaryRecordCount: salaryRecords.length,
    stockLogCount: stockLogs.length,
    activityLogCount: activityLogs.length,
    supplierPaymentCount: supplierPayments.length,
    customExpenseCount: customExpenses.length,
    customerSnapshots,
    generatedBy: req.user._id,
  };

  const saved = await FinancialYearSummary.findOneAndUpdate(
    { financialYear },
    summary,
    { upsert: true, new: true, runValidators: true }
  );

  const openBills = bills.filter((b) => b.paymentStatus !== 'PAID');
  const backup = await BackupRecord.findOne({ financialYear, verified: true });

  res.json({
    success: true,
    data: {
      summary: saved,
      openBillCount: openBills.length,
      hasVerifiedBackup: !!backup,
      alreadyDeleted: false,
    },
  });
});

// ─── 2. CREATE BACKUP (JSON → ZIP → ready for download) ─────────────

const createBackup = asyncHandler(async (req, res) => {
  const { financialYear } = req.params;
  const { startDate, endDate } = parseFYDates(financialYear);

  if (isCurrentFY(financialYear)) {
    throw new AppError('Cannot backup current financial year.', 400);
  }

  const [
    bills, payments, purchases, stockLogs,
    attendance, advances, salaryRecords,
    activityLogs, supplierPayments, customExpenses,
  ] = await Promise.all([
    Bill.find(dateFilter(startDate, endDate)).populate('customer', 'name firmName').lean(),
    Payment.find(dateFilter(startDate, endDate)).populate('customer', 'name firmName').lean(),
    PurchaseBill.find(dateFilter(startDate, endDate)).populate('supplier', 'name').lean(),
    StockLog.find(dateFilter(startDate, endDate)).populate('rawMaterial', 'name').lean(),
    Attendance.find(dateFilter(startDate, endDate, 'date')).populate('worker', 'name').lean(),
    Advance.find(dateFilter(startDate, endDate, 'date')).populate('worker', 'name').lean(),
    SalaryRecord.find(dateFilter(startDate, endDate)).populate('worker', 'name').lean(),
    ActivityLog.find(dateFilter(startDate, endDate)).lean(),
    SupplierPayment.find(dateFilter(startDate, endDate)).populate('supplier', 'name').lean(),
    CustomExpense.find(dateFilter(startDate, endDate, 'date')).lean(),
  ]);

  let summary = await FinancialYearSummary.findOne({ financialYear }).lean();
  if (!summary) {
    throw new AppError('Please generate a preview/summary first.', 400);
  }

  const backupData = {
    financialYear,
    exportDate: new Date().toISOString(),
    exportedBy: req.user.name,
    dateRange: { startDate, endDate },
    summary,
    bills,
    payments,
    purchases,
    stockLogs,
    attendance,
    advances,
    salaryRecords,
    activityLogs,
    supplierPayments,
    customExpenses,
    recordCounts: {
      bills: bills.length,
      payments: payments.length,
      purchases: purchases.length,
      stockLogs: stockLogs.length,
      attendance: attendance.length,
      advances: advances.length,
      salaryRecords: salaryRecords.length,
      activityLogs: activityLogs.length,
      supplierPayments: supplierPayments.length,
      customExpenses: customExpenses.length,
    },
  };

  // Export JSON → Compress ZIP
  const jsonPath = exportToJSON(backupData, financialYear);
  const { zipPath, zipFileName, sizeBytes } = await compressToZip(jsonPath, financialYear);

  // Clean up JSON (keep only ZIP for download)
  cleanupTempFiles(jsonPath);

  // Save backup record
  const backupRecord = await BackupRecord.create({
    financialYear,
    fileName: zipFileName,
    fileSizeBytes: sizeBytes,
    localPath: zipPath,
    backupDate: new Date(),
    uploadedBy: req.user._id,
    verified: false,
  });

  await logActivity({
    action: 'FY_BACKUP_CREATED',
    entity: 'financial_year',
    entityId: backupRecord._id,
    description: `Backup created for FY ${financialYear}. Ready for download.`,
    metadata: { financialYear, fileName: zipFileName, sizeBytes },
    performedBy: req.user._id,
  });

  res.json({
    success: true,
    message: `Backup for FY ${financialYear} created. Please download it now.`,
    data: { backupRecord },
  });
});

// ─── 3. DOWNLOAD BACKUP ZIP ─────────────────────────────────────────

const downloadBackup = asyncHandler(async (req, res) => {
  const { financialYear } = req.params;

  const backupRecord = await BackupRecord.findOne({ financialYear }).sort({ backupDate: -1 });
  if (!backupRecord) {
    throw new AppError(`No backup found for FY ${financialYear}.`, 404);
  }

  const filePath = backupRecord.localPath;
  if (!filePath || !fs.existsSync(filePath)) {
    throw new AppError(
      'Backup file not found on server. It may have been cleaned up. Please create a new backup.',
      404
    );
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${backupRecord.fileName}"`);

  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// ─── 4. VERIFY / CONFIRM BACKUP DOWNLOADED ──────────────────────────

const verifyBackup = asyncHandler(async (req, res) => {
  const { financialYear } = req.params;

  const backupRecord = await BackupRecord.findOne({ financialYear }).sort({ backupDate: -1 });
  if (!backupRecord) {
    throw new AppError(`No backup record found for FY ${financialYear}.`, 404);
  }

  // Verify ZIP file still exists on server
  const fileExists = backupRecord.localPath && fs.existsSync(backupRecord.localPath);
  if (!fileExists) {
    throw new AppError(
      'Backup file not found on server. Please create a new backup before verifying.',
      400
    );
  }

  // Mark as verified (owner confirms they downloaded it)
  backupRecord.verified = true;
  backupRecord.verifiedAt = new Date();
  await backupRecord.save();

  await logActivity({
    action: 'FY_BACKUP_VERIFIED',
    entity: 'financial_year',
    entityId: backupRecord._id,
    description: `Backup for FY ${financialYear} marked as verified/downloaded by owner.`,
    metadata: { financialYear },
    performedBy: req.user._id,
  });

  res.json({
    success: true,
    message: 'Backup confirmed. You can now proceed to delete the financial year data.',
    data: { backupRecord },
  });
});

// ─── 5. DELETE FINANCIAL YEAR DATA ──────────────────────────────────

const deleteFinancialYearData = asyncHandler(async (req, res) => {
  const { financialYear } = req.params;
  const { password } = req.body;

  if (!password) {
    throw new AppError('Password confirmation is required for deletion.', 400);
  }

  if (isCurrentFY(financialYear)) {
    throw new AppError('Cannot delete current financial year data.', 400);
  }

  const { startDate, endDate } = parseFYDates(financialYear);

  const summary = await FinancialYearSummary.findOne({ financialYear });
  if (summary?.isDeleted) {
    throw new AppError('This financial year data has already been deleted.', 400);
  }

  const verifiedBackup = await BackupRecord.findOne({ financialYear, verified: true });
  if (!verifiedBackup) {
    throw new AppError(
      'Cannot delete without a verified backup. Please create, download, and confirm a backup first.',
      400
    );
  }

  // Verify owner password
  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw new AppError('User not found.', 404);

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError('Incorrect password. Deletion aborted.', 401);

  // Check for open bills
  const openBillCount = await Bill.countDocuments({
    ...dateFilter(startDate, endDate),
    paymentStatus: { $in: ['PARTIAL', 'DUE'] },
  });

  if (openBillCount > 0) {
    throw new AppError(
      `Cannot delete: ${openBillCount} open bill(s) found in FY ${financialYear}. Settle all dues first.`,
      400
    );
  }

  // ── Transactional Deletion ──
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const deleteFilter = dateFilter(startDate, endDate);
    const deleteDateFilter = dateFilter(startDate, endDate, 'date');

    // Run deletions sequentially — Atlas shared/free tier does not support
    // parallel writes within the same transaction session.
    const r1 = await Bill.deleteMany(deleteFilter, { session });
    const r2 = await Payment.deleteMany(deleteFilter, { session });
    const r3 = await PurchaseBill.deleteMany(deleteFilter, { session });
    const r4 = await StockLog.deleteMany(deleteFilter, { session });
    const r5 = await Attendance.deleteMany(deleteDateFilter, { session });
    const r6 = await Advance.deleteMany(deleteDateFilter, { session });
    const r7 = await SalaryRecord.deleteMany(deleteFilter, { session });
    const r8 = await ActivityLog.deleteMany(deleteFilter, { session });
    const r9 = await SupplierPayment.deleteMany(deleteFilter, { session });
    const r10 = await CustomExpense.deleteMany(deleteDateFilter, { session });

    const deletionCounts = {
      bills: r1.deletedCount,
      payments: r2.deletedCount,
      purchases: r3.deletedCount,
      stockLogs: r4.deletedCount,
      attendance: r5.deletedCount,
      advances: r6.deletedCount,
      salaryRecords: r7.deletedCount,
      activityLogs: r8.deletedCount,
      supplierPayments: r9.deletedCount,
      customExpenses: r10.deletedCount,
    };

    if (summary) {
      summary.isDeleted = true;
      summary.deletedAt = new Date();
      summary.deletedBy = req.user._id;
      await summary.save({ session });
    }

    await session.commitTransaction();

    // Clean up temp ZIP file
    if (verifiedBackup.localPath) {
      cleanupTempFiles(verifiedBackup.localPath);
    }

    await logActivity({
      action: 'FY_DATA_DELETED',
      entity: 'financial_year',
      entityId: summary?._id || req.user._id,
      description: `Financial year ${financialYear} data permanently deleted after verified backup.`,
      metadata: { financialYear, deletionCounts, backupFileName: verifiedBackup.fileName },
      performedBy: req.user._id,
    });

    res.json({
      success: true,
      message: `FY ${financialYear} data has been permanently deleted.`,
      data: {
        deletionCounts,
        backupFileName: verifiedBackup.fileName,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    throw new AppError(`Deletion failed. Transaction rolled back: ${err.message}`, 500);
  } finally {
    session.endSession();
  }
});

// ─── 6. GET BACKUP RECORDS ──────────────────────────────────────────

const getBackupRecords = asyncHandler(async (req, res) => {
  const records = await BackupRecord.find()
    .populate('uploadedBy', 'name email')
    .sort({ backupDate: -1 });

  res.json({ success: true, data: records });
});

// ─── 7. GET ALL SUMMARIES ───────────────────────────────────────────

const getAllSummaries = asyncHandler(async (req, res) => {
  const summaries = await FinancialYearSummary.find()
    .populate('generatedBy', 'name')
    .populate('deletedBy', 'name')
    .sort({ financialYear: -1 });

  res.json({ success: true, data: summaries });
});

// ─── 8. GET STATUS FOR A FINANCIAL YEAR ─────────────────────────────

const getFinancialYearStatus = asyncHandler(async (req, res) => {
  const { financialYear } = req.params;

  parseFYDates(financialYear);

  const summary = await FinancialYearSummary.findOne({ financialYear });
  const backups = await BackupRecord.find({ financialYear }).sort({ backupDate: -1 });
  const latestBackup = backups[0] || null;
  const hasVerifiedBackup = backups.some((b) => b.verified);

  res.json({
    success: true,
    data: {
      financialYear,
      isCurrent: isCurrentFY(financialYear),
      hasSummary: !!summary,
      isDeleted: summary?.isDeleted || false,
      hasBackup: backups.length > 0,
      hasVerifiedBackup,
      latestBackup,
      summary,
    },
  });
});

// ─── MODEL MAP FOR FULL BACKUP / RESTORE ────────────────────────────

const MODEL_MAP = {
  bills: Bill,
  payments: Payment,
  purchaseBills: PurchaseBill,
  stockLogs: StockLog,
  attendance: Attendance,
  advances: Advance,
  salaryRecords: SalaryRecord,
  activityLogs: ActivityLog,
  supplierPayments: SupplierPayment,
  customExpenses: CustomExpense,
  customers: Customer,
  products: Product,
  categories: Category,
  counters: Counter,
  rawMaterials: RawMaterial,
  suppliers: Supplier,
  workers: Worker,
  users: User,
  promises: PromiseModel,
  financialYearSummaries: FinancialYearSummary,
  backupRecords: BackupRecord,
};

// ─── 9. FULL DATABASE BACKUP (all collections) ─────────────────────

const createFullBackup = asyncHandler(async (req, res) => {
  // Query every collection in parallel (read-only, safe)
  const keys = Object.keys(MODEL_MAP);
  const dataArrays = await Promise.all(
    keys.map((k) => {
      // Users: explicitly select +password so hashed passwords are included in the backup
      if (k === 'users') return MODEL_MAP[k].find().select('+password').lean();
      return MODEL_MAP[k].find().lean();
    })
  );

  const collections = {};
  let totalDocs = 0;
  keys.forEach((k, i) => {
    collections[k] = dataArrays[i];
    totalDocs += dataArrays[i].length;
  });

  const backupData = {
    metadata: {
      backupType: 'full',
      timestamp: new Date().toISOString(),
      version: '1.0',
      totalDocuments: totalDocs,
      collectionCounts: keys.reduce((acc, k, i) => {
        acc[k] = dataArrays[i].length;
        return acc;
      }, {}),
    },
    collections,
  };

  // Generate a timestamped filename
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tag = `FULL_${ts}`;

  const jsonPath = exportToJSON(backupData, tag);
  const { zipPath, zipFileName, sizeBytes } = await compressToZip(jsonPath, tag);

  // Clean up the intermediate JSON immediately
  cleanupTempFiles(jsonPath);

  // Stream the ZIP to the client
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
  res.setHeader('Content-Length', sizeBytes);

  const stream = fs.createReadStream(zipPath);
  stream.pipe(res);
  stream.on('end', () => cleanupTempFiles(zipPath));
  stream.on('error', () => cleanupTempFiles(zipPath));

  await logActivity({
    action: 'FY_BACKUP_CREATED',
    entity: 'financial_year',
    entityId: req.user._id,
    description: `Full database backup downloaded (${totalDocs} documents, ${(sizeBytes / 1024).toFixed(1)} KB).`,
    metadata: { backupType: 'full', totalDocs, sizeBytes },
    performedBy: req.user._id,
  });
});

// ─── 10. RESTORE DATABASE FROM BACKUP ZIP ───────────────────────────

const restoreFromBackup = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No backup file uploaded. Please upload a .zip file.', 400);
  }

  const { mode = 'merge', password } = req.body;

  if (!password) {
    throw new AppError('Password is required to restore data.', 400);
  }

  // Verify owner password
  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw new AppError('User not found.', 404);
  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError('Invalid password. Restore aborted.', 401);

  // Extract JSON from the uploaded ZIP buffer
  let backupData;
  try {
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();
    const jsonEntry = entries.find((e) => e.entryName.endsWith('.json'));

    if (!jsonEntry) {
      throw new AppError('No JSON file found inside the ZIP. Invalid backup.', 400);
    }

    backupData = JSON.parse(jsonEntry.getData().toString('utf-8'));
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(`Failed to parse backup file: ${err.message}`, 400);
  }

  if (!backupData.collections || typeof backupData.collections !== 'object') {
    throw new AppError('Invalid backup format: missing "collections" object.', 400);
  }

  // ── Helper: convert string ObjectIds back to proper ObjectId types ──
  // JSON.stringify turns ObjectId → string; we must reverse that on restore.
  const OID_REGEX = /^[a-f\d]{24}$/i;

  function restoreObjectIds(doc) {
    if (doc === null || doc === undefined) return doc;
    if (typeof doc === 'string' && OID_REGEX.test(doc)) {
      return new mongoose.Types.ObjectId(doc);
    }
    if (doc instanceof Date || typeof doc === 'number' || typeof doc === 'boolean') return doc;
    if (Array.isArray(doc)) return doc.map(restoreObjectIds);
    if (typeof doc === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(doc)) {
        // Convert date-like strings back to Date objects
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
          const d = new Date(v);
          out[k] = isNaN(d.getTime()) ? v : d;
        } else {
          out[k] = restoreObjectIds(v);
        }
      }
      return out;
    }
    return doc;
  }

  // Perform restore — collection by collection (sequential for Atlas compatibility)
  const results = {};
  const collectionKeys = Object.keys(MODEL_MAP);

  for (const key of collectionKeys) {
    const docs = backupData.collections[key];
    if (!docs || !Array.isArray(docs) || docs.length === 0) {
      results[key] = { total: 0, inserted: 0, skipped: 0 };
      continue;
    }

    // Convert all string ObjectIds and date strings back to proper types
    const fixedDocs = docs.map(restoreObjectIds);

    try {
      // In 'replace' mode, wipe existing data first
      if (mode === 'replace') {
        await MODEL_MAP[key].deleteMany({});
      }

      // Use raw collection insertMany to bypass Mongoose hooks/validators
      // (backup data is already validated & passwords already hashed)
      const insertResult = await MODEL_MAP[key].collection.insertMany(fixedDocs, {
        ordered: false,
      });

      results[key] = {
        total: docs.length,
        inserted: insertResult.insertedCount || docs.length,
        skipped: 0,
      };
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key — partial insert (some existed already in merge mode)
        const inserted = err.result?.insertedCount ?? err.insertedCount ?? 0;
        results[key] = {
          total: docs.length,
          inserted,
          skipped: docs.length - inserted,
        };
      } else {
        results[key] = {
          total: docs.length,
          inserted: 0,
          skipped: docs.length,
          error: err.message,
        };
      }
    }
  }

  // Tally totals
  let totalInserted = 0;
  let totalSkipped = 0;
  for (const r of Object.values(results)) {
    totalInserted += r.inserted;
    totalSkipped += r.skipped;
  }

  await logActivity({
    action: 'FY_DATA_DELETED', // re-using enum (closest match)
    entity: 'financial_year',
    entityId: req.user._id,
    description: `Database restored from backup (mode: ${mode}). ${totalInserted} docs inserted, ${totalSkipped} skipped.`,
    metadata: { mode, totalInserted, totalSkipped, fileName: req.file.originalname },
    performedBy: req.user._id,
  });

  res.json({
    success: true,
    message: `Restore complete (${mode} mode). ${totalInserted} documents inserted, ${totalSkipped} skipped.`,
    data: {
      mode,
      totalInserted,
      totalSkipped,
      backupMetadata: backupData.metadata || {},
      collections: results,
    },
  });
});

module.exports = {
  getFinancialYearPreview,
  createBackup,
  downloadBackup,
  verifyBackup,
  deleteFinancialYearData,
  getBackupRecords,
  getAllSummaries,
  getFinancialYearStatus,
  createFullBackup,
  restoreFromBackup,
};
