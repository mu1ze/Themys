"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

type Theme = "dark" | "light"
type ThemeContextValue = { theme: Theme; toggleTheme: () => void }

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark" as Theme,
  toggleTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = window.localStorage.getItem("themys-theme")
      if (stored === "light" || stored === "dark") setTheme(stored)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", theme === "light")
    document.documentElement.classList.toggle("theme-dark", theme === "dark")
    window.localStorage.setItem("themys-theme", theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => current === "dark" ? "light" : "dark")
  }, [])

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
