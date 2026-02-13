const Product = require('../models/Product');
const Category = require('../models/Category');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

const DEFAULT_CATEGORIES = ['Grill', 'Shutter', 'Railing', 'Window', 'Gate', 'Custom'];

/**
 * @desc    Create product
 * @route   POST /api/products
 */
const createProduct = asyncHandler(async (req, res) => {
  // Check for duplicate product name within the same category
  const existing = await Product.findOne({
    name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') },
    category: req.body.category,
  });
  if (existing) {
    throw new AppError(`Product "${req.body.name}" already exists in category "${req.body.category}"`, 400);
  }

  const product = await Product.create({
    ...req.body,
    createdBy: req.user._id,
  });

  logActivity({
    action: 'PRODUCT_CREATED',
    entity: 'product',
    entityId: product._id,
    description: `Product "${product.name}" created in category "${product.category}"`,
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: product });
});

/**
 * @desc    Get all products (with filtering)
 * @route   GET /api/products
 */
const getProducts = asyncHandler(async (req, res) => {
  const { category, active, search } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (active !== undefined) filter.isActive = active === 'true';
  if (search) filter.name = { $regex: search, $options: 'i' };

  const products = await Product.find(filter)
    .populate('createdBy', 'name')
    .populate('materialConsumption.rawMaterial', 'name unit')
    .sort('category name');

  res.json({ success: true, count: products.length, data: products });
});

/**
 * @desc    Get single product
 * @route   GET /api/products/:id
 */
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('materialConsumption.rawMaterial', 'name unit');
  if (!product) throw new AppError('Product not found', 404);

  res.json({ success: true, data: product });
});

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 */
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  // Check for duplicate product name within the same category (excluding current product)
  const newName = req.body.name !== undefined ? req.body.name : product.name;
  const newCategory = req.body.category !== undefined ? req.body.category : product.category;
  const duplicate = await Product.findOne({
    _id: { $ne: product._id },
    name: { $regex: new RegExp(`^${newName.trim()}$`, 'i') },
    category: newCategory,
  });
  if (duplicate) {
    throw new AppError(`Product "${newName}" already exists in category "${newCategory}"`, 400);
  }

  const oldRate = product.baseRate;

  const allowed = [
    'name', 'category', 'baseRate', 'unit',
    'fittingCharge', 'fittingChargeType', 'description', 'isActive',
    'materialConsumption',
  ];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) {
      product[field] = req.body[field];
    }
  });

  await product.save();

  // Log price change specifically
  if (req.body.baseRate !== undefined && req.body.baseRate !== oldRate) {
    logActivity({
      action: 'PRODUCT_PRICE_CHANGED',
      entity: 'product',
      entityId: product._id,
      description: `Price of "${product.name}" changed from ₹${oldRate} to ₹${product.baseRate}`,
      metadata: { oldRate, newRate: product.baseRate },
      performedBy: req.user._id,
    });
  } else {
    logActivity({
      action: 'PRODUCT_UPDATED',
      entity: 'product',
      entityId: product._id,
      description: `Product "${product.name}" updated`,
      performedBy: req.user._id,
    });
  }

  res.json({ success: true, data: product });
});

/**
 * @desc    Get all categories
 * @route   GET /api/products/categories
 */
const getCategories = asyncHandler(async (req, res) => {
  // Merge defaults + custom from Category collection + distinct from products
  const [customCats, productCats] = await Promise.all([
    Category.find().sort('name').lean(),
    Product.distinct('category'),
  ]);

  const catSet = new Set(DEFAULT_CATEGORIES);
  customCats.forEach((c) => catSet.add(c.name));
  productCats.forEach((c) => catSet.add(c));

  const categories = Array.from(catSet).sort();
  res.json({ success: true, data: categories });
});

/**
 * @desc    Add a new category
 * @route   POST /api/products/categories
 */
const addCategory = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) throw new AppError('Category name is required', 400);

  const trimmed = name.trim();
  const exists = await Category.findOne({ name: { $regex: new RegExp(`^${trimmed}$`, 'i') } });
  if (exists) throw new AppError('Category already exists', 400);

  // Also check defaults
  if (DEFAULT_CATEGORIES.map((c) => c.toLowerCase()).includes(trimmed.toLowerCase())) {
    throw new AppError('Category already exists', 400);
  }

  const category = await Category.create({ name: trimmed, createdBy: req.user._id });

  logActivity({
    action: 'CATEGORY_CREATED',
    entity: 'category',
    entityId: category._id,
    description: `Category "${trimmed}" added`,
    performedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: category });
});

/**
 * @desc    Delete a custom category
 * @route   DELETE /api/products/categories/:name
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const name = decodeURIComponent(req.params.name);

  if (DEFAULT_CATEGORIES.map((c) => c.toLowerCase()).includes(name.toLowerCase())) {
    throw new AppError('Cannot delete default category', 400);
  }

  // Check if any products use this category
  const productCount = await Product.countDocuments({ category: name });
  if (productCount > 0) {
    throw new AppError(`Cannot delete — ${productCount} product(s) use this category`, 400);
  }

  await Category.findOneAndDelete({ name });
  res.json({ success: true, message: 'Category deleted' });
});

/**
 * @desc    Product-wise sales & profit report (owner only)
 * @route   GET /api/products/sales-report
 */
const getProductSalesReport = asyncHandler(async (req, res) => {
  const { startDate, endDate, category, fittingOnly, product } = req.query;

  const matchStage = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  // If fittingOnly, also filter items with fittingCharge > 0
  const fittingOnlyMode = fittingOnly === 'true';

  const pipeline = [
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    { $unwind: '$items' },
    ...(fittingOnlyMode ? [{ $match: { 'items.fittingCharge': { $gt: 0 } } }] : []),
    {
      $group: {
        _id: '$items.product',
        productName: { $first: '$items.productName' },
        category: { $first: '$items.category' },
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.lineTotal' },
        billCount: { $sum: 1 },
        avgRate: { $avg: '$items.rate' },
        // Fitting revenue aggregation
        totalFittingRevenue: {
          $sum: {
            $cond: [
              { $eq: ['$items.fittingChargeType', 'fixed'] },
              '$items.fittingCharge',
              { $multiply: ['$items.quantity', '$items.fittingCharge'] },
            ],
          },
        },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ];

  if (category) {
    pipeline.push({ $match: { category } });
  }

  if (product) {
    pipeline.push({ $match: { productName: { $regex: product, $options: 'i' } } });
  }

  const salesData = await Bill.aggregate(pipeline);

  // Get all raw materials with their stored average rates
  const RawMaterial = require('../models/RawMaterial');
  const allMaterials = await RawMaterial.find({}).select('avgRate').lean();
  const materialRateMap = {};
  allMaterials.forEach((m) => {
    materialRateMap[m._id.toString()] = m.avgRate || 0;
  });

  // Get products with materialConsumption
  const productIds = salesData.map((s) => s._id).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('materialConsumption unit')
    .lean();

  const productConsumptionMap = {};
  const productUnitMap = {};
  products.forEach((p) => {
    productUnitMap[p._id.toString()] = p.unit || 'piece';
    if (p.materialConsumption && p.materialConsumption.length > 0) {
      let costPerUnit = 0;
      p.materialConsumption.forEach((mc) => {
        const matId = mc.rawMaterial.toString();
        const matRate = materialRateMap[matId] || 0;
        costPerUnit += mc.quantityPerUnit * matRate;
      });
      productConsumptionMap[p._id.toString()] = costPerUnit;
    }
  });

  // Enrich sales data with profit
  const enrichedData = salesData.map((item) => {
    const costPerUnit = productConsumptionMap[item._id?.toString()] || 0;
    const unit = productUnitMap[item._id?.toString()] || 'piece';
    const totalCost = Math.round(item.totalQuantity * costPerUnit * 100) / 100;
    const profit = Math.round((item.totalRevenue - totalCost) * 100) / 100;
    const fittingRevenue = Math.round((item.totalFittingRevenue || 0) * 100) / 100;
    return {
      ...item,
      unit,
      costPerUnit: Math.round(costPerUnit * 100) / 100,
      totalCost,
      profit,
      fittingRevenue,
      fittingProfit: fittingRevenue, // fitting is pure service revenue, no material cost
      profitMargin: item.totalRevenue > 0 ? Math.round((profit / item.totalRevenue) * 10000) / 100 : 0,
      hasCostData: costPerUnit > 0,
    };
  });

  const totals = enrichedData.reduce(
    (acc, item) => {
      acc.totalRevenue += item.totalRevenue;
      acc.totalQuantity += item.totalQuantity;
      acc.totalBills += item.billCount;
      acc.totalCost += item.totalCost;
      acc.totalProfit += item.profit;
      acc.totalFittingRevenue += item.fittingRevenue;
      return acc;
    },
    { totalRevenue: 0, totalQuantity: 0, totalBills: 0, totalCost: 0, totalProfit: 0, totalFittingRevenue: 0 }
  );

  // Calculate total customer less (write-offs) for the period
  const lessFilter = {};
  if (startDate || endDate) {
    lessFilter.createdAt = {};
    if (startDate) lessFilter.createdAt.$gte = new Date(startDate);
    if (endDate) lessFilter.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }
  const lessAgg = await Payment.aggregate([
    { $match: lessFilter },
    { $group: { _id: null, totalLess: { $sum: { $ifNull: ['$lessAmount', 0] } } } },
  ]);
  totals.totalCustomerLess = lessAgg[0]?.totalLess || 0;

  res.json({
    success: true,
    count: enrichedData.length,
    totals,
    data: enrichedData,
  });
});

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  getCategories,
  addCategory,
  deleteCategory,
  getProductSalesReport,
};
