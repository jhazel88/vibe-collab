/**
 * TrialCard — compact card showing trial NCT ID, title, phase, status, sponsor.
 */

const STATUS_COLORS = {
  recruiting: "bg-green-50 text-green-700",
  active_not_recruiting: "bg-yellow-50 text-yellow-700",
  completed: "bg-blue-50 text-blue-700",
  terminated: "bg-red-50 text-red-700",
  withdrawn: "bg-red-50 text-red-700",
  suspended: "bg-orange-50 text-orange-700",
};

export default function TrialCard({ trial, onClick }) {
  const statusClass = STATUS_COLORS[trial.status] || "bg-gray-50 text-gray-700";

  return (
    <button
      onClick={() => onClick?.(trial)}
      className="w-full text-left p-4 bg-white rounded-lg border border-gray-200
                 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
              {trial.nct_id}
            </span>
            {trial.phase && (
              <span className="text-xs font-medium text-gray-500 uppercase">
                {trial.phase.replace("phase", "Phase ")}
              </span>
            )}
          </div>
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2">
            {trial.title}
          </h3>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
        {trial.status && (
          <span className={`inline-block px-2 py-0.5 rounded font-medium ${statusClass}`}>
            {trial.status.replace(/_/g, " ")}
          </span>
        )}
        {trial.sponsor_name && (
          <span className="truncate">{trial.sponsor_name}</span>
        )}
        {trial.enrollment && (
          <span>n={trial.enrollment}</span>
        )}
      </div>

      {trial.conditions?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {trial.conditions.slice(0, 3).map((c) => (
            <span key={c} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
              {c}
            </span>
          ))}
        </div>
      )}

      {trial.source_url && (
        <div className="mt-2">
          <a
            href={trial.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-indigo-500 hover:underline"
          >
            View on ClinicalTrials.gov →
          </a>
        </div>
      )}
    </button>
  );
}
