const Product = require('../models/Product');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { logActivity } = require('../utils/activityLogger');

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

module.exports = { createProduct, getProducts, getProduct, updateProduct };
