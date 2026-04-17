/**
 * SponsorCard — compact card showing sponsor name, type, HQ, therapeutic areas.
 */
export default function SponsorCard({ sponsor, onClick }) {
  const hq = sponsor.headquarters;
  const location = hq
    ? [hq.city, hq.country].filter(Boolean).join(", ")
    : null;

  return (
    <button
      onClick={() => onClick?.(sponsor)}
      className="w-full text-left p-4 bg-white rounded-lg border border-gray-200
                 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900 truncate">
            {sponsor.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            {sponsor.type && (
              <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                {sponsor.type}
              </span>
            )}
            {location && <span>{location}</span>}
          </div>
        </div>
      </div>

      {sponsor.therapeutic_areas?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {sponsor.therapeutic_areas.slice(0, 4).map((area) => (
            <span
              key={area}
              className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
            >
              {area}
            </span>
          ))}
          {sponsor.therapeutic_areas.length > 4 && (
            <span className="text-xs text-gray-400">
              +{sponsor.therapeutic_areas.length - 4} more
            </span>
          )}
        </div>
      )}
    </button>
  );
}
