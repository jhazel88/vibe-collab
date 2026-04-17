/**
 * SearchBar — debounced search input with loading indicator.
 */
export default function SearchBar({ value, onChange, loading, placeholder }) {
  return (
    <div className="relative w-full max-w-2xl">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search sponsors, trials, countries..."}
        className="w-full pl-12 pr-12 py-3 text-base border border-gray-300 rounded-xl
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                   bg-white shadow-sm placeholder-gray-400"
      />
      {loading && (
        <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
