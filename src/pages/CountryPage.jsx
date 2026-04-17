import { useState, useEffect } from "react";
import { getCountry } from "../lib/api-client.js";
import PathwayTimeline from "../components/PathwayTimeline.jsx";

/**
 * CountryPage — shows country details, HTA bodies, and pathway timeline.
 */
export default function CountryPage({ iso, onNavigate }) {
  const [country, setCountry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getCountry(iso)
      .then((res) => {
        if (!cancelled) setCountry(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [iso]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !country) {
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => onNavigate?.("search")} className="text-sm text-indigo-600 hover:underline mb-4 cursor-pointer">
          ← Back to search
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || "Country not found"}
        </div>
      </div>
    );
  }

  const coverage = country.coverage_model || {};

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => onNavigate?.("search")} className="text-sm text-indigo-600 hover:underline mb-6 cursor-pointer">
        ← Back to search
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {country.country_name}
          <span className="ml-2 text-lg text-gray-400 font-normal">{country.country_iso}</span>
        </h1>
        <div className="flex flex-wrap gap-2 mt-2">
          {country.system_type && (
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
              {country.system_type.replace(/_/g, " ")}
            </span>
          )}
          {country.income_group && (
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
              {country.income_group}
            </span>
          )}
          {country.has_formal_hta && (
            <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-sm font-medium">
              Formal HTA
            </span>
          )}
        </div>
      </div>

      {/* Coverage model */}
      {coverage.description && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Coverage Model</h2>
          <p className="text-sm text-gray-700">{coverage.description}</p>
          {coverage.key_gap && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 rounded px-3 py-2">
              <span className="font-semibold">Key gap:</span> {coverage.key_gap}
            </p>
          )}
        </section>
      )}

      {/* HTA Bodies */}
      {country.hta_bodies?.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">HTA Bodies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {country.hta_bodies.map((body) => (
              <div key={body.slug || body.id} className="p-3 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {body.abbreviation || body.name}
                  </h3>
                  {body.role && (
                    <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">
                      {body.role}
                    </span>
                  )}
                  {body.has_api && (
                    <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                      API
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{body.name}</p>
                {body.website && (
                  <a
                    href={body.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-500 hover:underline mt-1 inline-block"
                  >
                    Website →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pathway Timeline */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Market Access Pathway
        </h2>
        <PathwayTimeline steps={country.pathway} countryName={country.country_name} />
      </section>

      {/* Notes */}
      {country.notes && (
        <section className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
          <p className="text-sm text-gray-600">{country.notes}</p>
        </section>
      )}
    </div>
  );
}
