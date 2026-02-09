const express = require('express');
const router = express.Router();
const { login, register, getMe, getUsers, updateUserStatus, updateUserCredentials } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');
const { loginRules, registerRules, validate } = require('../middleware/validators');

router.post('/login', loginRules, validate, login);
router.post('/register', protect, authorize('owner'), registerRules, validate, register);
router.get('/me', protect, getMe);
router.get('/users', protect, authorize('owner'), getUsers);
router.put('/users/:id/status', protect, authorize('owner'), updateUserStatus);
router.put('/users/:id/credentials', protect, authorize('owner'), updateUserCredentials);

module.exports = router;
