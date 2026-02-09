const express = require('express');
const router = express.Router();
const { getLogs } = require('../controllers/activityLogController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('owner'), getLogs);

module.exports = router;
