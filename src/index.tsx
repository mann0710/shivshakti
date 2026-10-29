import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Before React mounts, a crash shows on the page; afterwards errors are only logged so the app keeps running.
let mounted = false;
const showFatal = (text: string) => {
  if (mounted) { console.error(text); return; }
  document.getElementById('root')!.innerHTML =
    `<pre style="color:#A32D2D;background:#FCEBEB;padding:24px;margin:24px;border-radius:8px;font-size:13px;white-space:pre-wrap">${text}</pre>`;
};
window.onerror = (msg, _src, _line, _col, err) => showFatal(`${msg}\n\n${err?.stack || ''}`);
window.addEventListener('unhandledrejection', e => showFatal(`Unhandled promise rejection:\n${e.reason?.stack || e.reason}`));

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ padding: 40, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#A32D2D', marginBottom: 12 }}>App crashed</h2>
          <pre style={{ background: '#FCEBEB', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 13 }}>{err.message}{'\n\n'}{err.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
mounted = true;

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
