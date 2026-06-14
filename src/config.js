// Shared frontend config. Keep secrets out — the real Firebase web config
// lives in src/firebase-config.js (gitignored).
//
// BACKEND_URL must match the backend's PORT in /quantiliom-ai-backend/.env.
// macOS reserves :5000 for AirPlay Receiver, so the dev backend runs on :5050.
export const BACKEND_URL = "http://localhost:5050";

// DASHBOARD_URL is the authenticated app surface (separate repo:
// /Users/hasan/Desktop/quantiliom-ai-dashboard). The login/onboarding flow
// redirects here after a successful sign-in (onboarded user) or after the
// registration wizard completes. Cross-origin auth state is intentionally
// not handed off here — the dashboard milestone is UI-only for now.
export const DASHBOARD_URL = "http://localhost:5173";
