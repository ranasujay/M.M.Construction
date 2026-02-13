const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, authorize } = require('../middleware/auth');
const {
  getFinancialYearPreview,
  createBackup,
  downloadBackup,
  verifyBackup,
  deleteFinancialYearData,
  getBackupRecords,
  getAllSummaries,
  getFinancialYearStatus,
  createFullBackup,
  restoreFromBackup,
} = require('../controllers/financialYearController');

// Multer config — memory storage for restore uploads (max 100 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are allowed'), false);
    }
  },
});

// All routes require authentication + owner role
router.use(protect);
router.use(authorize('owner'));

// GET summaries & backup records
router.get('/summaries', getAllSummaries);
router.get('/backups', getBackupRecords);

// Full database backup & restore
router.get('/full-backup', createFullBackup);
router.post('/restore', upload.single('backupFile'), restoreFromBackup);

// Financial year specific operations
router.get('/:financialYear/status', getFinancialYearStatus);
router.get('/:financialYear/preview', getFinancialYearPreview);
router.post('/:financialYear/backup', createBackup);
router.get('/:financialYear/download', downloadBackup);
router.post('/:financialYear/verify', verifyBackup);
router.post('/:financialYear/delete', deleteFinancialYearData);

module.exports = router;
