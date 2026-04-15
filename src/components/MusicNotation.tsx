import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Factory, Annotation, BarlineType, Accidental } from 'vexflow';
import * as Tone from 'tone';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../i18n';

type ExerciseSource = 'preset' | 'memory';

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
  description?: string;
  pieces: Piece[];
  createdAt: number;
  source?: ExerciseSource;
}

export type MusicNotationHandle = {
  toggleMenu: () => void;
  createNewExercise: () => void;
  importExercise: () => void;
};

type MusicNotationProps = {
  onMenuShownChange?: (shown: boolean) => void;
};

const MusicNotation = forwardRef<MusicNotationHandle, MusicNotationProps>(function MusicNotation(
  { onMenuShownChange }: MusicNotationProps,
  ref,
) {
  const { t } = useI18n();
  const presetModules = import.meta.glob('../exercises/presets/*.json', { eager: true }) as Record<
    string,
    { default: any }
  >;

  const presetExercises: Exercise[] = Object.entries(presetModules)
    .map(([path, mod]) => {
      const raw = mod?.default ?? mod;
      const name = typeof raw?.name === 'string' ? raw.name : undefined;
      const description = typeof raw?.description === 'string' ? raw.description : undefined;
      const piecesRaw = Array.isArray(raw?.pieces) ? raw.pieces : [];
      if (!name || piecesRaw.length === 0) return null;

      const idFromFile = path.split('/').pop()?.replace(/\.json$/i, '') || name;
      const pieces: Piece[] = piecesRaw.map((p: any, idx: number) => {
        const noteInput =
          typeof p?.noteInput === 'string'
            ? p.noteInput
            : Array.isArray(p?.notes)
              ? p.notes.map((t: any) => (typeof t === 'string' ? normalizeNoteToken(t) : '')).filter(Boolean).join(' ')
              : '';

        const lyricsInput =
          typeof p?.lyricsInput === 'string'
            ? p.lyricsInput
            : Array.isArray(p?.lyrics)
              ? p.lyrics.map((t: any) => (typeof t === 'string' ? t : '')).filter(Boolean).join(' ')
              : '';

        const { notes, error } = parseNotes(noteInput);
        const lyrics = lyricsInput.trim() ? lyricsInput.trim().split(/\s+/) : [];

        return {
          id: idx + 1,
          noteInput,
          lyricsInput,
          notes,
          lyrics,
          error,
        };
      });

      return {
        id: `preset:${idFromFile}`,
        name,
        description,
        pieces,
        createdAt: 0,
        source: 'preset' as const,
      };
    })
    .filter(Boolean) as Exercise[];

  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem('exercises');
    const parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e: any) => ({ ...e, source: e?.source === 'preset' ? 'preset' : 'memory' }));
  });
  const [currentExercise, setCurrentExercise] = useState<Exercise>(() => {
    const saved = localStorage.getItem('currentExercise');
    return saved ? JSON.parse(saved) : {
      id: Date.now().toString(),
      name: t('app.newExercise'),
      description: undefined,
      pieces: [{
        id: 1,
        noteInput: 'c d e f | g a b c5',
        lyricsInput: 'Do Re Mi Fa | Sol La Ti Do',
        notes: ['c/4', 'd/4', 'e/4', 'f/4', '|', 'g/4', 'a/4', 'b/4', 'c/5'],
        lyrics: ['Do', 'Re', 'Mi', 'Fa', '|', 'Sol', 'La', 'Ti', 'Do']
      }],
      createdAt: Date.now(),
      source: 'memory'
    };
  });
  const [showMenu, setShowMenu] = useState(false);
  const [showTransposeModal, setShowTransposeModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseDescription, setExerciseDescription] = useState('');
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [transposeCopies, setTransposeCopies] = useState(1);
  const [expandedPieces, setExpandedPieces] = useState<Set<number>>(() => {
    const pieces = currentExercise.pieces;
    return new Set(pieces.length > 0 ? [pieces[pieces.length - 1].id] : []);
  });
  const [showHelp, setShowHelp] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [playingPieceId, setPlayingPieceId] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [playOneOctaveLower, setPlayOneOctaveLower] = useState(false);
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const setShowMenuWithNotify = (next: boolean) => {
    setShowMenu(next);
    onMenuShownChange?.(next);
  };

  const toggleMenu = () => {
    setShowMenu(prev => {
      const next = !prev;
      onMenuShownChange?.(next);
      return next;
    });
  };

  function validateNote(note: string): boolean {
    if (note === '|') return true;
    // Allow 'b' as a note name, but not as a flat modifier
    const noteRegex = /^[a-g](b(?![a-g])|#)?[3-5]?$/;
    return noteRegex.test(note);
  }

  function parseNotes(input: string): { notes: string[], error?: string } {
    const noteList = input.trim().split(/\s+/);
    
    // Check for empty input
    if (noteList.length === 0 || (noteList.length === 1 && noteList[0] === '')) {
      return { notes: [], error: t('error.notes.empty') };
    }

    // Validate each note and add default octave if needed
    const processedNotes = noteList.map(note => {
      if (note === '|') return note;
      if (!validateNote(note)) {
        return note; // Return invalid note as is, it will be caught by validation
      }
      // Add default octave 4 if not specified
      return note.match(/[3-5]$/) ? note : `${note}4`;
    });

    // Validate each note
    for (let i = 0; i < processedNotes.length; i++) {
      const note = processedNotes[i];
      if (note !== '|' && !validateNote(note)) {
        return { 
          notes: [], 
          error: t('error.notes.invalidAt', { pos: i + 1, note })
        };
      }
    }

    return { notes: processedNotes };
  }

  function normalizeNoteToken(token: string): string {
    if (token === '|') return token;
    const slashMatch = token.match(/^([a-g](?:b(?![a-g])|#)?)[/ ]([3-5])$/i);
    if (slashMatch) return `${slashMatch[1].toLowerCase()}${slashMatch[2]}`;
    return token.toLowerCase();
  }

  const importExerciseFromJson = (json: unknown) => {
    if (!json || typeof json !== 'object') throw new Error('Invalid JSON: expected an object');

    const obj = json as any;
    const name = typeof obj.name === 'string' ? obj.name : undefined;
    const description = typeof obj.description === 'string' ? obj.description : undefined;
    const piecesRaw = Array.isArray(obj.pieces) ? obj.pieces : undefined;

    if (!name) throw new Error('Invalid JSON: missing "name" (string)');
    if (!piecesRaw || piecesRaw.length === 0) throw new Error('Invalid JSON: missing "pieces" (non-empty array)');

    const pieces: Piece[] = piecesRaw.map((p: any, idx: number) => {
      const noteInput =
        typeof p?.noteInput === 'string'
          ? p.noteInput
          : Array.isArray(p?.notes)
            ? p.notes.map((t: any) => (typeof t === 'string' ? normalizeNoteToken(t) : '')).filter(Boolean).join(' ')
            : '';

      const lyricsInput =
        typeof p?.lyricsInput === 'string'
          ? p.lyricsInput
          : Array.isArray(p?.lyrics)
            ? p.lyrics.map((t: any) => (typeof t === 'string' ? t : '')).filter(Boolean).join(' ')
            : '';

      const { notes, error } = parseNotes(noteInput);
      const lyrics = lyricsInput.trim() ? lyricsInput.trim().split(/\s+/) : [];

      return {
        id: idx + 1,
        noteInput,
        lyricsInput,
        notes,
        lyrics,
        error,
      };
    });

    setCurrentExercise({
      id: Date.now().toString(),
      name,
      description,
      pieces,
      createdAt: Date.now(),
    });
  };

  const onImportClick = () => {
    importInputRef.current?.click();
  };

  const onImportFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      importExerciseFromJson(JSON.parse(text));
    } catch (err: any) {
      alert(err?.message || t('error.jsonLoad'));
    }
  };

  const exportExerciseToJson = () => {
    const exportPayload = {
      name: currentExercise.name,
      description: currentExercise.description,
      pieces: currentExercise.pieces.map((p) => ({
        noteInput: p.noteInput,
        lyricsInput: p.lyricsInput,
        notes: p.notes,
        lyrics: p.lyrics,
      })),
    };

    const safeName = (currentExercise.name || 'exercise')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'exercise';

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
          height: 200, // Initial height, will be adjusted
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

      // Calculate required height and adjust container and canvas
      const measuresPerRow = 2;
      const rows = Math.ceil(measures.length / measuresPerRow);
      const totalHeight = rows * 220; // 200 height + 20 padding per row
      container.style.height = `${totalHeight}px`;
      factory.getContext().resize(800, totalHeight);

      // Create staves for each measure
      measures.forEach((measure, index) => {
        // Calculate x and y positions based on measure index
        const row = Math.floor(index / measuresPerRow);
        const col = index % measuresPerRow;
        const x = 10 + col * 410; // 400 width + 10 padding
        const y = 40 + row * 220; // 200 height + 20 padding between rows
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
              console.log(note);
              const { note: vexNote, octave } = noteToVexFlowFormat(note);
              console.log(vexNote, octave);
              const staveNote = factory.StaveNote({ 
                keys: [`${vexNote}/${octave}`], 
                duration: 'q' 
              });

              // Add accidental if needed
              const accidental = note.includes('#') ? '#' : (note.includes('b') && note !== 'b') ? 'b' : '';
              if (accidental) {
                staveNote.addModifier(new Accidental(accidental), 0);
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
          context.fillText(
            t('error.render', { message: error.message || t('error.render.fallback') }),
            x,
            y + 50,
          );
        }
      });
    });
  }, [currentExercise]);

  // Initialize Tone.js sampler
  useEffect(() => {
    const initAudio = async () => {
      // Create a new sampler
      const sampler = new Tone.Sampler({
        urls: {
          "C4": "C4.mp3",
          "D#4": "Ds4.mp3",
          "F#4": "Fs4.mp3",
          "A4": "A4.mp3",
        },
        release: 1,
        baseUrl: "https://tonejs.github.io/audio/salamander/",
      }).toDestination();

      // Wait for the samples to load
      await Tone.loaded();
      samplerRef.current = sampler;
      setIsAudioReady(true);
    };

    initAudio();

    // Cleanup
    return () => {
      if (samplerRef.current) {
        samplerRef.current.dispose();
      }
    };
  }, []);

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
    setExerciseName(currentExercise.name);
    setExerciseDescription(currentExercise.description || '');
    setShowSaveModal(true);
  };

  const confirmSaveExercise = () => {
    if (!exerciseName.trim()) return;

    const savingFromPreset = currentExercise.source === 'preset' || currentExercise.id.startsWith('preset:');
    const updatedExercise = {
      ...currentExercise,
      name: exerciseName.trim(),
      description: exerciseDescription.trim() || undefined,
      id: savingFromPreset ? Date.now().toString() : (currentExercise.id || Date.now().toString()),
      createdAt: savingFromPreset ? Date.now() : (currentExercise.createdAt || Date.now()),
      source: 'memory' as const
    };

    setExercises(prev => {
      const filtered = prev.filter(e => e.id !== updatedExercise.id);
      return [...filtered, updatedExercise].sort((a, b) => b.createdAt - a.createdAt);
    });
    setCurrentExercise(updatedExercise);
    setShowSaveModal(false);
  };

  const loadExercise = (exercise: Exercise) => {
    setCurrentExercise({ ...exercise, source: exercise.source === 'preset' ? 'preset' : 'memory' });
    setShowMenuWithNotify(false);
  };

  const deleteExercise = (id: string) => {
    setExerciseToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteExercise = () => {
    if (exerciseToDelete) {
      setExercises(prev => prev.filter(e => e.id !== exerciseToDelete));
      if (currentExercise.id === exerciseToDelete) {
        setCurrentExercise({
          id: Date.now().toString(),
          name: t('app.newExercise'),
          description: undefined,
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
      setShowDeleteModal(false);
      setExerciseToDelete(null);
    }
  };

  const createNewExercise = () => {
    if (currentExercise.pieces.some(p => p.noteInput || p.lyricsInput)) {
      if (!confirm(t('confirm.newExercise'))) {
        return;
      }
    }
    setCurrentExercise({
      id: Date.now().toString(),
      name: t('app.newExercise'),
      description: undefined,
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

  useImperativeHandle(ref, () => ({
    toggleMenu,
    createNewExercise,
    importExercise: onImportClick,
  }));

  const transposeNote = (note: string, semitones: number): string => {
    if (note === '|') return note;
    
    const noteMap = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    // Extract note name and octave
    const match = note.match(/^([a-g](?:b(?![a-g])|#)?)([3-5])?$/);
    if (!match) return note;
    
    const [, noteName, octave] = match;
    // Find the index in the noteMap, including accidentals
    let noteIndex = noteMap.indexOf(noteName.toLowerCase());
    if (noteIndex === -1) return note;
    
    // Apply transposition
    noteIndex = (noteIndex + semitones + 12) % 12;
    
    // Calculate octave change
    const octaveNum = parseInt(octave || '4');
    const octaveChange = Math.floor((noteMap.indexOf(noteName.toLowerCase()) + semitones) / 12);
    const newOctave = octaveNum + octaveChange;
    
    // Get the new note name
    const newNoteName = noteMap[noteIndex];
    
    return `${newNoteName}${newOctave}`;
  };

  const handleCopyPiece = (pieceId: number) => {
    setSelectedPieceId(pieceId);
    setTransposeSemitones(0);
    setTransposeCopies(1);
    setShowTransposeModal(true);
  };

  const confirmCopyPiece = () => {
    if (selectedPieceId === null) return;
    
    const pieceIndex = currentExercise.pieces.findIndex(p => p.id === selectedPieceId);
    const pieceToCopy = currentExercise.pieces[pieceIndex];
    if (!pieceToCopy) return;

    const maxExistingId = Math.max(...currentExercise.pieces.map(p => p.id));
    const copyCount = Math.max(1, Math.min(99, transposeCopies || 1));

    const copiesAsc = Array.from({ length: copyCount }, (_, idx) => {
      const semitones = transposeSemitones * (idx + 1);
      const transposedNotes = pieceToCopy.notes.map(note => transposeNote(note, semitones));
      const transposedNoteInput = transposedNotes.join(' ');
      return {
        ...pieceToCopy,
        id: maxExistingId + idx + 1,
        noteInput: transposedNoteInput,
        notes: transposedNotes,
      };
    });

    // Keep natural order: +S, +2S, ..., +NS.
    const copiesForInsert = copiesAsc;
    const newPieces = [...currentExercise.pieces];
    newPieces.splice(pieceIndex + 1, 0, ...copiesForInsert);

    setCurrentExercise({
      ...currentExercise,
      pieces: newPieces
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
  };

  // Function to convert note to Tone.js format
  const noteToToneFormat = (note: string): string => {
    if (note === '|') return '';
    
    // Extract note name and octave
    const match = note.match(/^([a-g](?:b(?![a-g])|#)?)([3-5])?$/);
    if (!match) return '';
    
    const [, noteName, octave] = match;
    // Handle 'b' as a note name, not as a flat
    const baseNote = noteName.replace(/(?<!^)b|#/, '');
    const accidental = noteName.includes('#') ? '#' : (noteName.includes('b') && noteName !== 'b') ? 'b' : '';
    
    // Adjust octave if playOneOctaveLower is true
    const octaveNum = parseInt(octave || '4');
    const adjustedOctave = playOneOctaveLower ? octaveNum - 1 : octaveNum;
    
    return `${baseNote.toUpperCase()}${accidental}${adjustedOctave}`;
  };

  // Function to convert note to VexFlow format
  const noteToVexFlowFormat = (note: string): { note: string, octave: string } => {
    if (note === '|') return { note: '', octave: '' };
    
    // Extract note name and octave
    const match = note.match(/^([a-g](?:b(?![a-g])|#)?)([3-5])?$/);
    if (!match) return { note: '', octave: '' };
    
    const [, noteName, octave] = match;
    // Handle 'b' as a note name, not as a flat
    const baseNote = noteName.replace(/(?<!^)b|#/, '');
    
    return {
      note: baseNote,
      octave: octave || '4'
    };
  };

  // Function to play a piece using Tone.js
  const playPiece = async (piece: Piece) => {
    console.log('playPiece called for piece id:', piece.id);
    if (playingPieceId !== null) {
      console.log('Stopping current playback');
      Tone.Transport.stop();
      Tone.Transport.cancel();
      Tone.Transport.position = 0;
      setPlayingPieceId(null);
      return;
    }

    if (!isAudioReady || !samplerRef.current) {
      console.log('Audio not ready:', { isAudioReady, sampler: samplerRef.current });
      alert(t('error.audioNotReady'));
      return;
    }

    setPlayingPieceId(piece.id);
    console.log('Starting playback for piece id:', piece.id);

    // Calculate note duration based on playback speed
    const baseNoteDuration = 0.5; // 500ms for quarter note
    const noteDuration = baseNoteDuration / Math.abs(playbackSpeed);
    const pauseDuration = 0.1 / Math.abs(playbackSpeed);

    // Reset and start Tone.js transport
    await Tone.start();
    Tone.Transport.stop();
    Tone.Transport.cancel();
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = 60 * playbackSpeed;

    // Schedule all notes
    let currentTime = 0;
    for (const note of piece.notes) {
      if (note === '|') {
        continue;
      }
      const toneNote = noteToToneFormat(note);
      if (toneNote) {
        console.log('Scheduling note', toneNote, 'at', currentTime);
        Tone.Transport.schedule((time) => {
          samplerRef.current!.triggerAttackRelease(toneNote, noteDuration, time);
        }, currentTime);
        currentTime += noteDuration + pauseDuration;
      }
    }

    // Schedule the end of playback
    Tone.Transport.schedule(() => {
      console.log('Playback ended for piece id:', piece.id);
      setPlayingPieceId(null);
      
      // Auto play next piece if enabled
      if (autoPlayNext) {
        const currentIndex = currentExercise.pieces.findIndex(p => p.id === piece.id);
        if (currentIndex < currentExercise.pieces.length - 1) {
          const nextPiece = currentExercise.pieces[currentIndex + 1];
          setTimeout(() => playPiece(nextPiece), 500); // Small delay before playing next piece
        }
      }
    }, currentTime);

    // Start playback
    console.log('Transport start');
    Tone.Transport.start();
  };

  return (
    <div className="space-y-8">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={onImportFilePicked}
      />

      {showMenu && (
        <div className="bg-white p-4 rounded-lg shadow-lg border">
          <h3 className="text-lg font-semibold mb-4">{t('exercise.list.title')}</h3>
          <div className="space-y-2">
            {[
              ...presetExercises.sort((a, b) => a.name.localeCompare(b.name)),
              ...exercises.map(e => ({ ...e, source: 'memory' as const })),
            ].map(exercise => {
              const isPreset = exercise.source === 'preset' || exercise.id.startsWith('preset:');
              return (
                <div key={exercise.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded gap-3">
                  <button
                    onClick={() => loadExercise(exercise)}
                    className="flex-1 text-left flex items-center gap-3"
                  >
                    <span className="truncate">{exercise.name}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                        isPreset
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {isPreset ? t('exercise.tag.preset') : t('exercise.tag.memory')}
                    </span>
                  </button>
                  {!isPreset && (
                    <button
                      onClick={() => deleteExercise(exercise.id)}
                      className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      {t('exercise.delete')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{currentExercise.name}</h2>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                (currentExercise.source === 'preset' || currentExercise.id.startsWith('preset:'))
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              {(currentExercise.source === 'preset' || currentExercise.id.startsWith('preset:'))
                ? t('exercise.tag.preset')
                : t('exercise.tag.memory')}
            </span>
            <div className="relative group">
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100 text-gray-600"
                aria-label={t('exercise.typeInfo.aria')}
              >
                <InformationCircleIcon className="w-5 h-5" />
              </button>
              <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 top-full mt-2 w-80 z-10">
                <div className="bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-lg">
                  <div className="font-semibold mb-1">{t('exercise.typeInfo.title')}</div>
                  <div>
                    <strong>{t('exercise.tag.preset')}</strong> {t('exercise.typeInfo.preset')}
                    <br />
                    <strong>{t('exercise.tag.memory')}</strong> {t('exercise.typeInfo.memory')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="space-x-4">
          <button
            onClick={exportExerciseToJson}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            {t('exercise.export')}
          </button>
          <button
            onClick={saveExercise}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t('exercise.save')}
          </button>
        </div>
      </div>

      {/* Collapsible Help Section */}
      <div className="bg-blue-50 rounded-lg border border-blue-200">
        <button
          className="w-full flex justify-between items-center px-4 py-3 focus:outline-none"
          onClick={() => setShowHelp((prev) => !prev)}
        >
          <span className="text-lg font-semibold text-blue-800">{t('help.title')}</span>
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
            <p><strong>{t('help.notesFormat.title')}</strong> {t('help.notesFormat.body')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('help.notesFormat.noteNames')}</li>
              <li>{t('help.notesFormat.accidentals')}</li>
              <li>{t('help.notesFormat.octaves')}</li>
              <li>{t('help.notesFormat.separate')}</li>
              <li>{t('help.notesFormat.bar')} <code className="bg-blue-100 px-1 rounded">|</code></li>
              <li>{t('help.notesFormat.examples')}
                <ul className="list-disc pl-5 mt-1">
                  <li><code className="bg-blue-100 px-1 rounded">c d e f</code> — {t('help.notesFormat.example.basic')}</li>
                  <li><code className="bg-blue-100 px-1 rounded">c# db e f#</code> — {t('help.notesFormat.example.acc')}</li>
                  <li><code className="bg-blue-100 px-1 rounded">c d e f | g a b c5</code> — {t('help.notesFormat.example.bar')}</li>
                </ul>
              </li>
            </ul>
            <p><strong>{t('help.lyricsFormat.title')}</strong> {t('help.lyricsFormat.body')}</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t('help.lyricsFormat.perNote')}</li>
              <li>{t('help.lyricsFormat.bar')} <code className="bg-blue-100 px-1 rounded">|</code></li>
              <li>{t('help.lyricsFormat.example')} <code className="bg-blue-100 px-1 rounded">Do Re Mi Fa | Sol La Ti Do</code></li>
            </ul>
          </div>
        )}
      </div>

      {/* Exercise Description */}
      {currentExercise.description && (
        <div className="bg-green-50 rounded-lg border border-green-200">
          <div className="p-4">
            <h3 className="text-lg font-semibold text-green-800 mb-2">{t('exercise.description.title')}</h3>
            <div className="text-green-700">
              {showFullDescription ? (
                <div className="whitespace-pre-wrap">{currentExercise.description}</div>
              ) : (
                <div>
                  {currentExercise.description.split('\n')[0]}
                  {currentExercise.description.includes('\n') && '...'}
                </div>
              )}
              {currentExercise.description.includes('\n') && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="mt-2 text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  {showFullDescription ? t('exercise.description.showLess') : t('exercise.description.showMore')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Playback Speed Control */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <span className="text-lg font-semibold text-gray-800">{t('playback.speed')}</span>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="px-3 py-1 border rounded bg-white"
          >
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="1.75">1.75x</option>
            <option value="2">2x</option>
          </select>
          <div className="flex items-center space-x-2 ml-4">
            <span className="text-lg font-semibold text-gray-800">{t('playback.autoNext')}</span>
            <button
              onClick={() => setAutoPlayNext(!autoPlayNext)}
              className={`px-3 py-1 rounded ${
                autoPlayNext ? 'bg-green-600' : 'bg-gray-600'
              } text-white hover:opacity-90`}
            >
              {autoPlayNext ? t('toggle.on') : t('toggle.off')}
            </button>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <span className="text-lg font-semibold text-gray-800">{t('playback.octaveLower')}</span>
            <button
              onClick={() => setPlayOneOctaveLower(!playOneOctaveLower)}
              className={`px-3 py-1 rounded ${
                playOneOctaveLower ? 'bg-green-600' : 'bg-gray-600'
              } text-white hover:opacity-90`}
            >
              {playOneOctaveLower ? t('toggle.on') : t('toggle.off')}
            </button>
          </div>
        </div>
      </div>

      {currentExercise.pieces.map((piece) => (
        <div key={piece.id} className="mb-8">
          <div className="border rounded-lg overflow-hidden">
            <div 
              className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
              onClick={() => togglePieceExpansion(piece.id)}
            >
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-semibold">{t('piece.title', { id: piece.id })}</h3>
                <div className="flex space-x-2 items-center">
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
                    {playingPieceId === piece.id ? t('piece.stop') : t('piece.play')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyPiece(piece.id);
                    }}
                    className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    {t('piece.copy')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePiece(piece.id);
                    }}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    {t('piece.delete')}
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <span className="text-gray-500 mr-2">
                  {expandedPieces.has(piece.id) ? t('piece.collapse') : t('piece.expand')}
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
                    <label className="block text-sm font-medium mb-1">{t('piece.notes.label')}</label>
                    <input
                      type="text"
                      value={piece.noteInput}
                      onChange={e => handleInputChange(piece.id, 'noteInput', e.target.value)}
                      className={`border rounded px-2 py-1 w-96 ${piece.error ? 'border-red-500' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('piece.lyrics.label')}</label>
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
                    {t('piece.update')}
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
        {t('piece.add')}
      </button>

      {/* Transpose Modal */}
      {showTransposeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{t('modal.transpose.title')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('modal.transpose.semitones')}
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
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('modal.transpose.copies')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={transposeCopies}
                  onChange={(e) => setTransposeCopies(parseInt(e.target.value) || 1)}
                  className="border rounded px-2 py-1 w-full"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowTransposeModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  {t('modal.cancel')}
                </button>
                <button
                  onClick={confirmCopyPiece}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {t('modal.copy')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Exercise Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{t('modal.save.title')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('modal.save.name')}
                </label>
                <input
                  type="text"
                  value={exerciseName}
                  onChange={(e) => setExerciseName(e.target.value)}
                  className="border rounded px-2 py-1 w-full"
                  placeholder={t('modal.save.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('modal.save.description')}
                </label>
                <textarea
                  value={exerciseDescription}
                  onChange={(e) => setExerciseDescription(e.target.value)}
                  className="border rounded px-2 py-1 w-full h-24 resize-none"
                  placeholder={t('modal.save.descriptionPlaceholder')}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  {t('modal.cancel')}
                </button>
                <button
                  onClick={confirmSaveExercise}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {t('modal.save.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Exercise Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{t('modal.delete.title')}</h3>
            <p className="mb-4">{t('modal.delete.confirm')}</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                {t('modal.cancel')}
              </button>
              <button
                onClick={confirmDeleteExercise}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                {t('modal.delete.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default MusicNotation; 