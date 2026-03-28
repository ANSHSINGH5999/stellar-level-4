import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.jsx";
import "./index.css";

// Suppress known browser-extension noise from console
if (typeof window !== "undefined") {
  const NOISE = [
    "DEFAULT root logger",
    "message channel closed",
    "message port closed",
    "A listener indicated an asynchronous response",
    "Unchecked runtime.lastError",
  ];
  const shouldSuppress = (args) =>
    args.some(a => typeof a === "string" && NOISE.some(n => a.includes(n)));

  const _warn  = console.warn.bind(console);
  const _error = console.error.bind(console);
  console.warn  = (...args) => { if (!shouldSuppress(args)) _warn(...args); };
  console.error = (...args) => { if (!shouldSuppress(args)) _error(...args); };

  // Suppress unhandled promise rejections from extension message port closes
  window.addEventListener("unhandledrejection", (e) => {
    const msg = e?.reason?.message || String(e?.reason || "");
    if (NOISE.some(n => msg.includes(n))) e.preventDefault();
  });
}

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay({ maskAllText: false, blockAllMedia: false }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

function ErrorFallback({ error, resetError }) {
  return (
    <div className="min-h-screen bg-stellar-950 flex items-center justify-center p-4">
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-red-400 mb-3">Something went wrong</h2>
        <p className="text-gray-400 mb-2 text-sm">
          {error?.message || "An unexpected error occurred."}
        </p>
        {error?.stack && (
          <pre className="text-xs text-gray-600 bg-stellar-900 rounded-lg p-3 mb-6 text-left overflow-auto max-h-32">
            {error.stack.slice(0, 400)}
          </pre>
        )}
        <button
          onClick={resetError}
          className="bg-stellar-600 hover:bg-stellar-500 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// Remove the HTML pre-loader once React takes over
document.getElementById("pre-loader")?.remove();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
