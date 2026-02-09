export default function StatCard({ icon: Icon, label, value, color = 'primary', subtext }) {
  const colorClasses = {
    primary: 'text-primary-400 bg-primary-400/10',
    green: 'text-emerald-400 bg-emerald-400/10',
    red: 'text-red-400 bg-red-400/10',
    yellow: 'text-amber-400 bg-amber-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
  };

  return (
    <div className="stat-card !p-3 sm:!p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="stat-label text-[10px] sm:text-xs truncate">{label}</p>
          <p className="stat-value mt-0.5 text-base sm:text-xl truncate">{value}</p>
          {subtext && <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 truncate">{subtext}</p>}
        </div>
        {Icon && (
          <div className={`p-2 sm:p-3 rounded-xl flex-shrink-0 ${colorClasses[color]}`}>
            <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
