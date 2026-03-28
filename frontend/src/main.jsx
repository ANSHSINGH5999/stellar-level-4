import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.jsx";
import "./index.css";

// Initialize Sentry error tracking
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "",
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({ maskAllText: false, blockAllMedia: false }),
  ],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="min-h-screen bg-stellar-950 flex items-center justify-center p-4">
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-red-400 mb-3">Something went wrong</h2>
            <p className="text-gray-400 mb-6 text-sm font-mono break-all">{error?.message}</p>
            <button
              onClick={resetError}
              className="bg-stellar-600 hover:bg-stellar-500 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    >
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
