const PurchaseBill = require('../models/PurchaseBill');
const RawMaterial = require('../models/RawMaterial');
const StockLog = require('../models/StockLog');
const Counter = require('../models/Counter');
const Supplier = require('../models/Supplier');
const SupplierPayment = require('../models/SupplierPayment');
const { recalcSupplierLedger } = require('./supplierController');
const { recalcAvgRate } = require('./rawMaterialController');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

/**
 * Generate purchase bill number: PUR-YYYY-XXXX
 */
const generatePurchaseBillNumber = async () => {
  const year = new Date().getFullYear();
  const seq = await Counter.getNextSequence(`purchase_${year}`);
  return `PUR-${year}-${String(seq).padStart(4, '0')}`;
};

/**
 * @desc    Create purchase bill & update stock
 * @route   POST /api/purchases
 */
const createPurchase = asyncHandler(async (req, res) => {
  const { supplierName, supplier, purchaseDate, items, notes, loadingCost, carryingCost, discount, paidAmount } = req.body;

  if (!items || items.length === 0) {
    throw new AppError('At least one item is required', 400);
  }

  // Validate all raw materials exist
  const lineItems = [];
  for (const item of items) {
    const material = await RawMaterial.findById(item.rawMaterial);
    if (!material) throw new AppError(`Raw material ${item.rawMaterial} not found`, 404);

    lineItems.push({
      rawMaterial: material._id,
      materialName: material.name,
      quantity: item.quantity,
      unit: material.unit,
      ratePerUnit: item.ratePerUnit,
      totalCost: Math.round(item.quantity * item.ratePerUnit * 100) / 100,
    });
  }

  const billNumber = await generatePurchaseBillNumber();

  const purchase = await PurchaseBill.create({
    billNumber,
    supplierName,
    supplier: supplier || null,
    purchaseDate: purchaseDate || new Date(),
    items: lineItems,
    notes,
    loadingCost: loadingCost || 0,
    carryingCost: carryingCost || 0,
    discount: discount || 0,
    paidAmount: paidAmount || 0,
    createdBy: req.user._id,
  });

  // Update stock for each item and create stock logs
  for (const item of lineItems) {
    const material = await RawMaterial.findById(item.rawMaterial);
    material.currentStock = Math.round((material.currentStock + item.quantity) * 100) / 100;
    await material.save();

    await StockLog.create({
      rawMaterial: item.rawMaterial,
      changeType: 'PURCHASE',
      quantityChanged: item.quantity,
      balanceAfter: material.currentStock,
      relatedDocument: purchase._id,
      relatedDocumentType: 'PurchaseBill',
      notes: `Purchase from ${supplierName} (${billNumber})`,
      performedBy: req.user._id,
    });

    // Recalculate weighted average rate for this material
    await recalcAvgRate(item.rawMaterial);
  }

  logActivity({
    action: 'PURCHASE_CREATED',
    entity: 'purchaseBill',
    entityId: purchase._id,
    description: `Purchase ${billNumber} from "${supplierName}" — ₹${purchase.grandTotal}`,
    metadata: { billNumber, supplierName, grandTotal: purchase.grandTotal },
    performedBy: req.user._id,
  });

  const populated = await PurchaseBill.findById(purchase._id)
    .populate('items.rawMaterial', 'name unit')
    .populate('supplier', 'name phone')
    .populate('createdBy', 'name');

  // Recalculate supplier ledger if linked
  if (purchase.supplier) {
    // Auto-create supplier payment if paidAmount > 0
    if (paidAmount && parseFloat(paidAmount) > 0) {
      await SupplierPayment.create({
        supplier: purchase.supplier,
        purchaseBill: purchase._id,
        amount: parseFloat(paidAmount),
        allocations: [{ purchaseBill: purchase._id, amount: parseFloat(paidAmount) }],
        unallocatedAmount: 0,
        mode: 'Cash',
        notes: `Payment with purchase ${billNumber}`,
        paidBy: req.user._id,
      });
    }

    // Auto-apply supplier advance balance
    const freshSupplier = await Supplier.findById(purchase.supplier);
    if (freshSupplier && freshSupplier.advanceBalance > 0) {
      const effectiveDue = purchase.grandTotal - (purchase.totalPaid || 0);
      if (effectiveDue > 0) {
        const applyAmount = Math.min(freshSupplier.advanceBalance, effectiveDue);
        purchase.totalPaid = Math.round(((purchase.totalPaid || 0) + applyAmount) * 100) / 100;
        purchase.dueAmount = Math.round(Math.max(0, purchase.grandTotal - purchase.totalPaid) * 100) / 100;
        purchase.paymentStatus = purchase.dueAmount === 0 ? 'PAID' : 'PARTIAL';
        await purchase.save();

        await SupplierPayment.create({
          supplier: purchase.supplier,
          purchaseBill: purchase._id,
          amount: applyAmount,
          allocations: [{ purchaseBill: purchase._id, amount: applyAmount }],
          unallocatedAmount: 0,
          mode: 'Cash',
          notes: `Auto-applied from advance balance`,
          paidBy: req.user._id,
        });
      }
    }

    await recalcSupplierLedger(purchase.supplier);
  }

  res.status(201).json({ success: true, data: populated });
});

/**
 * @desc    Get all purchase bills (with filters & pagination)
 * @route   GET /api/purchases
 */
const getPurchases = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, supplier, startDate, endDate, search } = req.query;
  const filter = {};

  if (supplier) filter.supplierName = { $regex: supplier, $options: 'i' };
  if (search) filter.billNumber = { $regex: search, $options: 'i' };
  if (startDate || endDate) {
    filter.purchaseDate = {};
    if (startDate) filter.purchaseDate.$gte = new Date(startDate);
    if (endDate) filter.purchaseDate.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const total = await PurchaseBill.countDocuments(filter);
  const purchases = await PurchaseBill.find(filter)
    .populate('items.rawMaterial', 'name unit')
    .populate('supplier', 'name phone currentDue')
    .populate('createdBy', 'name')
    .sort('-purchaseDate')
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  res.json({
    success: true,
    count: purchases.length,
    total,
    totalPages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: purchases,
  });
});

/**
 * @desc    Get single purchase bill
 * @route   GET /api/purchases/:id
 */
const getPurchase = asyncHandler(async (req, res) => {
  const purchase = await PurchaseBill.findById(req.params.id)
    .populate('items.rawMaterial', 'name unit')
    .populate('supplier', 'name phone')
    .populate('createdBy', 'name');

  if (!purchase) throw new AppError('Purchase bill not found', 404);

  res.json({ success: true, data: purchase });
});

/**
 * @desc    Update purchase bill (items, supplier, notes, date)
 * @route   PUT /api/purchases/:id
 */
const updatePurchase = asyncHandler(async (req, res) => {
  const purchase = await PurchaseBill.findById(req.params.id);
  if (!purchase) throw new AppError('Purchase bill not found', 404);

  const { supplierName, supplier, purchaseDate, items, notes, loadingCost, carryingCost, discount, paidAmount } = req.body;
  const oldSupplierId = purchase.supplier ? purchase.supplier.toString() : null;

  // Reverse old stock changes
  const oldMaterialIds = purchase.items.map((i) => i.rawMaterial);
  for (const item of purchase.items) {
    const material = await RawMaterial.findById(item.rawMaterial);
    if (material) {
      material.currentStock = Math.round((material.currentStock - item.quantity) * 100) / 100;
      await material.save();
    }
    // Remove old stock logs for this purchase
    await StockLog.deleteMany({ relatedDocument: purchase._id, changeType: 'PURCHASE' });
  }

  // Build new line items if provided
  if (items && items.length > 0) {
    const newLineItems = [];
    for (const item of items) {
      const material = await RawMaterial.findById(item.rawMaterial);
      if (!material) throw new AppError(`Raw material ${item.rawMaterial} not found`, 404);

      newLineItems.push({
        rawMaterial: material._id,
        materialName: material.name,
        quantity: item.quantity,
        unit: material.unit,
        ratePerUnit: item.ratePerUnit,
        totalCost: Math.round(item.quantity * item.ratePerUnit * 100) / 100,
      });
    }
    purchase.items = newLineItems;
  }

  if (supplierName !== undefined) purchase.supplierName = supplierName;
  if (supplier !== undefined) purchase.supplier = supplier || null;
  if (purchaseDate !== undefined) purchase.purchaseDate = purchaseDate;
  if (notes !== undefined) purchase.notes = notes;
  if (loadingCost !== undefined) purchase.loadingCost = loadingCost;
  if (carryingCost !== undefined) purchase.carryingCost = carryingCost;
  if (discount !== undefined) purchase.discount = discount;
  if (paidAmount !== undefined) purchase.paidAmount = paidAmount;

  await purchase.save(); // triggers pre-validate to recalc totals

  // Re-apply stock changes with updated items
  for (const item of purchase.items) {
    const material = await RawMaterial.findById(item.rawMaterial);
    if (material) {
      material.currentStock = Math.round((material.currentStock + item.quantity) * 100) / 100;
      await material.save();

      await StockLog.create({
        rawMaterial: item.rawMaterial,
        changeType: 'PURCHASE',
        quantityChanged: item.quantity,
        balanceAfter: material.currentStock,
        relatedDocument: purchase._id,
        relatedDocumentType: 'PurchaseBill',
        notes: `Purchase from ${purchase.supplierName} (${purchase.billNumber}) [edited]`,
        performedBy: req.user._id,
      });

      // Recalculate weighted average rate for this material
      await recalcAvgRate(item.rawMaterial);
    }
  }

  // Also recalculate avg rate for any old materials that were removed from this purchase
  for (const oldMatId of oldMaterialIds) {
    const stillPresent = purchase.items.some((i) => i.rawMaterial.toString() === oldMatId.toString());
    if (!stillPresent) await recalcAvgRate(oldMatId);
  }

  // Recalculate supplier ledgers (old and new)
  const newSupplierId = purchase.supplier ? purchase.supplier.toString() : null;
  if (oldSupplierId) await recalcSupplierLedger(oldSupplierId);
  if (newSupplierId && newSupplierId !== oldSupplierId) await recalcSupplierLedger(newSupplierId);

  logActivity({
    action: 'PURCHASE_UPDATED',
    entity: 'purchaseBill',
    entityId: purchase._id,
    description: `Purchase ${purchase.billNumber} updated — ₹${purchase.grandTotal}`,
    performedBy: req.user._id,
  });

  const populated = await PurchaseBill.findById(purchase._id)
    .populate('items.rawMaterial', 'name unit')
    .populate('supplier', 'name phone')
    .populate('createdBy', 'name');

  res.json({ success: true, data: populated });
});

/**
 * @desc    Get purchase expenses report (loading, carrying, discount)
 * @route   GET /api/purchases/expenses
 */
const getPurchaseExpenses = asyncHandler(async (req, res) => {
  const { startDate, endDate, supplier } = req.query;
  const filter = {};
  if (supplier) filter.supplierName = { $regex: supplier, $options: 'i' };
  if (startDate || endDate) {
    filter.purchaseDate = {};
    if (startDate) filter.purchaseDate.$gte = new Date(startDate);
    if (endDate) filter.purchaseDate.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  // Only get purchases that have any extra costs
  filter.$or = [
    { loadingCost: { $gt: 0 } },
    { carryingCost: { $gt: 0 } },
    { discount: { $gt: 0 } },
  ];

  const purchases = await PurchaseBill.find(filter)
    .select('billNumber supplierName purchaseDate grandTotal loadingCost carryingCost discount paidAmount')
    .sort('-purchaseDate')
    .lean();

  // Build a separate filter for totals (all purchases, not just those with extras)
  const totalsFilter = {};
  if (supplier) totalsFilter.supplierName = { $regex: supplier, $options: 'i' };
  if (startDate || endDate) {
    totalsFilter.purchaseDate = {};
    if (startDate) totalsFilter.purchaseDate.$gte = new Date(startDate);
    if (endDate) totalsFilter.purchaseDate.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const pipeline = [];
  if (Object.keys(totalsFilter).length) pipeline.push({ $match: totalsFilter });
  pipeline.push({
    $group: {
      _id: null,
      totalLoadingCost: { $sum: '$loadingCost' },
      totalCarryingCost: { $sum: '$carryingCost' },
      totalDiscount: { $sum: '$discount' },
      totalGrand: { $sum: '$grandTotal' },
      count: { $sum: 1 },
    },
  });

  const totals = await PurchaseBill.aggregate(pipeline);

  res.json({
    success: true,
    data: purchases,
    totals: totals[0] || { totalLoadingCost: 0, totalCarryingCost: 0, totalDiscount: 0, totalGrand: 0, count: 0 },
  });
});

/**
 * @desc    Get purchase stats for dashboard
 * @route   GET /api/purchases/stats
 */
const getPurchaseStats = asyncHandler(async (req, res) => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [monthlyStats, todayStats, topSuppliers] = await Promise.all([
    PurchaseBill.aggregate([
      { $match: { purchaseDate: { $gte: startOfMonth } } },
      { $group: { _id: null, totalSpent: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]),
    PurchaseBill.aggregate([
      { $match: { purchaseDate: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, totalSpent: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]),
    PurchaseBill.aggregate([
      { $match: { purchaseDate: { $gte: startOfMonth } } },
      { $group: { _id: '$supplierName', totalSpent: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      monthly: monthlyStats[0] || { totalSpent: 0, count: 0 },
      today: todayStats[0] || { totalSpent: 0, count: 0 },
      topSuppliers,
    },
  });
});

/**
 * @desc    Get distinct supplier names for autocomplete
 * @route   GET /api/purchases/supplier-names
 */
const getSupplierNames = asyncHandler(async (req, res) => {
  const { q } = req.query;
  const filter = q ? { supplierName: { $regex: q, $options: 'i' } } : {};
  const names = await PurchaseBill.distinct('supplierName', filter);
  // Also get from Supplier model
  const supplierFilter = q ? { name: { $regex: q, $options: 'i' } } : {};
  const supplierNames = await Supplier.distinct('name', supplierFilter);
  // Merge and deduplicate
  const all = [...new Set([...names, ...supplierNames])].sort();
  res.json({ success: true, data: all });
});

module.exports = {
  createPurchase,
  getPurchases,
  getPurchase,
  updatePurchase,
  getPurchaseStats,
  getPurchaseExpenses,
  getSupplierNames,
};
