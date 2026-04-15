import { useRef, useState } from 'react'
import MusicNotation, { type MusicNotationHandle } from './components/MusicNotation'

function App() {
  const musicNotationRef = useRef<MusicNotationHandle | null>(null)
  const [menuShown, setMenuShown] = useState(false)

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Sing Homework</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => musicNotationRef.current?.toggleMenu()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              {menuShown ? 'Hide Exercises' : 'Exercises'}
            </button>
            <button
              onClick={() => musicNotationRef.current?.createNewExercise()}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              New Exercise
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <MusicNotation ref={musicNotationRef} onMenuShownChange={setMenuShown} />
        </div>
      </div>
    </div>
  )
}

export default App 