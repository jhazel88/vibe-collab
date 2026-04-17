import { useState, useCallback, useMemo } from "react";
import SearchPage from "./pages/SearchPage.jsx";
import SponsorPage from "./pages/SponsorPage.jsx";
import CountryPage from "./pages/CountryPage.jsx";
import ChatPanel from "./components/ChatPanel.jsx";

/**
 * App — minimal state-based routing for Sprint 1.
 * Pages: search (default), sponsor/:slug, country/:iso
 */
function App() {
  const [route, setRoute] = useState({ page: "search" });

  const navigate = useCallback((page, id) => {
    setRoute({ page, id });
    window.scrollTo(0, 0);
  }, []);

  // Build context for ChatPanel based on current route
  const chatContext = useMemo(() => {
    if (route.page === "country" && route.id) {
      return { country_iso: route.id, mode: "country" };
    }
    if (route.page === "sponsor" && route.id) {
      return { asset_id: route.id, mode: "sponsor" };
    }
    return { mode: "search" };
  }, [route.page, route.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate("search")}
            className="text-lg font-bold text-gray-900 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            HTA Tracker
          </button>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <button
              onClick={() => navigate("search")}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Search
            </button>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
          {route.page === "search" && (
            <SearchPage onNavigate={navigate} />
          )}
          {route.page === "sponsor" && route.id && (
            <SponsorPage slug={route.id} onNavigate={navigate} />
          )}
          {route.page === "country" && route.id && (
            <CountryPage iso={route.id} onNavigate={navigate} />
          )}
        </div>
      </main>

      {/* Chat assistant */}
      <ChatPanel context={chatContext} />
    </div>
  );
}

export default App;
