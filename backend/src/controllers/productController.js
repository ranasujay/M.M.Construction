const Product = require('../models/Product');
const Category = require('../models/Category');
const Bill = require('../models/Bill');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

const DEFAULT_CATEGORIES = ['Grill', 'Shutter', 'Railing', 'Window', 'Gate', 'Custom'];

/**
 * @desc    Create product
 * @route   POST /api/products
 */
const createProduct = asyncHandler(async (req, res) => {
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
    .sort('category name');

  res.json({ success: true, count: products.length, data: products });
});

/**
 * @desc    Get single product
 * @route   GET /api/products/:id
 */
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
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

  const oldRate = product.baseRate;

  const allowed = [
    'name', 'category', 'baseRate', 'unit',
    'fittingCharge', 'fittingChargeType', 'description', 'isActive',
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
  const { startDate, endDate, category } = req.query;

  const matchStage = {};
  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const pipeline = [
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        productName: { $first: '$items.productName' },
        category: { $first: '$items.category' },
        totalQuantity: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.lineTotal' },
        billCount: { $sum: 1 },
        avgRate: { $avg: '$items.rate' },
      },
    },
    { $sort: { totalRevenue: -1 } },
  ];

  if (category) {
    pipeline.push({ $match: { category } });
  }

  const salesData = await Bill.aggregate(pipeline);

  const totals = salesData.reduce(
    (acc, item) => {
      acc.totalRevenue += item.totalRevenue;
      acc.totalQuantity += item.totalQuantity;
      acc.totalBills += item.billCount;
      return acc;
    },
    { totalRevenue: 0, totalQuantity: 0, totalBills: 0 }
  );

  res.json({
    success: true,
    count: salesData.length,
    totals,
    data: salesData,
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
