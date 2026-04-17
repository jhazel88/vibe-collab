import SearchBar from "../components/SearchBar.jsx";
import SponsorCard from "../components/SponsorCard.jsx";
import TrialCard from "../components/TrialCard.jsx";
import { useSearch } from "../hooks/useSearch.js";

/**
 * SearchPage — unified search across sponsors, assets, trials, countries.
 */
export default function SearchPage({ onNavigate }) {
  const { query, setQuery, results, loading, error } = useSearch(300);

  const hasResults = results && results.total > 0;
  const showEmpty = query.trim().length >= 2 && !loading && results && results.total === 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero / search area */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          HTA Market Access Tracker
        </h1>
        <p className="text-gray-500 mb-6">
          Search sponsors, clinical trials, and market access pathways
        </p>
        <div className="flex justify-center">
          <SearchBar value={query} onChange={setQuery} loading={loading} />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {showEmpty && (
        <p className="text-center text-gray-500 text-sm">
          No results found for &ldquo;{query}&rdquo;
        </p>
      )}

      {hasResults && (
        <div className="space-y-8">
          {/* Sponsors */}
          {results.results.sponsors?.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Sponsors ({results.results.sponsors.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.results.sponsors.map((s) => (
                  <SponsorCard
                    key={s.slug}
                    sponsor={s}
                    onClick={() => onNavigate?.("sponsor", s.slug)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Assets */}
          {results.results.assets?.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Assets ({results.results.assets.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.results.assets.map((a) => (
                  <button
                    key={a.slug}
                    onClick={() => onNavigate?.("asset", a.slug)}
                    className="w-full text-left p-4 bg-white rounded-lg border border-gray-200
                               hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                  >
                    <h3 className="text-base font-semibold text-gray-900">{a.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      {a.phase && (
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                          {a.phase}
                        </span>
                      )}
                      {a.sponsor_name && <span>{a.sponsor_name}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Trials */}
          {results.results.trials?.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Clinical Trials ({results.results.trials.length})
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {results.results.trials.map((t) => (
                  <TrialCard
                    key={t.nct_id}
                    trial={t}
                    onClick={() => onNavigate?.("trial", t.nct_id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Countries */}
          {results.results.countries?.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Countries ({results.results.countries.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {results.results.countries.map((c) => (
                  <button
                    key={c.country_iso}
                    onClick={() => onNavigate?.("country", c.country_iso)}
                    className="w-full text-left p-4 bg-white rounded-lg border border-gray-200
                               hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                  >
                    <h3 className="text-base font-semibold text-gray-900">
                      {c.country_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{c.country_iso}</span>
                      {c.has_formal_hta && (
                        <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-medium">
                          Formal HTA
                        </span>
                      )}
                      {c.system_type && (
                        <span>{c.system_type.replace(/_/g, " ")}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Quick links when no search */}
      {!query.trim() && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 text-center">
            Quick Access — Country Pathways
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
            {[
              { iso: "GB", name: "United Kingdom", flag: "🇬🇧" },
              { iso: "DE", name: "Germany", flag: "🇩🇪" },
              { iso: "FR", name: "France", flag: "🇫🇷" },
            ].map((c) => (
              <button
                key={c.iso}
                onClick={() => onNavigate?.("country", c.iso)}
                className="p-4 bg-white rounded-lg border border-gray-200 hover:border-indigo-300
                           hover:shadow-md transition-all text-center cursor-pointer"
              >
                <span className="text-2xl">{c.flag}</span>
                <p className="text-sm font-medium text-gray-900 mt-1">{c.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
