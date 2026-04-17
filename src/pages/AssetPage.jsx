import { useState, useEffect } from "react";
import { getAsset, getTrials } from "../lib/api-client.js";
import TrialCard from "../components/TrialCard.jsx";

/**
 * AssetPage — asset detail with linked sponsor and trials.
 */
export default function AssetPage({ slug, onNavigate }) {
  const [asset, setAsset] = useState(null);
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getAsset(slug)
      .then(async (res) => {
        if (cancelled) return;
        setAsset(res.data);

        // Fetch trials linked to this asset
        if (res.data?.id) {
          try {
            const trialRes = await getTrials({ asset_id: res.data.id, limit: 30 });
            if (!cancelled) setTrials(trialRes.data || []);
          } catch {
            // Non-critical
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

  if (error || !asset) {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => onNavigate?.("search")} className="text-sm text-indigo-600 hover:underline mb-4 cursor-pointer">
          ← Back to search
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || "Asset not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => onNavigate?.("search")} className="text-sm text-indigo-600 hover:underline mb-6 cursor-pointer">
        ← Back to search
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{asset.name}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {asset.phase && (
            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-sm font-medium">
              {asset.phase}
            </span>
          )}
          {asset.modality && (
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
              {asset.modality}
            </span>
          )}
          {asset.status && (
            <span className={`px-2 py-1 rounded text-sm font-medium ${
              asset.status === "active"
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}>
              {asset.status}
            </span>
          )}
        </div>
      </div>

      {/* Sponsor link */}
      {asset.sponsor_name && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Sponsor</h2>
          <button
            onClick={() => {
              if (asset.sponsor_slug) onNavigate?.("sponsor", asset.sponsor_slug);
            }}
            className="text-base text-indigo-600 hover:underline font-medium cursor-pointer"
          >
            {asset.sponsor_name} →
          </button>
        </section>
      )}

      {/* Indications */}
      {asset.indications?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Indications</h2>
          <div className="flex flex-wrap gap-2">
            {asset.indications.map((ind) => (
              <span key={ind} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {ind}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Linked trials */}
      {trials.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Clinical Trials ({trials.length})
          </h2>
          <div className="space-y-3">
            {trials.map((t) => (
              <TrialCard key={t.nct_id} trial={t} onClick={() => onNavigate?.("trial", t.nct_id)} />
            ))}
          </div>
        </section>
      )}

      {trials.length === 0 && !loading && (
        <section className="mb-8">
          <p className="text-sm text-gray-500">
            No clinical trials linked to this asset yet. Run CT.gov ingest to populate.
          </p>
        </section>
      )}
    </div>
  );
}
