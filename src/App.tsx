import NoteSheet from './components/NoteSheet'

function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Sing Homework Editor</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <NoteSheet />
        </div>
      </div>
    </div>
  )
}

export default App 