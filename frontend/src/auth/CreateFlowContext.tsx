import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type CreateFlowState = {
  raceId: string | null
  classId: string | null
  setRaceId: (id: string | null) => void
  setClassId: (id: string | null) => void
  reset: () => void
}

const CreateFlowContext = createContext<CreateFlowState | null>(null)

export function CreateFlowProvider({ children }: { children: ReactNode }) {
  const [raceId, setRaceId] = useState<string | null>(null)
  const [classId, setClassId] = useState<string | null>(null)

  const value = useMemo(
    () => ({
      raceId,
      classId,
      setRaceId,
      setClassId,
      reset: () => {
        setRaceId(null)
        setClassId(null)
      },
    }),
    [raceId, classId],
  )

  return <CreateFlowContext.Provider value={value}>{children}</CreateFlowContext.Provider>
}

export function useCreateFlow(): CreateFlowState {
  const ctx = useContext(CreateFlowContext)
  if (!ctx) throw new Error('useCreateFlow must be used within CreateFlowProvider')
  return ctx
}
