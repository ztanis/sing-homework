import React, { createContext, useContext, useMemo, useState } from 'react';

export type Locale = 'en' | 'uk';

type Vars = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, vars?: Vars) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'locale';

const translations: Record<Locale, Record<string, string>> = {
  en: {
    'app.title': 'Sing Homework',
    'app.exercises': 'Exercises',
    'app.hideExercises': 'Hide Exercises',
    'app.newExercise': 'New Exercise',
    'app.import': 'Import',
    'app.language': 'Language',

    'exercise.list.title': 'Exercises',
    'exercise.tag.preset': 'Preset',
    'exercise.tag.memory': 'In memory',
    'exercise.delete': 'Delete',

    'exercise.typeInfo.aria': 'Exercise type info',
    'exercise.typeInfo.title': 'Preset vs In memory',
    'exercise.typeInfo.preset': 'Preset exercises are predefined and shipped with the app.',
    'exercise.typeInfo.memory':
      'In memory exercises are created/edited by you in the browser. They are not guaranteed to persist and can be lost if browser data is cleared. We recommend using Export to keep a copy.',

    'exercise.export': 'Export',
    'exercise.save': 'Save Exercise',

    'help.title': 'How to Write Notation',
    'help.notesFormat.title': 'Notes Format:',
    'help.notesFormat.body':
      'Use note name with optional octave (e.g., c d e f or c4 d4 e4 f4)',
    'help.notesFormat.noteNames': 'Note names: a, b, c, d, e, f, g',
    'help.notesFormat.accidentals':
      'Accidentals: use # for sharp (e.g., c#4 or just c#) or b for flat (e.g., cb4 or just cb)',
    'help.notesFormat.octaves': 'Octave numbers: 3 (low) to 5 (high)',
    'help.notesFormat.separate': 'Separate notes with spaces',
    'help.notesFormat.bar': 'Use | to create a bar line',
    'help.notesFormat.examples': 'Examples:',
    'help.notesFormat.example.basic': 'basic notes',
    'help.notesFormat.example.acc': 'with accidentals',
    'help.notesFormat.example.bar': 'with bar line',

    'help.lyricsFormat.title': 'Lyrics Format:',
    'help.lyricsFormat.body': 'One word per note, separated by spaces',
    'help.lyricsFormat.perNote': 'Each word will appear under its corresponding note',
    'help.lyricsFormat.bar': 'Use | to separate lyrics for different measures',
    'help.lyricsFormat.example': 'Example: Do Re Mi Fa | Sol La Ti Do',

    'exercise.description.title': 'Exercise Description',
    'exercise.description.showLess': 'Show less',
    'exercise.description.showMore': 'Show more',

    'playback.speed': 'Playback Speed:',
    'playback.autoNext': 'Auto play next:',
    'toggle.on': 'On',
    'toggle.off': 'Off',
    'playback.octaveLower': 'Play one octave lower:',

    'piece.title': 'Piece {id}',
    'piece.play': 'Play',
    'piece.stop': 'Stop',
    'piece.copy': 'Copy',
    'piece.delete': 'Delete',
    'piece.collapse': 'Collapse',
    'piece.expand': 'Expand',

    'piece.notes.label': 'Notes (e.g. c d e f | g a b c5):',
    'piece.lyrics.label': 'Lyrics (e.g. Do Re Mi Fa | Sol La Ti Do):',
    'piece.update': 'Update',
    'piece.add': 'Add Piece',

    'modal.transpose.title': 'Transpose Piece',
    'modal.transpose.semitones': 'Number of semitones to transpose (-12 to +12):',
    'modal.transpose.copies': 'Number of copies to create (1 to 99):',
    'modal.cancel': 'Cancel',
    'modal.copy': 'Copy',

    'modal.save.title': 'Save Exercise',
    'modal.save.name': 'Exercise Name:',
    'modal.save.namePlaceholder': 'Enter exercise name',
    'modal.save.description': 'Exercise Description (optional):',
    'modal.save.descriptionPlaceholder': 'Enter description for this exercise...',
    'modal.save.save': 'Save',

    'modal.delete.title': 'Delete Exercise',
    'modal.delete.confirm': 'Are you sure you want to delete this exercise?',
    'modal.delete.delete': 'Delete',

    'confirm.newExercise':
      'Are you sure you want to create a new exercise? Any unsaved changes will be lost.',

    'error.jsonLoad': 'Failed to load exercise JSON',
    'error.notes.empty': 'Please enter at least one note',
    'error.notes.invalidAt':
      'Invalid note format at position {pos}: "{note}". Expected format: note[octave] (e.g., c4, c#5, cb3) or just note (e.g., c, c#, cb)',
    'error.render': 'Error: {message}',
    'error.render.fallback': 'Failed to render notes',
    'error.audioNotReady': 'Audio is not ready yet. Please wait a moment and try again.',
  },
  uk: {
    'app.title': 'Домашні завдання зі співу',
    'app.exercises': 'Вправи',
    'app.hideExercises': 'Сховати вправи',
    'app.newExercise': 'Нова вправа',
    'app.import': 'Імпорт',
    'app.language': 'Мова',

    'exercise.list.title': 'Вправи',
    'exercise.tag.preset': 'Шаблон',
    'exercise.tag.memory': 'У памʼяті',
    'exercise.delete': 'Видалити',

    'exercise.typeInfo.aria': 'Інформація про тип вправи',
    'exercise.typeInfo.title': 'Шаблон vs У памʼяті',
    'exercise.typeInfo.preset': 'Шаблонні вправи визначені заздалегідь і постачаються разом із застосунком.',
    'exercise.typeInfo.memory':
      'Вправи «у памʼяті» створюються/редагуються у браузері. Їх не гарантовано зберігати назавжди — дані можуть зникнути, якщо очистити дані браузера. Рекомендуємо використовувати «Експорт», щоб зберегти копію.',

    'exercise.export': 'Експорт',
    'exercise.save': 'Зберегти вправу',

    'help.title': 'Як писати нотацію',
    'help.notesFormat.title': 'Формат нот:',
    'help.notesFormat.body': 'Використовуйте назву ноти з необовʼязковою октавою (наприклад, c d e f або c4 d4 e4 f4)',
    'help.notesFormat.noteNames': 'Назви нот: a, b, c, d, e, f, g',
    'help.notesFormat.accidentals':
      'Альтерації: # для дієза (наприклад, c#4 або просто c#) або b для бемоля (наприклад, cb4 або просто cb)',
    'help.notesFormat.octaves': 'Октави: 3 (низька) до 5 (висока)',
    'help.notesFormat.separate': 'Розділяйте ноти пробілами',
    'help.notesFormat.bar': 'Використовуйте | для риски такту',
    'help.notesFormat.examples': 'Приклади:',
    'help.notesFormat.example.basic': 'базові ноти',
    'help.notesFormat.example.acc': 'з альтераціями',
    'help.notesFormat.example.bar': 'з рискою такту',

    'help.lyricsFormat.title': 'Формат тексту:',
    'help.lyricsFormat.body': 'Одне слово на ноту, розділене пробілами',
    'help.lyricsFormat.perNote': 'Кожне слово відображається під відповідною нотою',
    'help.lyricsFormat.bar': 'Використовуйте | для розділення тексту між тактами',
    'help.lyricsFormat.example': 'Приклад: Do Re Mi Fa | Sol La Ti Do',

    'exercise.description.title': 'Опис вправи',
    'exercise.description.showLess': 'Показати менше',
    'exercise.description.showMore': 'Показати більше',

    'playback.speed': 'Швидкість відтворення:',
    'playback.autoNext': 'Автовідтворення наступної:',
    'toggle.on': 'Увімк.',
    'toggle.off': 'Вимк.',
    'playback.octaveLower': 'На октаву нижче:',

    'piece.title': 'Фрагмент {id}',
    'piece.play': 'Відтворити',
    'piece.stop': 'Зупинити',
    'piece.copy': 'Копіювати',
    'piece.delete': 'Видалити',
    'piece.collapse': 'Згорнути',
    'piece.expand': 'Розгорнути',

    'piece.notes.label': 'Ноти (напр. c d e f | g a b c5):',
    'piece.lyrics.label': 'Текст (напр. Do Re Mi Fa | Sol La Ti Do):',
    'piece.update': 'Оновити',
    'piece.add': 'Додати фрагмент',

    'modal.transpose.title': 'Транспонувати фрагмент',
    'modal.transpose.semitones': 'Кількість півтонів для транспозиції (-12 до +12):',
    'modal.transpose.copies': 'Скільки копій створити (1 до 99):',
    'modal.cancel': 'Скасувати',
    'modal.copy': 'Копіювати',

    'modal.save.title': 'Зберегти вправу',
    'modal.save.name': "Назва вправи:",
    'modal.save.namePlaceholder': 'Введіть назву вправи',
    'modal.save.description': 'Опис вправи (необовʼязково):',
    'modal.save.descriptionPlaceholder': 'Введіть опис цієї вправи...',
    'modal.save.save': 'Зберегти',

    'modal.delete.title': 'Видалити вправу',
    'modal.delete.confirm': 'Ви впевнені, що хочете видалити цю вправу?',
    'modal.delete.delete': 'Видалити',

    'confirm.newExercise': 'Створити нову вправу? Усі незбережені зміни буде втрачено.',

    'error.jsonLoad': 'Не вдалося завантажити JSON вправи',
    'error.notes.empty': 'Будь ласка, введіть хоча б одну ноту',
    'error.notes.invalidAt':
      'Неправильний формат ноти на позиції {pos}: "{note}". Очікується: нота[октава] (напр., c4, c#5, cb3) або лише нота (напр., c, c#, cb)',
    'error.render': 'Помилка: {message}',
    'error.render.fallback': 'Не вдалося намалювати ноти',
    'error.audioNotReady': 'Аудіо ще не готове. Зачекайте трохи та спробуйте ще раз.',
  },
};

function interpolate(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function normalizeLocale(input: unknown): Locale {
  return input === 'uk' ? 'uk' : 'en';
}

function detectDefaultLocale(): Locale {
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  return nav.toLowerCase().startsWith('uk') ? 'uk' : 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return saved ? normalizeLocale(saved) : detectDefaultLocale();
  });

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  const t = useMemo(() => {
    return (key: string, vars?: Vars) => {
      const table = translations[locale] ?? translations.en;
      const fallback = translations.en;
      const raw = table[key] ?? fallback[key] ?? key;
      return interpolate(raw, vars);
    };
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

