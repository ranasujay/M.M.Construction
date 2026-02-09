import { useState } from 'react';
import {
  HiOutlineExclamation,
  HiOutlineInformationCircle,
  HiOutlineCheckCircle,
  HiOutlineX,
  HiOutlineBell,
} from 'react-icons/hi';

const VARIANTS = {
  warning: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: HiOutlineExclamation,
    iconColor: 'text-amber-400',
    textColor: 'text-amber-200',
    subColor: 'text-amber-300/70',
    btnColor: 'hover:bg-amber-500/20 text-amber-400',
    dot: 'bg-amber-400',
  },
  danger: {
    bg: 'bg-red-500/10 border-red-500/30',
    icon: HiOutlineExclamation,
    iconColor: 'text-red-400',
    textColor: 'text-red-200',
    subColor: 'text-red-300/70',
    btnColor: 'hover:bg-red-500/20 text-red-400',
    dot: 'bg-red-400',
  },
  info: {
    bg: 'bg-blue-500/10 border-blue-500/30',
    icon: HiOutlineInformationCircle,
    iconColor: 'text-blue-400',
    textColor: 'text-blue-200',
    subColor: 'text-blue-300/70',
    btnColor: 'hover:bg-blue-500/20 text-blue-400',
    dot: 'bg-blue-400',
  },
  success: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    icon: HiOutlineCheckCircle,
    iconColor: 'text-emerald-400',
    textColor: 'text-emerald-200',
    subColor: 'text-emerald-300/70',
    btnColor: 'hover:bg-emerald-500/20 text-emerald-400',
    dot: 'bg-emerald-400',
  },
};

export default function AlertBanner({
  variant = 'warning',
  title,
  message,
  dismissible = true,
  action,
  actionLabel,
  icon: CustomIcon,
  pulse = false,
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const v = VARIANTS[variant] || VARIANTS.warning;
  const IconComp = CustomIcon || v.icon;

  return (
    <div className={`relative flex items-start gap-3 p-3 sm:p-4 rounded-xl border ${v.bg} animate-in fade-in slide-in-from-top-2`}>
      {/* Pulse dot */}
      {pulse && (
        <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${v.dot} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${v.dot}`} />
        </span>
      )}

      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 ${v.iconColor}`}>
        <IconComp className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <p className={`text-sm sm:text-base font-semibold ${v.textColor}`}>{title}</p>
        )}
        {message && (
          <p className={`text-xs sm:text-sm mt-0.5 ${v.subColor}`}>{message}</p>
        )}
        {action && actionLabel && (
          <button
            onClick={action}
            className={`mt-2 text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${v.btnColor}`}
          >
            {actionLabel}
          </button>
        )}
      </div>

      {/* Dismiss */}
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className={`flex-shrink-0 p-1 rounded-lg transition-colors ${v.btnColor}`}
        >
          <HiOutlineX className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
