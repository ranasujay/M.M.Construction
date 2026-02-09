import { HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MonthYearPicker({ month, year, onChange }) {
  const handlePrev = () => {
    if (month === 1) {
      onChange(12, year - 1);
    } else {
      onChange(month - 1, year);
    }
  };

  const handleNext = () => {
    if (month === 12) {
      onChange(1, year + 1);
    } else {
      onChange(month + 1, year);
    }
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      <button
        onClick={handlePrev}
        className="p-2 rounded-lg bg-dark-card border border-dark-border hover:bg-dark-hover active:bg-dark-bg text-gray-400 hover:text-gray-200 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
      >
        <HiOutlineChevronLeft className="w-5 h-5" />
      </button>
      <div className="text-center min-w-[120px] sm:min-w-[160px]">
        <span className="text-sm sm:text-lg font-semibold text-gray-100">
          {MONTH_NAMES[month - 1].substring(0, 3)} {year}
        </span>
      </div>
      <button
        onClick={handleNext}
        className="p-2 rounded-lg bg-dark-card border border-dark-border hover:bg-dark-hover active:bg-dark-bg text-gray-400 hover:text-gray-200 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
      >
        <HiOutlineChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
