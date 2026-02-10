const express = require('express');
const router = express.Router();
const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  getCategories,
  addCategory,
  deleteCategory,
  getProductSalesReport,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');
const { productRules, mongoIdParam, validate } = require('../middleware/validators');

router.use(protect);

// Categories
router.route('/categories')
  .get(getCategories)
  .post(authorize('owner'), addCategory);
router.delete('/categories/:name', authorize('owner'), deleteCategory);

// Sales report (owner only)
router.get('/sales-report', authorize('owner'), getProductSalesReport);

router.route('/').get(getProducts).post(authorize('owner'), productRules, validate, createProduct);
router
  .route('/:id')
  .get(mongoIdParam, validate, getProduct)
  .put(authorize('owner'), mongoIdParam, validate, updateProduct);

module.exports = router;
