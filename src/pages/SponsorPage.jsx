import { useState, useEffect } from "react";
import { getSponsor, getTrials } from "../lib/api-client.js";
import TrialCard from "../components/TrialCard.jsx";

/**
 * SponsorPage — sponsor detail with financials and linked trials.
 */
export default function SponsorPage({ slug, onNavigate }) {
  const [sponsor, setSponsor] = useState(null);
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getSponsor(slug)
      .then(async (res) => {
        if (cancelled) return;
        setSponsor(res.data);

        // Fetch trials linked to this sponsor by sponsor_id
        if (res.data.id) {
          try {
            const trialRes = await getTrials({ sponsor_id: res.data.id, limit: 30 });
            if (!cancelled) setTrials(trialRes.data || []);
          } catch {
            // Non-critical — sponsor page still useful without trials
          }
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !sponsor) {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => onNavigate?.("search")} className="text-sm text-indigo-600 hover:underline mb-4 cursor-pointer">
          ← Back to search
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || "Sponsor not found"}
        </div>
      </div>
    );
  }

  const hq = sponsor.headquarters;
  const location = hq ? [hq.city, hq.region, hq.country].filter(Boolean).join(", ") : null;
  const fin = sponsor.financials || {};

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => onNavigate?.("search")} className="text-sm text-indigo-600 hover:underline mb-6 cursor-pointer">
        ← Back to search
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{sponsor.name}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {sponsor.type && (
            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-sm font-medium">
              {sponsor.type}
            </span>
          )}
          {location && (
            <span className="text-sm text-gray-500">{location}</span>
          )}
          {sponsor.website && (
            <a href={sponsor.website} target="_blank" rel="noopener noreferrer"
               className="text-sm text-indigo-500 hover:underline">
              Website →
            </a>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {fin.revenue && (
          <div className="p-3 bg-white border border-gray-200 rounded-lg text-center">
            <p className="text-xs text-gray-500">Revenue ({fin.revenue.year})</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(fin.revenue.value, fin.revenue.currency)}
            </p>
          </div>
        )}
        {fin.rd_spend && (
          <div className="p-3 bg-white border border-gray-200 rounded-lg text-center">
            <p className="text-xs text-gray-500">R&D Spend ({fin.rd_spend.year})</p>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(fin.rd_spend.value, fin.rd_spend.currency)}
            </p>
          </div>
        )}
        {fin.employees && (
          <div className="p-3 bg-white border border-gray-200 rounded-lg text-center">
            <p className="text-xs text-gray-500">Employees ({fin.employees.year})</p>
            <p className="text-lg font-bold text-gray-900">
              {Number(fin.employees.value).toLocaleString()}
            </p>
          </div>
        )}
        <div className="p-3 bg-white border border-gray-200 rounded-lg text-center">
          <p className="text-xs text-gray-500">Trial count</p>
          <p className="text-lg font-bold text-gray-900">
            {sponsor.trial_count ?? trials.length}
          </p>
        </div>
      </div>

      {/* Therapeutic areas */}
      {sponsor.therapeutic_areas?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Therapeutic Areas</h2>
          <div className="flex flex-wrap gap-2">
            {sponsor.therapeutic_areas.map((area) => (
              <span key={area} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {area}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Linked trials */}
      {trials.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Clinical Trials ({trials.length})
          </h2>
          <div className="space-y-3">
            {trials.map((t) => (
              <TrialCard key={t.nct_id} trial={t} onClick={() => onNavigate?.("trial", t.nct_id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function formatCurrency(value, currency) {
  if (!value) return "—";
  const num = Number(value);
  if (num >= 1e9) return `${currency || "$"}${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${currency || "$"}${(num / 1e6).toFixed(0)}M`;
  return `${currency || "$"}${num.toLocaleString()}`;
}
