/**
 * CitationBadge — inline citation link that opens source in new tab.
 */
export default function CitationBadge({ citation, index }) {
  const label = citation.source_label || `Source ${index + 1}`;

  if (citation.source_url) {
    return (
      <a
        href={citation.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700
                   text-xs rounded hover:bg-indigo-100 transition-colors no-underline"
        title={label}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <span className="max-w-32 truncate">{label}</span>
      </a>
    );
  }

  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600
                 text-xs rounded"
      title={label}
    >
      <span className="max-w-32 truncate">{label}</span>
    </span>
  );
}
