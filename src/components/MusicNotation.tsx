import { useEffect, useRef, useState } from 'react';
import { Factory, Annotation, BarlineType } from 'vexflow';

interface Piece {
  id: number;
  noteInput: string;
  lyricsInput: string;
  notes: string[];
  lyrics: string[];
}

function MusicNotation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pieces, setPieces] = useState<Piece[]>([
    {
      id: 1,
      noteInput: 'c/4 d/4 e/4 f/4 | g/4 a/4 b/4 c/5',
      lyricsInput: 'Do Re Mi Fa | Sol La Ti Do',
      notes: ['c/4', 'd/4', 'e/4', 'f/4', '|', 'g/4', 'a/4', 'b/4', 'c/5'],
      lyrics: ['Do', 'Re', 'Mi', 'Fa', '|', 'Sol', 'La', 'Ti', 'Do']
    }
  ]);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const factory = new Factory({
      renderer: {
        elementId: containerRef.current.id,
        width: 800,
        height: 200 * pieces.length,
      },
    });

    pieces.forEach((piece, pieceIndex) => {
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
        const y = 40 + pieceIndex * 200; // 200 height per piece
        const stave = factory.Stave({ x, y, width: 400 });
        
        // Add clef only to first measure of each piece
        if (index === 0) {
          stave.addClef('treble').addTimeSignature('4/4');
        }
        
        stave.setContext(factory.getContext()).draw();

        // Create the notes for this measure
        const staveNotes = measure.notes.map((note) =>
          factory.StaveNote({ keys: [note], duration: 'q' })
        );

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
      });
    });
  }, [pieces]);

  const handleSubmit = (pieceId: number) => (e: React.FormEvent) => {
    e.preventDefault();
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece) return;

    const noteList = piece.noteInput.trim().split(/\s+/);
    const lyricList = piece.lyricsInput.trim().split(/\s+/);
    
    setPieces(pieces.map(p => 
      p.id === pieceId 
        ? { ...p, notes: noteList, lyrics: lyricList }
        : p
    ));
  };

  const handleInputChange = (pieceId: number, field: 'noteInput' | 'lyricsInput', value: string) => {
    setPieces(pieces.map(p => 
      p.id === pieceId 
        ? { ...p, [field]: value }
        : p
    ));
  };

  const addPiece = () => {
    const newId = Math.max(...pieces.map(p => p.id)) + 1;
    setPieces([...pieces, {
      id: newId,
      noteInput: '',
      lyricsInput: '',
      notes: [],
      lyrics: []
    }]);
  };

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">How to Write Notation</h3>
        <div className="space-y-2 text-blue-700">
          <p><strong>Notes Format:</strong> Use note name and octave (e.g., c/4, d/4, e/4, f/4)</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Note names: a, b, c, d, e, f, g</li>
            <li>Octave numbers: 3 (low) to 5 (high)</li>
            <li>Separate notes with spaces</li>
            <li>Use <code className="bg-blue-100 px-1 rounded">|</code> to create a bar line</li>
            <li>Example: <code className="bg-blue-100 px-1 rounded">c/4 d/4 e/4 f/4 | g/4 a/4 b/4 c/5</code></li>
          </ul>
          <p><strong>Lyrics Format:</strong> One word per note, separated by spaces</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Each word will appear under its corresponding note</li>
            <li>Use <code className="bg-blue-100 px-1 rounded">|</code> to separate lyrics for different measures</li>
            <li>Example: <code className="bg-blue-100 px-1 rounded">Do Re Mi Fa | Sol La Ti Do</code></li>
          </ul>
        </div>
      </div>

      {pieces.map((piece) => (
        <div key={piece.id} className="space-y-4 border-b pb-8">
          <h3 className="text-lg font-semibold">Piece {piece.id}</h3>
          <form onSubmit={handleSubmit(piece.id)} className="flex flex-col md:flex-row gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Notes (e.g. c/4 d/4 e/4 f/4 | g/4 a/4 b/4 c/5):</label>
              <input
                type="text"
                value={piece.noteInput}
                onChange={e => handleInputChange(piece.id, 'noteInput', e.target.value)}
                className="border rounded px-2 py-1 w-96"
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
      ))}

      <button
        onClick={addPiece}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Add Piece
      </button>

      <div ref={containerRef} id="music-notation" className="bg-white p-4 rounded-lg shadow-lg overflow-x-auto" />
    </div>
  );
}

export default MusicNotation; 