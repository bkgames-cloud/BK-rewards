/** Émis par `AppStateAudioHandler` quand l’app native passe au premier plan ou en arrière-plan. */
export const CAPACITOR_APP_STATE_EVENT = "capacitor-app-state-change" as const

export type CapacitorAppStateDetail = { isActive: boolean }
