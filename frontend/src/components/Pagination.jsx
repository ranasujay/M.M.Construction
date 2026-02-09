export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-30"
      >
        Prev
      </button>
      {start > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className="btn-secondary px-3 py-1.5 text-sm">1</button>
          {start > 2 && <span className="text-gray-500">...</span>}
        </>
      )}
      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
            page === currentPage
              ? 'bg-primary-600 text-white'
              : 'btn-secondary'
          }`}
        >
          {page}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-gray-500">...</span>}
          <button onClick={() => onPageChange(totalPages)} className="btn-secondary px-3 py-1.5 text-sm">{totalPages}</button>
        </>
      )}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-30"
      >
        Next
      </button>
    </div>
  );
}
