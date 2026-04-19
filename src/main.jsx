import React from 'react';
import ReactDOM from 'react-dom/client';
import './lib/i18n/config';
import App from './App.tsx';
import './styles/index.css';
import { registerAppServiceWorker } from './lib/pwaPush';

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }

  static getDerivedStateFromError(err) {
    return { err };
  }

  render() {
    if (this.state.err) {
      const msg = this.state.err instanceof Error ? this.state.err.message : String(this.state.err);
      return (
        <main
          style={{
            minHeight: '100svh',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
            background: '#FFF9F5',
            color: '#2C1A0E',
          }}
        >
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>In-Bite could not start</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>
            {msg}
          </p>
          <p style={{ fontSize: 13, opacity: 0.85 }}>
            Check the browser console (F12), Vercel → Environment Variables (Clerk / Supabase keys), and Clerk → Domains for this deployment URL.
          </p>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element in index.html');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
);

void registerAppServiceWorker();
