/// <reference types="vite/client" />

declare module 'vexflow' {
  export class Factory {
    static Renderer: {
      new(width: number, height: number): {
        getContext(): {
          clear(): void;
        };
      };
    };
    static Stave: {
      new(x: number, y: number, width: number): {
        addClef(clef: string): void;
        setContext(context: any): any;
        draw(): void;
      };
    };
    static StaveNote: {
      new(options: { keys: string[]; duration: string }): {
        addModifier(modifier: any, index: number): void;
      };
    };
    static Annotation: {
      new(text: string): any;
    };
    static Formatter: {
      FormatAndDraw(context: any, stave: any, notes: any[]): void;
    };
  }
} 