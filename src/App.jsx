import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          vibe-collab
        </h1>
        <p className="text-gray-500 mb-8">
          Your collaborative vibe coding starter. Pick a feature, build it, ship it.
        </p>

        <button
          onClick={() => setCount(c => c + 1)}
          className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          Vibes: {count}
        </button>

        <div className="mt-8 pt-6 border-t border-gray-100 text-sm text-gray-400">
          React + Vite + Tailwind + Vitest — ready to go
        </div>
      </div>
    </div>
  )
}

export default App
