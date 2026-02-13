const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

/**
 * Utility to export data as JSON and compress to ZIP.
 * Pure Node.js implementation — no mongodump required.
 */

/**
 * Get the temp backup directory, creating it if needed.
 */
function getTempDir() {
  const tempDir = process.env.BACKUP_TEMP_PATH || path.join(process.cwd(), 'temp-backups');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

/**
 * Export structured backup data to a JSON file.
 * @param {Object} data - The backup data object
 * @param {string} financialYear - e.g. "2024-2025"
 * @returns {string} Path to the created JSON file
 */
function exportToJSON(data, financialYear) {
  const tempDir = getTempDir();
  const jsonFileName = `backup_FY_${financialYear}.json`;
  const jsonPath = path.join(tempDir, jsonFileName);

  const jsonContent = JSON.stringify(data, null, 2);
  fs.writeFileSync(jsonPath, jsonContent, 'utf-8');

  return jsonPath;
}

/**
 * Compress a JSON file to a ZIP archive.
 * @param {string} jsonFilePath - Path to the JSON file
 * @param {string} financialYear - e.g. "2024-2025"
 * @returns {Promise<{ zipPath: string, zipFileName: string, sizeBytes: number }>}
 */
function compressToZip(jsonFilePath, financialYear) {
  return new Promise((resolve, reject) => {
    const tempDir = getTempDir();
    const zipFileName = `factory_backup_FY_${financialYear}.zip`;
    const zipPath = path.join(tempDir, zipFileName);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } }); // max compression

    output.on('close', () => {
      resolve({
        zipPath,
        zipFileName,
        sizeBytes: archive.pointer(),
      });
    });

    archive.on('error', (err) => reject(err));
    archive.pipe(output);

    // Add the JSON file to the archive
    const jsonFileName = path.basename(jsonFilePath);
    archive.file(jsonFilePath, { name: jsonFileName });

    archive.finalize();
  });
}

/**
 * Cleanup temporary files after upload.
 * @param  {...string} filePaths - Paths to delete
 */
function cleanupTempFiles(...filePaths) {
  for (const fp of filePaths) {
    try {
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
      }
    } catch (err) {
      console.error(`[Cleanup] Failed to delete ${fp}:`, err.message);
    }
  }
}

module.exports = { exportToJSON, compressToZip, cleanupTempFiles, getTempDir };
