// ═══════════════════════════════════════════════════════════════════════════
// Prompt Templates — HTA Market Access Domain
//
// System prompts for the brain/chat route. The LLM is positioned as an
// HTA market access analyst that grounds answers in retrieved context.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build the system prompt for the chat model.
 *
 * @param {object} opts
 * @param {string} opts.intent     — classified intent
 * @param {string[]} opts.lanes    — which retrieval lanes were activated
 * @returns {string}
 */
export function systemPrompt({ intent, lanes } = {}) {
  const intentHint = intent && intent !== "general"
    ? `The user's question has been classified as a "${intent}" query.`
    : "";

  return `You are an HTA (Health Technology Assessment) market access analyst assistant. You help pharmaceutical professionals, market access teams, and health policy researchers understand:

- Clinical trial landscapes for drugs and biologics
- Market access pathways and timelines across countries
- HTA body processes, decision criteria, and outcomes
- Sponsor/company pipeline information
- Comparative analysis of regulatory and reimbursement systems

## Rules

1. **Ground your answers in the provided context.** Only cite information from the context snippets. If the context doesn't contain enough information, say so clearly.

2. **Cite your sources.** When referencing a fact from the context, include the source label in brackets, e.g. [ClinicalTrials.gov NCT12345678] or [United Kingdom market access system].

3. **Be precise about uncertainty.** If data is incomplete or you're extrapolating beyond the context, state that explicitly.

4. **Use professional but accessible language.** Your audience ranges from HTA experts to pharmaceutical business professionals.

5. **Structure long answers.** Use brief paragraphs. For pathway comparisons, use concise summaries rather than reproducing entire pathway step lists.

6. **Never fabricate trial data, HTA decisions, or pricing information.** This is a regulated domain where accuracy is critical.

${intentHint}`.trim();
}

/**
 * Format retrieved context snippets into a context block for the LLM.
 *
 * @param {Array} snippets — from retrieval.js
 * @returns {string}
 */
export function formatContext(snippets) {
  if (!snippets.length) {
    return "<context>\nNo relevant data found in the database.\n</context>";
  }

  const blocks = snippets.map((s, i) => {
    const sourceTag = s.source_url
      ? `Source: ${s.source_label} (${s.source_url})`
      : `Source: ${s.source_label}`;

    return `--- Snippet ${i + 1}: ${s.title} ---\n${s.content}\n${sourceTag}`;
  });

  return `<context>\n${blocks.join("\n\n")}\n</context>`;
}

/**
 * Build the user message with context prepended.
 *
 * @param {string} userMessage — the user's question
 * @param {string} contextBlock — formatted context from formatContext()
 * @returns {string}
 */
export function buildUserMessage(userMessage, contextBlock) {
  return `${contextBlock}\n\n## Question\n\n${userMessage}`;
}

/**
 * Generate follow-up question suggestions based on intent and context.
 *
 * @param {string} intent
 * @param {Array} snippets
 * @returns {string[]}
 */
export function suggestFollowUps(intent, snippets) {
  const suggestions = [];

  const hasTrials = snippets.some((s) => s.type === "trial");
  const hasSponsors = snippets.some((s) => s.type === "sponsor");
  const hasPathways = snippets.some((s) => s.type === "country_pathway");
  const countries = [...new Set(snippets.filter((s) => s.type === "country_pathway").map((s) => s.id))];

  switch (intent) {
    case "sponsor_lookup":
      if (!hasTrials) suggestions.push("What clinical trials are they running?");
      if (!hasPathways) suggestions.push("Which countries have they filed in?");
      suggestions.push("How does their pipeline compare to competitors?");
      break;

    case "trial_search":
      if (!hasSponsors) suggestions.push("Tell me about the sponsor of this trial.");
      if (!hasPathways) suggestions.push("What's the market access pathway for the trial's indication?");
      suggestions.push("Are there similar trials recruiting?");
      break;

    case "pathway_question":
      if (countries.length === 1) {
        const other = countries[0] === "GB" ? "Germany" : countries[0] === "DE" ? "France" : "the UK";
        suggestions.push(`How does this compare to ${other}?`);
      }
      suggestions.push("What are the key gate steps that could block access?");
      suggestions.push("How long does the full process typically take?");
      break;

    case "comparison":
      suggestions.push("Which country has the fastest pathway?");
      suggestions.push("Where are the biggest bottlenecks?");
      break;

    default:
      suggestions.push("Show me oncology trials from the last year.");
      suggestions.push("What's the HTA pathway in Germany?");
      suggestions.push("Tell me about Roche's pipeline.");
  }

  return suggestions.slice(0, 3);
}
