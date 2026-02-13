const RawMaterial = require('../models/RawMaterial');
const StockLog = require('../models/StockLog');
const PurchaseBill = require('../models/PurchaseBill');
const mongoose = require('mongoose');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

/**
 * Recalculate weighted average rate for a raw material
 * Sources: opening stock (openingRate) + all purchase bill items
 * Formula: (openingQty * openingRate + Σ(purchaseQty * purchaseRate)) / (openingQty + Σ purchaseQty)
 */
const recalcAvgRate = async (materialId) => {
  const material = await RawMaterial.findById(materialId);
  if (!material) return;

  // Get opening stock info from the first MANUAL_ADJUSTMENT log that says "Opening stock"
  const openingLog = await StockLog.findOne({
    rawMaterial: materialId,
    changeType: 'MANUAL_ADJUSTMENT',
    notes: 'Opening stock',
  }).sort('createdAt');

  const openingQty = openingLog ? openingLog.quantityChanged : 0;
  const openingRate = material.openingRate || 0;

  // Sum all purchase quantities and costs for this material
  const purchaseAgg = await PurchaseBill.aggregate([
    { $unwind: '$items' },
    { $match: { 'items.rawMaterial': new mongoose.Types.ObjectId(materialId) } },
    {
      $group: {
        _id: null,
        totalQty: { $sum: '$items.quantity' },
        totalCost: { $sum: '$items.totalCost' },
      },
    },
  ]);

  const purchaseQty = purchaseAgg[0]?.totalQty || 0;
  const purchaseCost = purchaseAgg[0]?.totalCost || 0;

  const totalQty = openingQty + purchaseQty;
  const totalCost = (openingQty * openingRate) + purchaseCost;

  const newAvgRate = totalQty > 0 ? Math.round((totalCost / totalQty) * 100) / 100 : openingRate;

  await RawMaterial.findByIdAndUpdate(materialId, { avgRate: newAvgRate });
  return newAvgRate;
};

/**
 * @desc    Create raw material
 * @route   POST /api/raw-materials
 */
const createRawMaterial = asyncHandler(async (req, res) => {
  const { name, unit, currentStock, minimumStockAlert, openingRate } = req.body;

  const oRate = parseFloat(openingRate) || 0;
  const oStock = parseFloat(currentStock) || 0;

  const material = await RawMaterial.create({
    name,
    unit,
    currentStock: oStock,
    minimumStockAlert: minimumStockAlert || 0,
    openingRate: oRate,
    avgRate: oRate, // initial avg rate = opening rate
    createdBy: req.user._id,
  });

  // If opening stock provided, create stock log
  if (oStock > 0) {
    await StockLog.create({
      rawMaterial: material._id,
      changeType: 'MANUAL_ADJUSTMENT',
      quantityChanged: oStock,
      balanceAfter: oStock,
      notes: 'Opening stock',
      performedBy: req.user._id,
    });
  }

  logActivity({
    action: 'RAW_MATERIAL_CREATED',
    entity: 'rawMaterial',
    entityId: material._id,
    description: `Raw material "${material.name}" created with stock ${material.currentStock} ${material.unit}`,
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: material });
});

/**
 * @desc    Get all raw materials
 * @route   GET /api/raw-materials
 */
const getRawMaterials = asyncHandler(async (req, res) => {
  const { active, search } = req.query;
  const filter = {};
  if (active !== undefined) filter.isActive = active === 'true';
  if (search) filter.name = { $regex: search, $options: 'i' };

  const materials = await RawMaterial.find(filter)
    .populate('createdBy', 'name')
    .sort('name');

  res.json({ success: true, count: materials.length, data: materials });
});

/**
 * @desc    Get single raw material
 * @route   GET /api/raw-materials/:id
 */
const getRawMaterial = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id);
  if (!material) throw new AppError('Raw material not found', 404);
  res.json({ success: true, data: material });
});

/**
 * @desc    Update raw material
 * @route   PUT /api/raw-materials/:id
 */
const updateRawMaterial = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id);
  if (!material) throw new AppError('Raw material not found', 404);

  const allowed = ['name', 'unit', 'minimumStockAlert', 'isActive'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      material[field] = req.body[field];
    }
  });

  // Update opening rate if provided
  if (req.body.openingRate !== undefined) {
    material.openingRate = parseFloat(req.body.openingRate) || 0;
  }

  // Allow directly setting currentStock (creates adjustment log)
  if (req.body.currentStock !== undefined) {
    const newStock = parseFloat(req.body.currentStock);
    const diff = Math.round((newStock - material.currentStock) * 100) / 100;
    if (diff !== 0) {
      material.currentStock = newStock;
      await material.save();
      await StockLog.create({
        rawMaterial: material._id,
        changeType: 'MANUAL_ADJUSTMENT',
        quantityChanged: diff,
        balanceAfter: newStock,
        notes: req.body.stockUpdateNotes || 'Stock set manually via edit',
        performedBy: req.user._id,
      });
    } else {
      await material.save();
    }
  } else {
    await material.save();
  }

  logActivity({
    action: 'RAW_MATERIAL_UPDATED',
    entity: 'rawMaterial',
    entityId: material._id,
    description: `Raw material "${material.name}" updated`,
    performedBy: req.user._id,
  });

  // Recalculate weighted average rate
  await recalcAvgRate(material._id);
  const updated = await RawMaterial.findById(material._id);

  res.json({ success: true, data: updated });
});

/**
 * @desc    Manual stock adjustment (owner only)
 * @route   POST /api/raw-materials/:id/adjust
 */
const adjustStock = asyncHandler(async (req, res) => {
  const { quantity, notes } = req.body;

  if (quantity === undefined || quantity === 0) {
    throw new AppError('Adjustment quantity is required and cannot be zero', 400);
  }

  const material = await RawMaterial.findById(req.params.id);
  if (!material) throw new AppError('Raw material not found', 404);

  material.currentStock = Math.round((material.currentStock + quantity) * 100) / 100;
  await material.save();

  await StockLog.create({
    rawMaterial: material._id,
    changeType: 'MANUAL_ADJUSTMENT',
    quantityChanged: quantity,
    balanceAfter: material.currentStock,
    notes: notes || 'Manual stock adjustment',
    performedBy: req.user._id,
  });

  logActivity({
    action: 'STOCK_ADJUSTED',
    entity: 'rawMaterial',
    entityId: material._id,
    description: `Stock of "${material.name}" adjusted by ${quantity > 0 ? '+' : ''}${quantity} ${material.unit} → New balance: ${material.currentStock}`,
    metadata: { quantity, balanceAfter: material.currentStock },
    performedBy: req.user._id,
  });

  res.json({ success: true, data: material });
});

/**
 * @desc    Get stock dashboard summary
 * @route   GET /api/raw-materials/dashboard
 */
const getStockDashboard = asyncHandler(async (req, res) => {
  const materials = await RawMaterial.find({ isActive: true }).sort('name');

  const negativeStock = materials.filter((m) => m.currentStock < 0);
  const lowStock = materials.filter(
    (m) => m.currentStock >= 0 && m.currentStock <= m.minimumStockAlert && m.minimumStockAlert > 0
  );

  // Monthly purchase summary (current month)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const PurchaseBill = require('../models/PurchaseBill');
  const monthlyPurchases = await PurchaseBill.aggregate([
    { $match: { purchaseDate: { $gte: startOfMonth } } },
    { $group: { _id: null, totalSpent: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
  ]);

  // Monthly material consumption (sale deductions this month)
  const monthlyConsumption = await StockLog.aggregate([
    { $match: { changeType: 'SALE', createdAt: { $gte: startOfMonth } } },
    {
      $group: {
        _id: '$rawMaterial',
        totalConsumed: { $sum: { $abs: '$quantityChanged' } },
      },
    },
    {
      $lookup: {
        from: 'rawmaterials',
        localField: '_id',
        foreignField: '_id',
        as: 'material',
      },
    },
    { $unwind: '$material' },
    {
      $project: {
        name: '$material.name',
        unit: '$material.unit',
        totalConsumed: 1,
      },
    },
    { $sort: { totalConsumed: -1 } },
  ]);

  // Last 12 months consumption breakdown
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const yearlyConsumption = await StockLog.aggregate([
    { $match: { changeType: 'SALE', createdAt: { $gte: twelveMonthsAgo } } },
    {
      $group: {
        _id: {
          rawMaterial: '$rawMaterial',
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        totalConsumed: { $sum: { $abs: '$quantityChanged' } },
      },
    },
    {
      $lookup: {
        from: 'rawmaterials',
        localField: '_id.rawMaterial',
        foreignField: '_id',
        as: 'material',
      },
    },
    { $unwind: '$material' },
    {
      $project: {
        materialId: '$_id.rawMaterial',
        year: '$_id.year',
        month: '$_id.month',
        name: '$material.name',
        unit: '$material.unit',
        totalConsumed: 1,
      },
    },
    { $sort: { name: 1, year: 1, month: 1 } },
  ]);

  res.json({
    success: true,
    data: {
      totalMaterials: materials.length,
      materials,
      negativeStock,
      lowStock,
      monthlyPurchases: monthlyPurchases[0] || { totalSpent: 0, count: 0 },
      monthlyConsumption,
      yearlyConsumption,
    },
  });
});

module.exports = {
  createRawMaterial,
  getRawMaterials,
  getRawMaterial,
  updateRawMaterial,
  adjustStock,
  getStockDashboard,
  recalcAvgRate,
};
