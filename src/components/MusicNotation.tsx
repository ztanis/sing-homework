import { useEffect, useState, useRef } from 'react';
import { Factory, Annotation, BarlineType, Accidental } from 'vexflow';

interface Piece {
  id: number;
  noteInput: string;
  lyricsInput: string;
  notes: string[];
  lyrics: string[];
  error?: string;
}

interface Exercise {
  id: string;
  name: string;
  pieces: Piece[];
  createdAt: number;
}

function MusicNotation() {
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem('exercises');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentExercise, setCurrentExercise] = useState<Exercise>(() => {
    const saved = localStorage.getItem('currentExercise');
    return saved ? JSON.parse(saved) : {
      id: Date.now().toString(),
      name: 'New Exercise',
      pieces: [{
        id: 1,
        noteInput: 'c/4 d/4 e/4 f/4 | g/4 a/4 b/4 c/5',
        lyricsInput: 'Do Re Mi Fa | Sol La Ti Do',
        notes: ['c/4', 'd/4', 'e/4', 'f/4', '|', 'g/4', 'a/4', 'b/4', 'c/5'],
        lyrics: ['Do', 'Re', 'Mi', 'Fa', '|', 'Sol', 'La', 'Ti', 'Do']
      }],
      createdAt: Date.now()
    };
  });
  const [showMenu, setShowMenu] = useState(false);
  const [showTransposeModal, setShowTransposeModal] = useState(false);
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [expandedPieces, setExpandedPieces] = useState<Set<number>>(() => {
    const pieces = currentExercise.pieces;
    return new Set(pieces.length > 0 ? [pieces[pieces.length - 1].id] : []);
  });
  const [showHelp, setShowHelp] = useState(false);
  const [playingPieceId, setPlayingPieceId] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const validateNote = (note: string): boolean => {
    if (note === '|') return true;
    const noteRegex = /^[a-g](b|#)?\/[3-5]$/;
    return noteRegex.test(note);
  };

  const parseNotes = (input: string): { notes: string[], error?: string } => {
    const noteList = input.trim().split(/\s+/);
    
    // Check for empty input
    if (noteList.length === 0 || (noteList.length === 1 && noteList[0] === '')) {
      return { notes: [], error: 'Please enter at least one note' };
    }

    // Validate each note
    for (let i = 0; i < noteList.length; i++) {
      const note = noteList[i];
      if (note !== '|' && !validateNote(note)) {
        return { 
          notes: [], 
          error: `Invalid note format at position ${i + 1}: "${note}". Expected format: note/octave (e.g., c/4, c#/4, cb/4)` 
        };
      }
    }

    return { notes: noteList };
  };

  useEffect(() => {
    localStorage.setItem('exercises', JSON.stringify(exercises));
  }, [exercises]);

  useEffect(() => {
    localStorage.setItem('currentExercise', JSON.stringify(currentExercise));
  }, [currentExercise]);

  useEffect(() => {
    // Clear all notation containers
    currentExercise.pieces.forEach(piece => {
      const container = document.getElementById(`notation-${piece.id}`);
      if (container) container.innerHTML = '';
    });

    currentExercise.pieces.forEach((piece) => {
      if (piece.error) return;

      const container = document.getElementById(`notation-${piece.id}`);
      if (!container) return;

      const factory = new Factory({
        renderer: {
          elementId: container.id,
          width: 800,
          height: 200,
        },
      });

      // Split notes and lyrics into measures
      const measures: { notes: string[], lyrics: string[] }[] = [];
      let currentMeasure = { notes: [] as string[], lyrics: [] as string[] };
      
      piece.notes.forEach((note, i) => {
        if (note === '|') {
          if (currentMeasure.notes.length > 0) {
            measures.push(currentMeasure);
            currentMeasure = { notes: [], lyrics: [] };
          }
        } else {
          currentMeasure.notes.push(note);
          if (piece.lyrics[i]) currentMeasure.lyrics.push(piece.lyrics[i]);
        }
      });
      if (currentMeasure.notes.length > 0) {
        measures.push(currentMeasure);
      }

      // Create staves for each measure
      measures.forEach((measure, index) => {
        const x = 10 + index * 410; // 400 width + 10 padding
        const y = 40; // Fixed y position since each piece has its own container
        const stave = factory.Stave({ x, y, width: 400 });
        
        // Add clef only to first measure
        if (index === 0) {
          stave.addClef('treble').addTimeSignature('4/4');
        }
        
        stave.setContext(factory.getContext()).draw();

        try {
          // Create the notes for this measure
          const staveNotes = measure.notes
            .filter(note => note !== '|')
            .map((note) => {
              // Format the note for VexFlow
              const [noteName, octave] = note.split('/');
              const baseNote = noteName.replace(/[#b]/, '');
              const staveNote = factory.StaveNote({ 
                keys: [`${baseNote}/${octave}`], 
                duration: 'q' 
              });

              // Add accidental if needed
              if (noteName.includes('#')) {
                staveNote.addModifier(new Accidental('#'), 0);
              } else if (noteName.includes('b')) {
                staveNote.addModifier(new Accidental('b'), 0);
              }
              
              return staveNote;
            });

          // Add rests if needed to complete the measure (4/4 time)
          while (staveNotes.length < 4) {
            staveNotes.push(factory.StaveNote({ 
              keys: ['b/4'], 
              duration: 'q' 
            }).setStyle({ fillStyle: 'transparent' }));
          }

          // Add lyrics as annotations
          staveNotes.forEach((note, i) => {
            if (measure.lyrics[i]) {
              const annotation = factory.Annotation({ 
                text: measure.lyrics[i], 
                font: { family: 'Arial', size: 14, weight: '' }, 
                vJustify: Annotation.VerticalJustify.BOTTOM 
              });
              note.addModifier(annotation, 0);
            }
          });

          const voice = factory.Voice({ time: '4/4' });
          voice.addTickables(staveNotes);
          factory.Formatter().joinVoices([voice]).format([voice], 400);
          voice.draw(factory.getContext(), stave);

          // Add barline at the end of each measure except the last one
          if (index < measures.length - 1) {
            stave.setEndBarType(BarlineType.SINGLE);
            stave.draw();
          }
        } catch (error: any) {
          console.error('Error rendering notes:', error);
          // Display error message on the canvas
          const context = factory.getContext();
          context.setFont('Arial', 14);
          context.fillText(`Error: ${error.message || 'Failed to render notes'}`, x, y + 50);
        }
      });
    });
  }, [currentExercise]);

  const handleSubmit = (pieceId: number) => (e: React.FormEvent) => {
    e.preventDefault();
    const piece = currentExercise.pieces.find(p => p.id === pieceId);
    if (!piece) return;

    const { notes, error } = parseNotes(piece.noteInput);
    const lyricList = piece.lyricsInput.trim().split(/\s+/);
    
    setCurrentExercise({
      ...currentExercise,
      pieces: currentExercise.pieces.map(p => 
        p.id === pieceId 
          ? { ...p, notes, lyrics: lyricList, error }
          : p
      )
    });
  };

  const handleInputChange = (pieceId: number, field: 'noteInput' | 'lyricsInput', value: string) => {
    setCurrentExercise({
      ...currentExercise,
      pieces: currentExercise.pieces.map(p => 
        p.id === pieceId 
          ? { ...p, [field]: value, error: undefined }
          : p
      )
    });
  };

  const addPiece = () => {
    const newId = Math.max(...currentExercise.pieces.map(p => p.id)) + 1;
    setCurrentExercise({
      ...currentExercise,
      pieces: [...currentExercise.pieces, {
        id: newId,
        noteInput: '',
        lyricsInput: '',
        notes: [],
        lyrics: []
      }]
    });
    setExpandedPieces(new Set([newId]));
  };

  const saveExercise = () => {
    const exerciseName = prompt('Enter exercise name:', currentExercise.name);
    if (!exerciseName) return;

    const updatedExercise = {
      ...currentExercise,
      name: exerciseName,
      id: currentExercise.id || Date.now().toString(),
      createdAt: currentExercise.createdAt || Date.now()
    };

    setExercises(prev => {
      const filtered = prev.filter(e => e.id !== updatedExercise.id);
      return [...filtered, updatedExercise].sort((a, b) => b.createdAt - a.createdAt);
    });
    setCurrentExercise(updatedExercise);
  };

  const loadExercise = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setShowMenu(false);
  };

  const deleteExercise = (id: string) => {
    if (confirm('Are you sure you want to delete this exercise?')) {
      setExercises(prev => prev.filter(e => e.id !== id));
      if (currentExercise.id === id) {
        setCurrentExercise({
          id: Date.now().toString(),
          name: 'New Exercise',
          pieces: [{
            id: 1,
            noteInput: '',
            lyricsInput: '',
            notes: [],
            lyrics: []
          }],
          createdAt: Date.now()
        });
      }
    }
  };

  const createNewExercise = () => {
    if (currentExercise.pieces.some(p => p.noteInput || p.lyricsInput)) {
      if (!confirm('Are you sure you want to create a new exercise? Any unsaved changes will be lost.')) {
        return;
      }
    }
    setCurrentExercise({
      id: Date.now().toString(),
      name: 'New Exercise',
      pieces: [{
        id: 1,
        noteInput: '',
        lyricsInput: '',
        notes: [],
        lyrics: []
      }],
      createdAt: Date.now()
    });
  };

  const transposeNote = (note: string, semitones: number): string => {
    if (note === '|') return note;
    
    const noteMap = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    const [noteName, octave] = note.split('/');
    const baseNote = noteName.replace(/[#b]/, '');
    const accidental = noteName.includes('#') ? '#' : noteName.includes('b') ? 'b' : '';
    
    let noteIndex = noteMap.indexOf(baseNote);
    if (noteIndex === -1) return note;
    
    // Adjust for flats
    if (accidental === 'b') {
      noteIndex = (noteIndex - 1 + 12) % 12;
    }
    
    // Apply transposition
    noteIndex = (noteIndex + semitones + 12) % 12;
    
    // Calculate octave change
    const octaveNum = parseInt(octave);
    const octaveChange = Math.floor((noteMap.indexOf(baseNote) + semitones) / 12);
    const newOctave = octaveNum + octaveChange;
    
    // Get the new note name
    const newNoteName = noteMap[noteIndex];
    
    return `${newNoteName}/${newOctave}`;
  };

  const handleCopyPiece = (pieceId: number) => {
    setSelectedPieceId(pieceId);
    setTransposeSemitones(0);
    setShowTransposeModal(true);
  };

  const confirmCopyPiece = () => {
    if (selectedPieceId === null) return;
    
    const pieceToCopy = currentExercise.pieces.find(p => p.id === selectedPieceId);
    if (!pieceToCopy) return;

    const newId = Math.max(...currentExercise.pieces.map(p => p.id)) + 1;
    const transposedNotes = pieceToCopy.notes.map(note => transposeNote(note, transposeSemitones));
    const transposedNoteInput = transposedNotes.join(' ');

    setCurrentExercise({
      ...currentExercise,
      pieces: [...currentExercise.pieces, {
        ...pieceToCopy,
        id: newId,
        noteInput: transposedNoteInput,
        notes: transposedNotes
      }]
    });

    setShowTransposeModal(false);
    setSelectedPieceId(null);
  };

  const togglePieceExpansion = (pieceId: number) => {
    setExpandedPieces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pieceId)) {
        newSet.delete(pieceId);
      } else {
        newSet.add(pieceId);
      }
      return newSet;
    });
  };

  const deletePiece = (pieceId: number) => {
    if (confirm('Are you sure you want to delete this piece?')) {
      setCurrentExercise({
        ...currentExercise,
        pieces: currentExercise.pieces.filter(p => p.id !== pieceId)
      });
      // Update expanded pieces state
      setExpandedPieces(prev => {
        const newSet = new Set(prev);
        newSet.delete(pieceId);
        // If we deleted the last piece, expand the new last piece
        if (currentExercise.pieces.length > 1) {
          const remainingPieces = currentExercise.pieces.filter(p => p.id !== pieceId);
          if (remainingPieces.length > 0) {
            newSet.add(remainingPieces[remainingPieces.length - 1].id);
          }
        }
        return newSet;
      });
    }
  };

  // Function to convert note to frequency
  const noteToFrequency = (note: string): number => {
    if (note === '|') return 0;
    
    const noteMap: { [key: string]: number } = {
      'c': 0, 'c#': 1, 'db': 1,
      'd': 2, 'd#': 3, 'eb': 3,
      'e': 4,
      'f': 5, 'f#': 6, 'gb': 6,
      'g': 7, 'g#': 8, 'ab': 8,
      'a': 9, 'a#': 10, 'bb': 10,
      'b': 11
    };

    const [noteName, octave] = note.split('/');
    const baseNote = noteName.replace(/[#b]/, '');
    const accidental = noteName.includes('#') ? '#' : noteName.includes('b') ? 'b' : '';
    const noteKey = baseNote + accidental;
    
    const noteNumber = noteMap[noteKey];
    const octaveNumber = parseInt(octave);
    
    // A4 = 440Hz
    return 440 * Math.pow(2, (noteNumber + (octaveNumber - 4) * 12) / 12);
  };

  // Function to play a note
  const playNote = async (frequency: number, duration: number = 0.5) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    
    const audioContext = audioContextRef.current;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
    // Add some attack and release to make it sound more like a piano
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  };

  // Function to play a piece
  const playPiece = async (piece: Piece) => {
    if (playingPieceId !== null) {
      // Stop current playback
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setPlayingPieceId(null);
      return;
    }

    setPlayingPieceId(piece.id);
    
    for (const note of piece.notes) {
      if (note === '|') {
        // Pause between measures
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      
      const frequency = noteToFrequency(note);
      if (frequency > 0) {
        await playNote(frequency);
        // Small pause between notes
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    setPlayingPieceId(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{currentExercise.name}</h2>
        <div className="space-x-4">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            {showMenu ? 'Hide Menu' : 'Show Menu'}
          </button>
          <button
            onClick={createNewExercise}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            New Exercise
          </button>
          <button
            onClick={saveExercise}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Exercise
          </button>
        </div>
      </div>

      {showMenu && (
        <div className="bg-white p-4 rounded-lg shadow-lg border">
          <h3 className="text-lg font-semibold mb-4">Saved Exercises</h3>
          <div className="space-y-2">
            {exercises.map(exercise => (
              <div key={exercise.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded">
                <button
                  onClick={() => loadExercise(exercise)}
                  className="flex-1 text-left"
                >
                  {exercise.name}
                </button>
                <button
                  onClick={() => deleteExercise(exercise.id)}
                  className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible Help Section */}
      <div className="bg-blue-50 rounded-lg border border-blue-200">
        <button
          className="w-full flex justify-between items-center px-4 py-3 focus:outline-none"
          onClick={() => setShowHelp((prev) => !prev)}
        >
          <span className="text-lg font-semibold text-blue-800">How to Write Notation</span>
          <svg
            className={`w-5 h-5 transform transition-transform ${showHelp ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {showHelp && (
          <div className="p-4 space-y-2 text-blue-700 border-t border-blue-200">
            <p><strong>Notes Format:</strong> Use note name and octave (e.g., c/4, d/4, e/4, f/4)</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Note names: a, b, c, d, e, f, g</li>
              <li>Accidentals: use # for sharp (e.g., c#/4) or b for flat (e.g., cb/4)</li>
              <li>Octave numbers: 3 (low) to 5 (high)</li>
              <li>Separate notes with spaces</li>
              <li>Use <code className="bg-blue-100 px-1 rounded">|</code> to create a bar line</li>
              <li>Examples: 
                <ul className="list-disc pl-5 mt-1">
                  <li><code className="bg-blue-100 px-1 rounded">c/4 d/4 e/4 f/4</code> - basic notes</li>
                  <li><code className="bg-blue-100 px-1 rounded">c#/4 db/4 e/4 f#/4</code> - with accidentals</li>
                  <li><code className="bg-blue-100 px-1 rounded">c/4 d/4 e/4 f/4 | g/4 a/4 b/4 c/5</code> - with bar line</li>
                </ul>
              </li>
            </ul>
            <p><strong>Lyrics Format:</strong> One word per note, separated by spaces</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Each word will appear under its corresponding note</li>
              <li>Use <code className="bg-blue-100 px-1 rounded">|</code> to separate lyrics for different measures</li>
              <li>Example: <code className="bg-blue-100 px-1 rounded">Do Re Mi Fa | Sol La Ti Do</code></li>
            </ul>
          </div>
        )}
      </div>

      {currentExercise.pieces.map((piece) => (
        <div key={piece.id} className="mb-8">
          <div className="border rounded-lg overflow-hidden">
            <div 
              className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => togglePieceExpansion(piece.id)}
            >
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-semibold">Piece {piece.id}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playPiece(piece);
                    }}
                    className={`px-3 py-1 rounded ${
                      playingPieceId === piece.id
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-green-600 hover:bg-green-700'
                    } text-white`}
                  >
                    {playingPieceId === piece.id ? 'Stop' : 'Play'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyPiece(piece.id);
                    }}
                    className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    Copy
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePiece(piece.id);
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <span className="text-gray-500 mr-2">
                  {expandedPieces.has(piece.id) ? 'Collapse' : 'Expand'}
                </span>
                <svg
                  className={`w-5 h-5 transform transition-transform ${
                    expandedPieces.has(piece.id) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            {expandedPieces.has(piece.id) && (
              <div className="p-4 space-y-4">
                {piece.error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
                    {piece.error}
                  </div>
                )}
                <form onSubmit={handleSubmit(piece.id)} className="flex flex-col md:flex-row gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium mb-1">Notes (e.g. c/4 d/4 e/4 f/4 | g/4 a/4 b/4 c/5):</label>
                    <input
                      type="text"
                      value={piece.noteInput}
                      onChange={e => handleInputChange(piece.id, 'noteInput', e.target.value)}
                      className={`border rounded px-2 py-1 w-96 ${piece.error ? 'border-red-500' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Lyrics (e.g. Do Re Mi Fa | Sol La Ti Do):</label>
                    <input
                      type="text"
                      value={piece.lyricsInput}
                      onChange={e => handleInputChange(piece.id, 'lyricsInput', e.target.value)}
                      className="border rounded px-2 py-1 w-96"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Update
                  </button>
                </form>
              </div>
            )}
          </div>
          {/* Music sheet always visible below the card */}
          <div 
            id={`notation-${piece.id}`} 
            className="bg-white p-4 rounded-lg shadow-lg overflow-x-auto mt-2"
          />
        </div>
      ))}

      <button
        onClick={addPiece}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Add Piece
      </button>

      {/* Transpose Modal */}
      {showTransposeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Transpose Piece</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Number of semitones to transpose (-12 to +12):
                </label>
                <input
                  type="number"
                  min="-12"
                  max="12"
                  value={transposeSemitones}
                  onChange={(e) => setTransposeSemitones(parseInt(e.target.value) || 0)}
                  className="border rounded px-2 py-1 w-full"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowTransposeModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCopyPiece}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MusicNotation; 