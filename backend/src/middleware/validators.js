const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

/**
 * Middleware to check validation results
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    throw new AppError(messages.join(', '), 400);
  }
  next();
};

// ─── Auth Validators ────────────────────────────────────────────────
const loginRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['owner', 'staff']).withMessage('Invalid role'),
];

// ─── Customer Validators ────────────────────────────────────────────
const customerRules = [
  body('name').trim().notEmpty().withMessage('Customer name is required'),
  body('phone').trim().notEmpty().withMessage('WhatsApp number is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
];

// ─── Product Validators ─────────────────────────────────────────────
const productRules = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('category')
    .isIn(['Grill', 'Shutter', 'Railing', 'Window', 'Gate', 'Custom'])
    .withMessage('Invalid category'),
  body('baseRate').isFloat({ min: 0 }).withMessage('Base rate must be a positive number'),
  body('unit').isIn(['kg', 'sqft', 'piece', 'rft']).withMessage('Invalid unit'),
  body('fittingCharge').optional().isFloat({ min: 0 }),
  body('fittingChargeType')
    .optional()
    .isIn(['per_kg', 'per_sqft', 'per_piece', 'fixed']),
];

// ─── Bill Validators ────────────────────────────────────────────────
const billRules = [
  body('customer').isMongoId().withMessage('Valid customer ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('items.*.product').isMongoId().withMessage('Valid product ID is required'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('Quantity must be > 0'),
  body('items.*.rate').isFloat({ min: 0 }).withMessage('Rate must be >= 0'),
  body('discount').optional().isFloat({ min: 0 }),
  body('discountType').optional().isIn(['flat', 'percent']),
  body('advancePayment').optional().isFloat({ min: 0 }),
  body('deliveryDate').optional().isISO8601(),
];

// ─── Payment Validators ─────────────────────────────────────────────
const paymentRules = [
  body('customer').isMongoId().withMessage('Valid customer ID is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be > 0'),
  body('mode').isIn(['Cash', 'UPI', 'Bank', 'Cheque']).withMessage('Invalid payment mode'),
  body('referenceNumber').optional().trim(),
];

// ─── Promise Validators ─────────────────────────────────────────────
const promiseRules = [
  body('customer').isMongoId().withMessage('Valid customer ID is required'),
  body('promiseDate').isISO8601().withMessage('Valid promise date is required'),
  body('promisedAmount').isFloat({ min: 0.01 }).withMessage('Amount must be > 0'),
];

// ─── Mongo ID Param Validator ────────────────────────────────────────
const mongoIdParam = [param('id').isMongoId().withMessage('Invalid ID format')];

module.exports = {
  validate,
  loginRules,
  registerRules,
  customerRules,
  productRules,
  billRules,
  paymentRules,
  promiseRules,
  mongoIdParam,
};
