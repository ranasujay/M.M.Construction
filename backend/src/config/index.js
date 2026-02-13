const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/mm_construction',
  jwtSecret: process.env.JWT_SECRET || 'fallback_secret',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  backupTempPath: process.env.BACKUP_TEMP_PATH || './temp-backups',
};
