'use client'
import React from 'react'

interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#010101', color: '#e8e8ed', fontFamily: 'Inter, system-ui, sans-serif', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, opacity: 0.15 }}>!</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,.6)' }}>Something went wrong</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.25)', maxWidth: 400 }}>{this.state.error?.message || 'An unexpected error occurred'}</div>
          <button onClick={() => window.location.reload()} style={{ marginTop: 12, height: 40, padding: '0 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 500 }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
