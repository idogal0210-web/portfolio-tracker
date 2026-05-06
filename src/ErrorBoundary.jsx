import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    const message = String(this.state.error?.message ?? this.state.error)

    return (
      <div style={{
        minHeight: '100dvh', background: '#050505', color: '#fff',
        padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', whiteSpace: 'pre-wrap' }}>
          {message}
        </div>
        <button
          onClick={this.handleReset}
          style={{
            marginTop: 12, height: 48, borderRadius: 14, background: '#22c55e',
            color: '#000', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer',
          }}
        >
          Try again
        </button>
        <button
          onClick={() => { this.handleReset(); window.history.pushState(null, '', '/') }}
          style={{
            height: 40, borderRadius: 14, background: 'rgba(255,255,255,0.08)',
            color: '#fff', fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer',
          }}
        >
          Back to home
        </button>
      </div>
    )
  }
}
