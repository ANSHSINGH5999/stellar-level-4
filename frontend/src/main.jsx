import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.jsx";
import "./index.css";

// Silence Stellar SDK's verbose default-logger warning in dev
if (typeof window !== "undefined") {
  const _warn = console.warn.bind(console);
  console.warn = (...args) => {
    if (typeof args[0] === "string" && args[0].includes("DEFAULT root logger")) return;
    _warn(...args);
  };
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
