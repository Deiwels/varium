'use client'
import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class DevErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '60px 40px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <div style={{ fontSize: 32 }}>⚠</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', maxWidth: 400 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 8, height: 36, padding: '0 24px', borderRadius: 999,
              border: 'none', cursor: 'pointer',
              background: 'rgba(130,150,220,.15)', color: 'rgba(130,150,220,.9)',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
