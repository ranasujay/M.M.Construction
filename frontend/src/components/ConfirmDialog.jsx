import { HiOutlineExclamationCircle, HiOutlineCheckCircle, HiOutlineInformationCircle } from 'react-icons/hi';

/**
 * Reusable confirmation dialog for important actions.
 * 
 * Props:
 *   isOpen       - boolean
 *   onClose      - fn()
 *   onConfirm    - fn()
 *   title        - string
 *   message      - string | ReactNode
 *   confirmText  - string (default "Confirm")
 *   cancelText   - string (default "Cancel")
 *   variant      - 'danger' | 'warning' | 'info' (default 'warning')
 *   loading      - boolean (disable buttons while processing)
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  loading = false,
}) {
  if (!isOpen) return null;

  const icons = {
    danger: <HiOutlineExclamationCircle className="w-10 h-10 text-red-400" />,
    warning: <HiOutlineExclamationCircle className="w-10 h-10 text-amber-400" />,
    info: <HiOutlineInformationCircle className="w-10 h-10 text-primary-400" />,
    success: <HiOutlineCheckCircle className="w-10 h-10 text-emerald-400" />,
  };

  const btnClass = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    info: 'btn-primary',
    success: 'btn-success',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-dark-card border border-dark-border sm:rounded-xl rounded-t-2xl shadow-2xl w-full max-w-sm p-5 sm:p-6">
        <div className="flex flex-col items-center text-center">
          {icons[variant]}
          <h3 className="text-base font-semibold text-gray-100 mt-3">{title}</h3>
          {message && (
            <div className="text-sm text-gray-400 mt-2 leading-relaxed">{message}</div>
          )}
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary flex-1 justify-center"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 justify-center py-2.5 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${btnClass[variant]}`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
