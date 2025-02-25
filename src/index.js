import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as Sentry from "@sentry/react";


// Initialize Sentry
Sentry.init({
  dsn: "https://70a29fbe6d0d065d73164cbad4d41e2b@o4508877597966336.ingest.us.sentry.io/4508877599145984",

  // Tracing
  tracesSampleRate: 1.0, // Capture 100% of transactions (adjust in production)
  tracePropagationTargets: ["localhost", /^https:\/\/caycincubator\.com/],
  // Session Replay
  replaysSessionSampleRate: 0.1, // Sample 10% of sessions for replay (adjust as needed)
  replaysOnErrorSampleRate: 1.0, // Sample 100% of sessions with errors
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Measure performance
reportWebVitals();
