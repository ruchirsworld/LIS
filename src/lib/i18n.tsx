import { createContext, useContext, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { HI } from './translations/hi'

export type Language = 'en' | 'hi'

const STORAGE_KEY = 'lis.supervisor.language'

function readStoredLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'hi' ? 'hi' : 'en'
  } catch {
    return 'en'
  }
}

const LanguageContext = createContext<{ lang: Language; setLang: (l: Language) => void }>({
  lang: 'en',
  setLang: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readStoredLanguage)

  function setLang(l: Language) {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      // ignore — purely a UX convenience, safe to skip if storage is unavailable
    }
  }

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}

// Translation is scoped to the Supervisor role even if a stored preference
// somehow carries over on a shared device — an Admin/CXO session never sees
// Hindi, regardless of what a Supervisor last picked in the same browser.
export function useT() {
  const { profile } = useAuth()
  const { lang } = useLanguage()
  const active = profile?.role === 'supervisor' && lang === 'hi'
  return (text: string) => (active ? HI[text] ?? text : text)
}
