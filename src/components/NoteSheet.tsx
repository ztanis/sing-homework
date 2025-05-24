import { Stage, Layer, Line, Circle, Text } from 'react-konva';

interface Note {
  x: number;
  y: number;
  label: string;
}

const NoteSheet = () => {
  // Define the staff lines
  const staffLines = [
    { x1: 50, y1: 100, x2: 550, y2: 100 },
    { x1: 50, y1: 120, x2: 550, y2: 120 },
    { x1: 50, y1: 140, x2: 550, y2: 140 },
    { x1: 50, y1: 160, x2: 550, y2: 160 },
    { x1: 50, y1: 180, x2: 550, y2: 180 },
  ];

  // Define the notes (A3, C4, D4)
  const notes: Note[] = [
    { x: 150, y: 180, label: 'A3' }, // A3 is on the bottom line
    { x: 250, y: 140, label: 'C4' }, // C4 is on the middle line
    { x: 350, y: 120, label: 'D4' }, // D4 is on the second line from top
  ];

  return (
    <Stage width={600} height={300}>
      <Layer>
        {/* Draw staff lines */}
        {staffLines.map((line, i) => (
          <Line
            key={i}
            points={[line.x1, line.y1, line.x2, line.y2]}
            stroke="black"
            strokeWidth={1}
          />
        ))}

        {/* Draw notes */}
        {notes.map((note, i) => (
          <Circle
            key={i}
            x={note.x}
            y={note.y}
            radius={8}
            fill="black"
          />
        ))}

        {/* Draw note labels */}
        {notes.map((note, i) => (
          <Text
            key={`label-${i}`}
            x={note.x - 10}
            y={note.y + 15}
            text={note.label}
            fontSize={14}
            fill="black"
          />
        ))}
      </Layer>
    </Stage>
  );
};

export default NoteSheet; 