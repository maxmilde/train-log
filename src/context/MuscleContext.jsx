import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { getExerciseMuscles, saveExerciseMuscles } from '../lib/db'
import { classify, classificationFromRow } from '../lib/muscles'
import { nameKey } from '../lib/workoutTemplates'

// Muscle classifications you've saved, loaded once and shared by every screen.
const MuscleContext = createContext(null)

export function useMuscles() {
  return useContext(MuscleContext)
}

export function MuscleProvider({ children }) {
  const { user } = useAuth()
  const [saved, setSaved] = useState(() => new Map())  // nameKey -> classification
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    // If this fails (offline), `loaded` stays false so the Log never asks about
    // exercises whose muscles you've already set
    getExerciseMuscles(user.id)
      .then(rows => {
        setSaved(new Map(rows.map(r => [r.name_key, classificationFromRow(r)])))
        setLoaded(true)
      })
      .catch(e => console.error('Load muscle tags:', e))
  }, [user])

  const save = useCallback(async (name, classification) => {
    const row = await saveExerciseMuscles(user.id, name, classification)
    setSaved(prev => new Map(prev).set(row.name_key, classificationFromRow(row)))
  }, [user])

  // Forget a saved name after a rename/delete elsewhere (Catalog reloads it anyway)
  const refresh = useCallback(async () => {
    if (!user) return
    const rows = await getExerciseMuscles(user.id)
    setSaved(new Map(rows.map(r => [r.name_key, classificationFromRow(r)])))
  }, [user])

  const value = useMemo(() => ({
    saved,
    loaded,
    save,
    refresh,
    lookup: (name) => classify(name, saved),
    isSaved: (name) => saved.has(nameKey(name)),
  }), [saved, loaded, save, refresh])

  return <MuscleContext.Provider value={value}>{children}</MuscleContext.Provider>
}
