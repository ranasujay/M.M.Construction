const express = require('express');
const router = express.Router();
const {
  createWorker,
  getWorkers,
  getWorker,
  updateWorker,
  toggleWorkerStatus,
} = require('../controllers/workerController');
const { protect, authorize } = require('../middleware/auth');
const { workerRules, mongoIdParam, validate } = require('../middleware/validators');

// All worker routes require auth + owner role
router.use(protect);
router.use(authorize('owner'));

router.route('/').get(getWorkers).post(workerRules, validate, createWorker);
router.route('/:id').get(mongoIdParam, validate, getWorker).put(mongoIdParam, workerRules, validate, updateWorker);
router.patch('/:id/toggle-status', mongoIdParam, validate, toggleWorkerStatus);

module.exports = router;
