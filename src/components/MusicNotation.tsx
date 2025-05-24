import { useEffect, useRef } from 'react';
import { Factory } from 'vexflow';

function MusicNotation() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create a new VexFlow factory
    const factory = new Factory({ 
      renderer: { 
        elementId: containerRef.current.id, 
        width: 500, 
        height: 200 
      } 
    });

    // Create the stave
    const stave = factory.Stave({ x: 10, y: 40, width: 400 });
    stave.addClef('treble').addTimeSignature('4/4');
    stave.setContext(factory.getContext()).draw();

    // Create the notes
    const notes = [
      factory.StaveNote({ keys: ['c/4'], duration: 'q' }),
      factory.StaveNote({ keys: ['d/4'], duration: 'q' }),
      factory.StaveNote({ keys: ['e/4'], duration: 'q' }),
      factory.StaveNote({ keys: ['f/4'], duration: 'q' })
    ];

    // Create a voice and add the notes
    const voice = factory.Voice({ time: '4/4' });
    voice.addTickables(notes);

    // Format and justify the notes
    factory.Formatter().joinVoices([voice]).format([voice], 400);

    // Render voice
    voice.draw(factory.getContext(), stave);
  }, []);

  return (
    <div ref={containerRef} id="music-notation" className="bg-white p-4 rounded-lg shadow-lg" />
  );
}

export default MusicNotation; 