import { useState, useEffect } from "react";
import { getTrial } from "../lib/api-client.js";

/**
 * TrialPage — full detail view for a single clinical trial.
 */
export default function TrialPage({ nctId, onNavigate }) {
  const [trial, setTrial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getTrial(nctId)
      .then((res) => {
        if (!cancelled) setTrial(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [nctId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !trial) {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => onNavigate?.("search")} className="text-sm text-indigo-600 hover:underline mb-4 cursor-pointer">
          ← Back to search
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || "Trial not found"}
        </div>
      </div>
    );
  }

  const interventions = trial.interventions
    ? (typeof trial.interventions === "string" ? JSON.parse(trial.interventions) : trial.interventions)
    : [];

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => onNavigate?.("search")} className="text-sm text-indigo-600 hover:underline mb-6 cursor-pointer">
        ← Back to search
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 leading-tight">{trial.title}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm font-mono">
            {trial.nct_id}
          </span>
          {trial.phase && (
            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-sm font-medium">
              {trial.phase}
            </span>
          )}
          {trial.status && (
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              trial.status === "recruiting"
                ? "bg-green-50 text-green-700"
                : trial.status === "completed"
                ? "bg-blue-50 text-blue-700"
                : "bg-gray-100 text-gray-700"
            }`}>
              {trial.status.replace(/_/g, " ")}
            </span>
          )}
          {trial.results_available && (
            <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-sm font-medium">
              Results available
            </span>
          )}
        </div>
      </div>

      {/* Key facts grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {trial.sponsor_name && (
          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-500">Sponsor</p>
            <p className="text-sm font-medium text-gray-900">{trial.sponsor_name}</p>
            {trial.sponsor_class && (
              <p className="text-xs text-gray-400">{trial.sponsor_class}</p>
            )}
          </div>
        )}
        {trial.enrollment && (
          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-500">Enrollment</p>
            <p className="text-sm font-medium text-gray-900">{trial.enrollment.toLocaleString()}</p>
          </div>
        )}
        {trial.start_date && (
          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-500">Start date</p>
            <p className="text-sm font-medium text-gray-900">{trial.start_date}</p>
          </div>
        )}
        {trial.primary_completion_date && (
          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-500">Primary completion</p>
            <p className="text-sm font-medium text-gray-900">{trial.primary_completion_date}</p>
          </div>
        )}
      </div>

      {/* Conditions */}
      {trial.conditions?.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Conditions</h2>
          <div className="flex flex-wrap gap-2">
            {trial.conditions.map((c) => (
              <span key={c} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Interventions */}
      {interventions.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Interventions</h2>
          <div className="space-y-2">
            {interventions.map((iv, i) => (
              <div key={i} className="p-3 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{iv.name || "Unnamed"}</span>
                  {iv.type && (
                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">
                      {iv.type}
                    </span>
                  )}
                </div>
                {iv.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{iv.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Countries */}
      {trial.countries?.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Countries</h2>
          <div className="flex flex-wrap gap-2">
            {trial.countries.map((c) => (
              <span key={c} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ClinicalTrials.gov link */}
      {trial.source_url && (
        <section className="mb-8">
          <a
            href={trial.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline font-medium"
          >
            View on ClinicalTrials.gov →
          </a>
        </section>
      )}
    </div>
  );
}
