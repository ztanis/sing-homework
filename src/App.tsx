import { useRef, useState } from 'react'
import MusicNotation, { type MusicNotationHandle } from './components/MusicNotation'
import { useI18n } from './i18n'

function App() {
  const musicNotationRef = useRef<MusicNotationHandle | null>(null)
  const [menuShown, setMenuShown] = useState(false)
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">{t('app.title')}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">{t('app.language')}</span>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value === 'uk' ? 'uk' : 'en')}
                className="px-3 py-2 border rounded bg-white"
                aria-label={t('app.language')}
              >
                <option value="en">EN</option>
                <option value="uk">UA</option>
              </select>
            </div>
            <button
              onClick={() => musicNotationRef.current?.toggleMenu()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              {menuShown ? t('app.hideExercises') : t('app.exercises')}
            </button>
            <button
              onClick={() => musicNotationRef.current?.createNewExercise()}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              {t('app.newExercise')}
            </button>
            <button
              onClick={() => musicNotationRef.current?.importExercise()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              {t('app.import')}
            </button>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <MusicNotation ref={musicNotationRef} onMenuShownChange={setMenuShown} />
        </div>
      </div>
    </div>
  )
}

export default App 