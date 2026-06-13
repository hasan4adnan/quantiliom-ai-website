// Shared frontend config. Keep secrets out — the real Firebase web config
// lives in src/firebase-config.js (gitignored).
//
// BACKEND_URL must match the backend's PORT in /quantiliom-ai-backend/.env.
// macOS reserves :5000 for AirPlay Receiver, so the dev backend runs on :5050.
export const BACKEND_URL = "http://localhost:5050";
