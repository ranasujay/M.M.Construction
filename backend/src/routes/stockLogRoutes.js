const express = require('express');
const router = express.Router();
const { getStockLogs } = require('../controllers/stockLogController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('owner'), getStockLogs);

module.exports = router;
