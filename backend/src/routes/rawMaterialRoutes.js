const express = require('express');
const router = express.Router();
const {
  createRawMaterial,
  getRawMaterials,
  getRawMaterial,
  updateRawMaterial,
  adjustStock,
  getStockDashboard,
} = require('../controllers/rawMaterialController');
const { protect, authorize } = require('../middleware/auth');

// All routes require auth
router.use(protect);

// Dashboard (must be before /:id)
router.get('/dashboard', authorize('owner'), getStockDashboard);

router.route('/')
  .get(getRawMaterials)
  .post(authorize('owner'), createRawMaterial);

router.route('/:id')
  .get(getRawMaterial)
  .put(authorize('owner'), updateRawMaterial);

router.post('/:id/adjust', authorize('owner'), adjustStock);

module.exports = router;
