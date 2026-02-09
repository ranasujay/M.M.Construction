const User = require('../models/User');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { generateToken } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  if (!user.isActive) {
    throw new AppError('Account deactivated. Contact admin.', 403);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = generateToken(user._id);

  logActivity({
    action: 'USER_LOGIN',
    entity: 'user',
    entityId: user._id,
    description: `${user.name} logged in`,
    performedBy: user._id,
  });

  res.json({
    success: true,
    data: {
      user: user.toJSON(),
      token,
    },
  });
});

/**
 * @desc    Register new user (owner only)
 * @route   POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('Email already registered', 400);
  }

  const user = await User.create({ name, email, password, phone, role });
  const token = generateToken(user._id);

  logActivity({
    action: 'USER_CREATED',
    entity: 'user',
    entityId: user._id,
    description: `New user "${name}" created with role "${role || 'staff'}"`,
    performedBy: req.user ? req.user._id : user._id,
  });

  res.status(201).json({
    success: true,
    data: {
      user: user.toJSON(),
      token,
    },
  });
});

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
});

/**
 * @desc    Get all users (owner only)
 * @route   GET /api/auth/users
 */
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find().sort('-createdAt');
  res.json({ success: true, count: users.length, data: users });
});

/**
 * @desc    Update user status (activate/deactivate)
 * @route   PUT /api/auth/users/:id/status
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);

  user.isActive = req.body.isActive;
  await user.save();

  logActivity({
    action: 'USER_STATUS_CHANGED',
    entity: 'user',
    entityId: user._id,
    description: `User "${user.name}" ${user.isActive ? 'activated' : 'deactivated'}`,
    performedBy: req.user._id,
  });

  res.json({ success: true, data: user });
});

/**
 * @desc    Update user credentials (name, email, password, phone, role)
 * @route   PUT /api/auth/users/:id/credentials
 */
const updateUserCredentials = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+password');
  if (!user) throw new AppError('User not found', 404);

  const { name, email, password, phone, role } = req.body;

  // Check email uniqueness if changed
  if (email && email !== user.email) {
    const existing = await User.findOne({ email });
    if (existing) throw new AppError('Email already in use', 400);
    user.email = email;
  }

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (role) user.role = role;
  if (password && password.length >= 6) user.password = password;

  await user.save();

  logActivity({
    action: 'USER_CREDENTIALS_UPDATED',
    entity: 'user',
    entityId: user._id,
    description: `Credentials updated for "${user.name}"${password ? ' (password changed)' : ''}`,
    performedBy: req.user._id,
  });

  res.json({ success: true, data: user });
});

module.exports = { login, register, getMe, getUsers, updateUserStatus, updateUserCredentials };
