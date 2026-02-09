const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const { productRules, mongoIdParam, validate } = require('../middleware/validators');

router.use(protect);

router.route('/').get(getProducts).post(authorize('owner'), productRules, validate, createProduct);
router
  .route('/:id')
  .get(mongoIdParam, validate, getProduct)
  .put(authorize('owner'), mongoIdParam, validate, updateProduct);

module.exports = router;
