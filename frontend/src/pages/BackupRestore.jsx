import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineCloudDownload,
  HiOutlineUpload,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineLockClosed,
  HiOutlineShieldCheck,
  HiOutlineDatabase,
  HiOutlineServer,
} from 'react-icons/hi';
import {
  downloadFullDatabaseBackup,
  restoreDatabaseFromBackup,
} from '../services/financialYearApi';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BackupRestore() {
  const [fullBackupLoading, setFullBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreMode, setRestoreMode] = useState('merge');
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const fileInputRef = useRef(null);

  // ─── Full DB Backup ───────────────────────────────────────────────
  const handleFullBackup = async () => {
    setFullBackupLoading(true);
    try {
      const response = await downloadFullDatabaseBackup();
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `factory_backup_FULL_${ts}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Full database backup downloaded!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Backup failed');
    } finally {
      setFullBackupLoading(false);
    }
  };

  // ─── Restore ──────────────────────────────────────────────────────
  const handleRestore = async () => {
    if (!restoreFile) return toast.error('Please select a backup ZIP file.');
    if (!restorePassword) return toast.error('Please enter your password.');
    if (!restoreConfirm) return toast.error('Please confirm the checkbox.');

    setRestoreLoading(true);
    try {
      const { data } = await restoreDatabaseFromBackup(
        restoreFile,
        restoreMode,
        restorePassword
      );
      setRestoreResult(data.data);
      setRestoreFile(null);
      setRestorePassword('');
      setRestoreConfirm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success(data.message || 'Restore completed!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Restore failed');
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <HiOutlineServer className="w-7 h-7 text-cyan-400" />
          Backup & Restore
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Download a full database snapshot or restore from a previous backup.
        </p>
      </div>

      {/* ═══ DOWNLOAD BACKUP ═══ */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-600/10">
            <HiOutlineCloudDownload className="w-6 h-6 text-cyan-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Download Full Backup</h2>
            <p className="text-sm text-gray-500 mt-1">
              Exports <strong className="text-gray-400">ALL</strong> collections — bills, payments, customers,
              products, workers, attendance, salary records, stock logs, and more — into a single compressed ZIP.
            </p>
          </div>
        </div>

        <div className="bg-dark-bg rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <HiOutlineDatabase className="w-4 h-4 text-gray-500" />
                <span>Includes 21 collections with all documents</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                <HiOutlineShieldCheck className="w-4 h-4 text-gray-500" />
                <span>Passwords & credentials are securely included</span>
              </div>
            </div>
            <button
              onClick={handleFullBackup}
              disabled={fullBackupLoading}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {fullBackupLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <HiOutlineCloudDownload className="w-5 h-5" />
              )}
              {fullBackupLoading ? 'Preparing...' : 'Download Backup'}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-600">
          Save the downloaded ZIP to Google Drive, external hard drive, or USB for safekeeping.
        </p>
      </div>

      {/* ═══ RESTORE FROM BACKUP ═══ */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-amber-600/10">
            <HiOutlineUpload className="w-6 h-6 text-amber-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Restore from Backup</h2>
            <p className="text-sm text-gray-500 mt-1">
              Upload a previously downloaded backup ZIP to restore data into the database.
            </p>
          </div>
        </div>

        {/* File upload */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Backup ZIP File
          </label>
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-400
                file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0
                file:text-sm file:font-medium file:bg-dark-hover file:text-gray-300
                hover:file:bg-dark-border file:cursor-pointer cursor-pointer
                bg-dark-bg border border-dark-border rounded-lg"
            />
            {restoreFile && (
              <p className="text-xs text-green-400 mt-1.5">
                Selected: {restoreFile.name} ({(restoreFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
        </div>

        {/* Restore mode */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-3">
            Restore Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                restoreMode === 'merge'
                  ? 'border-cyan-600 bg-cyan-600/5'
                  : 'border-dark-border bg-dark-bg hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="restoreMode"
                value="merge"
                checked={restoreMode === 'merge'}
                onChange={() => setRestoreMode('merge')}
                className="mt-0.5 w-4 h-4 text-cyan-500 bg-dark-bg border-gray-600"
              />
              <div>
                <p className="text-sm text-gray-200 font-medium">Merge (Safe)</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Adds missing records only, skips records that already exist.
                  Your current data stays intact.
                </p>
              </div>
            </label>
            <label
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                restoreMode === 'replace'
                  ? 'border-red-600 bg-red-600/5'
                  : 'border-dark-border bg-dark-bg hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="restoreMode"
                value="replace"
                checked={restoreMode === 'replace'}
                onChange={() => setRestoreMode('replace')}
                className="mt-0.5 w-4 h-4 text-red-500 bg-dark-bg border-gray-600"
              />
              <div>
                <p className="text-sm text-gray-200 font-medium">Full Replace</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Wipes ALL existing data, then inserts from backup.
                  Only for disaster recovery.
                </p>
              </div>
            </label>
          </div>
        </div>

        {restoreMode === 'replace' && (
          <div className="flex items-start gap-2 text-red-300 bg-red-900/20 border border-red-800 px-4 py-3 rounded-lg text-sm">
            <HiOutlineExclamationCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Full Replace will DELETE all existing data first!</p>
              <p className="mt-1 text-red-400">
                Use this only if your database is empty or corrupted.
                All current data will be permanently wiped and replaced.
              </p>
            </div>
          </div>
        )}

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">
            <HiOutlineLockClosed className="w-4 h-4 inline mr-1" />
            Owner Password
          </label>
          <input
            type="password"
            value={restorePassword}
            onChange={(e) => setRestorePassword(e.target.value)}
            placeholder="Enter your password to authorize"
            className="w-full sm:max-w-md bg-dark-bg border border-dark-border rounded-lg px-4 py-2.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Confirmation */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={restoreConfirm}
            onChange={(e) => setRestoreConfirm(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-gray-600 text-amber-500 focus:ring-amber-500 bg-dark-bg"
          />
          <span className="text-sm text-gray-300">
            I understand the implications and want to proceed with the restore operation.
          </span>
        </label>

        <button
          onClick={handleRestore}
          disabled={restoreLoading || !restoreFile || !restorePassword || !restoreConfirm}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {restoreLoading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <HiOutlineUpload className="w-5 h-5" />
          )}
          {restoreLoading ? 'Restoring...' : 'Restore Database'}
        </button>
      </div>

      {/* ═══ RESTORE RESULT ═══ */}
      {restoreResult && (
        <div className="bg-dark-card border border-green-800 rounded-xl p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-green-400 flex items-center gap-2">
            <HiOutlineCheckCircle className="w-6 h-6" />
            Restore Complete ({restoreResult.mode} mode)
          </h2>

          <div className="flex flex-wrap gap-4 sm:gap-8 text-sm">
            <div>
              <span className="text-gray-500">Documents Inserted</span>
              <p className="text-2xl font-bold text-green-400">{restoreResult.totalInserted}</p>
            </div>
            <div>
              <span className="text-gray-500">Skipped (duplicates)</span>
              <p className="text-2xl font-bold text-amber-400">{restoreResult.totalSkipped}</p>
            </div>
          </div>

          {restoreResult.backupMetadata?.timestamp && (
            <p className="text-xs text-gray-500">
              Backup was created on: {formatDate(restoreResult.backupMetadata.timestamp)}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
            {Object.entries(restoreResult.collections || {}).map(([key, val]) =>
              val.total > 0 ? (
                <div key={key} className="bg-dark-bg rounded-lg px-3 py-2.5 border border-dark-border">
                  <span className="text-gray-400 capitalize block">{key}</span>
                  <div className="text-gray-200 font-medium mt-0.5">
                    {val.inserted} inserted
                    {val.skipped > 0 && (
                      <span className="text-amber-400 ml-1">({val.skipped} skipped)</span>
                    )}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
