 docker build -t sing-homework .# Sing-Homework

A web application for sharing singing exercises between teachers and students. This application allows teachers to create and edit note sheets with lyrics, and students to view and practice their singing exercises.

## Features

- Interactive note sheet editor
- Keyboard shortcuts for note input
- Lyrics/sounds integration with notes
- Real-time preview
- Responsive design

## Prerequisites

- Docker
- Node.js 18+ (for local development)

## Getting Started

### Using Docker

1. Build the Docker image:
```bash
docker build -t sing-homework .
```

2. Run the container:
```bash
docker run -p 5173:5173 sing-homework
```

3. Open your browser and navigate to `http://localhost:5173`

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Tech Stack

- React 18
- Vite
- TypeScript
- TailwindCSS
- VexFlow (for music notation) 