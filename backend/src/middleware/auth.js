const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { AppError, asyncHandler } = require('./errorHandler');

/**
 * Protect routes - verify JWT token
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AppError('Not authorized. No token provided.', 401);
  }

  const decoded = jwt.verify(token, config.jwtSecret);
  const user = await User.findById(decoded.id);

  if (!user) {
    throw new AppError('User not found.', 401);
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated. Contact admin.', 403);
  }

  req.user = user;
  next();
});

/**
 * Role-based authorization
 * @param  {...string} roles - Allowed roles ('owner', 'staff')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new AppError(
        `Role '${req.user.role}' is not authorized to access this resource.`,
        403
      );
    }
    next();
  };
};

/**
 * Generate JWT token
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwtSecret, {
    expiresIn: config.jwtExpire,
  });
};

module.exports = { protect, authorize, generateToken };
