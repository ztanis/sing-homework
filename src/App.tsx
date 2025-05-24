import { useState, useEffect, useRef } from 'react'
import { Factory } from 'vexflow'

interface Note {
  pitch: string
  duration: string
  lyrics?: string
}

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [currentNote, setCurrentNote] = useState<Note>({ pitch: 'C4', duration: 'q' })
  const [currentLyrics, setCurrentLyrics] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const vf = useRef<any>(null)

  useEffect(() => {
    if (containerRef.current) {
      const factory = new Factory.Renderer(400, 200)
      vf.current = factory.getContext()
      renderNotes()
    }
  }, [notes])

  const renderNotes = () => {
    if (!vf.current) return

    vf.current.clear()
    const stave = new Factory.Stave(10, 0, 380)
    stave.addClef('treble')
    stave.setContext(vf.current).draw()

    const vexNotes = notes.map((note: Note) => {
      const vfNote = new Factory.StaveNote({
        keys: [note.pitch],
        duration: note.duration
      })
      if (note.lyrics) {
        vfNote.addModifier(new Factory.Annotation(note.lyrics), 0)
      }
      return vfNote
    })

    Factory.Formatter.FormatAndDraw(vf.current, stave, vexNotes)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setNotes([...notes, { ...currentNote, lyrics: currentLyrics }])
      setCurrentLyrics('')
    }
  }

  const handlePitchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentNote({ ...currentNote, pitch: e.target.value })
  }

  const handleDurationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentNote({ ...currentNote, duration: e.target.value })
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Sing Homework Editor</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex gap-4 mb-4">
            <select
              value={currentNote.pitch}
              onChange={handlePitchChange}
              className="border rounded px-3 py-2"
            >
              {['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].map(pitch => (
                <option key={pitch} value={pitch}>{pitch}</option>
              ))}
            </select>
            
            <select
              value={currentNote.duration}
              onChange={handleDurationChange}
              className="border rounded px-3 py-2"
            >
              <option value="q">Quarter Note</option>
              <option value="h">Half Note</option>
              <option value="w">Whole Note</option>
              <option value="8">Eighth Note</option>
            </select>

            <input
              type="text"
              value={currentLyrics}
              onChange={(e) => setCurrentLyrics(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter lyrics..."
              className="flex-1 border rounded px-3 py-2"
            />
          </div>

          <div ref={containerRef} className="border rounded p-4 bg-white" />
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Instructions</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Select the pitch and duration for your note</li>
            <li>Enter lyrics if needed</li>
            <li>Press Enter to add the note to the sheet</li>
            <li>The sheet will automatically update as you add notes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default App 