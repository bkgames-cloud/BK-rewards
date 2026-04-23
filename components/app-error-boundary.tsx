"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

type Props = { children: ReactNode }

type State = { hasError: boolean; message: string | null }

/**
 * Évite un écran blanc total si un composant client plante après hydratation (WebView Capacitor).
 */
export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: null }
  }

  static getDerivedStateFromError(err: Error): Partial<State> {
    return { hasError: true, message: err?.message ?? "Erreur inconnue" }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[AppErrorBoundary]", error, info.componentStack)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100svh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "#0a0a0a",
            color: "#fafafa",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>BKG Rewards</p>
          <p style={{ fontSize: 14, color: "#a3a3a3", textAlign: "center", maxWidth: 320 }}>
            Une erreur a interrompu l’affichage. Fermez puis rouvrez l’app, ou vérifiez votre connexion.
          </p>
          {this.state.message ? (
            <p style={{ fontSize: 11, color: "#737373", marginTop: 16, textAlign: "center" }}>
              {this.state.message}
            </p>
          ) : null}
        </div>
      )
    }
    return this.props.children
  }
}
