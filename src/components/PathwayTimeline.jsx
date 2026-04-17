/**
 * PathwayTimeline — vertical step timeline for market access pathways.
 * Gate steps get a highlighted badge. Shows institution, timing, blockers.
 */
export default function PathwayTimeline({ steps, countryName }) {
  if (!steps?.length) {
    return (
      <p className="text-sm text-gray-500 italic">
        No pathway data available for {countryName || "this country"}.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

      <ol className="space-y-6">
        {steps.map((step, idx) => {
          const isGate = step.is_gate;
          const isLast = idx === steps.length - 1;

          return (
            <li key={step.step_order} className="relative pl-10">
              {/* Node dot */}
              <div
                className={`absolute left-2.5 w-3 h-3 rounded-full border-2
                  ${isGate
                    ? "bg-amber-500 border-amber-600"
                    : "bg-white border-gray-400"
                  }
                  ${isLast ? "bg-green-500 border-green-600" : ""}
                `}
                style={{ top: "0.25rem" }}
              />

              <div className={`p-3 rounded-lg border ${
                isGate
                  ? "border-amber-200 bg-amber-50"
                  : "border-gray-200 bg-white"
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">
                        {step.step_order}.
                      </span>
                      <h4 className="text-sm font-semibold text-gray-900">
                        {step.label}
                      </h4>
                      {isGate && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded">
                          GATE
                        </span>
                      )}
                    </div>
                    {step.institution && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {step.institution}
                      </p>
                    )}
                  </div>
                  {step.typical_months && (
                    <span className="shrink-0 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {step.typical_months} mo
                    </span>
                  )}
                </div>

                {step.likely_blocker && (
                  <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                    <span className="font-semibold">Likely blocker:</span> {step.likely_blocker}
                  </p>
                )}

                {step.notes && (
                  <p className="mt-1 text-xs text-gray-500">
                    {step.notes}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
