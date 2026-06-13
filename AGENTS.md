# AGENTS.md — Quantiliom AI Website / Frontend

Operational notes for future coding agents working in this repo. Describes
what currently exists and the rules that protect it. Read before editing.

## 1. Purpose of this repository

This repo is the **public marketing website and login frontend** for
Quantiliom AI. It is **not** the authenticated dashboard application — the
dashboard will live in a separate repo when it is built.

What currently lives here:

- Marketing pages: `index.html`, `pricing.html`, `services.html`,
  `contact-sales.html`.
- The login page: `login.html` (Sign in ⇄ Create account toggle).
- The first-time onboarding wizard: `registration.html` (driven by
  `src/registration.js`).
- Firebase Web SDK initialization and the auth wiring that talks to the
  backend (`src/firebase.js`, `src/auth.js`).
- Shared frontend config: `src/config.js` (currently only `BACKEND_URL`).

## 2. Current frontend setup

- **Static HTML / CSS / vanilla JS** — no bundler, no framework, no build
  step. Pages are served as files.
- Local development server runs on **port 5500** (VS Code Live Server or
  `python3 -m http.server 5500`). The backend's CORS allowlist is
  `http://localhost:5500` and `http://127.0.0.1:5500` — using any other port
  will fail CORS preflight.
- Firebase Web SDK is loaded as **ESM from the Google CDN** in
  `src/firebase.js` (no `npm` install on the frontend).
- The login page is in this repo. There is **no backend logic here** —
  every server-side concern (token verification, DB upsert) is delegated to
  the backend.
- Shared styling lives in `theme.css`, `variables.css`, `tokens.json`. The
  login page also has scoped styles inside its own `<style>` block to keep
  it standalone.

## 3. Where Firebase is used

- The frontend uses the **Firebase Web SDK** (`firebase/app`,
  `firebase/auth`). It is initialized once in `src/firebase.js`.
- The frontend uses Firebase Auth for:
  - Google sign-in (`signInWithPopup` + `GoogleAuthProvider`).
  - Email/Password sign-in (`signInWithEmailAndPassword`).
  - Email/Password sign-up (`createUserWithEmailAndPassword`).
- After a successful Firebase sign-in, the frontend calls
  `user.getIdToken()` and forwards the token to the backend.
- The frontend **does not verify Firebase tokens itself.** Verification is
  the backend's job.
- The frontend **does not use the Firebase Admin SDK** and never should.
- The frontend **must never contain a service account JSON, private key, or
  any backend secret.** Only the public Web SDK config belongs here.

## 4. Firebase config rules

- The Firebase **Web config** is what belongs in this repo. That is the
  object with `apiKey`, `authDomain`, `projectId`, `storageBucket`,
  `messagingSenderId`, `appId`, and optional `measurementId`. Despite the
  name, the Web `apiKey` is a public app identifier, not a secret — but
  this repo still keeps it out of committed source for hygiene.
- The Firebase Web config is **different** from Firebase Admin credentials.
  Admin credentials are a service account JSON and only belong in the
  backend repo. Do not paste service-account values into any file here.
- `src/firebase-config.js` holds the real local values and is **gitignored**
  (see `.gitignore`). Do not check it in.
- `src/firebase-config.example.js` is the **committed template**. When you
  add or rename a config field, update both the example and the example
  values in `.env.example`.
- **Do not initialize Firebase Analytics** in `src/firebase.js`. It is
  intentionally not enabled. Only `initializeApp` + `getAuth` are wired up.
- **Do not put backend secrets in frontend config.** If you find yourself
  reaching for a "server-only" Firebase API from this repo, the task
  belongs in the backend.

## 5. Backend connection

The backend is a separate repo (`quantiliom-ai-backend`). The frontend's
sole integration with it is two HTTP calls from `src/auth.js`:

- **`POST <BACKEND_URL>/api/auth/verify`** — body `{ "idToken": "..." }`.
  Backend verifies the token and upserts the local user.
- **`GET  <BACKEND_URL>/api/users/me`** — header
  `Authorization: Bearer <idToken>`. Backend returns the local user.

`BACKEND_URL` is a constant at the top of `src/auth.js`. Its current value
is `http://localhost:5050` — the backend listens on `5050` because macOS
reserves `5000` for AirPlay Receiver. If the backend port ever changes,
update this single constant.

Both responses use the envelope `{ success, user }`. Read the persisted
local user from `response.user`. Do not assume `uid` / `email` at the top
level of the response.

Do not invent additional backend endpoints from this document. If a new
endpoint is needed, change the backend repo first and document it there.

## 6. Current auth flows

All wiring lives in `src/auth.js`. The login page exposes a single submit
button whose behavior depends on `currentMode`.

### Google sign-in

- Click the **Google** button on `login.html` → `signInWithPopup` with
  `GoogleAuthProvider`.
- On success the frontend calls `/api/auth/verify`, then `/api/users/me`,
  then shows the toast:
  **"Login successful. User persisted as `${plan}` plan."**

### Email / Password — sign in (`currentMode = "signin"`)

- Default mode on page load.
- Client-side checks: email present, password present.
- On success: same `/api/auth/verify` + `/api/users/me` calls, toast:
  **"Login successful. User verified."**

### Email / Password — sign up (`currentMode = "signup"`)

- Toggle via the link under the form: **"Don't have an account? Create
  one →"**. In signup mode the Confirm password field is revealed, the
  Remember-me / Forgot row is hidden, the heading switches to
  *"Create your account."*, and the submit button reads
  **Create account**.
- Client-side checks before Firebase is called: email present, password
  present, password length ≥ 6 (`PASSWORD_MIN_LENGTH`), confirm matches.
- On success: same `/api/auth/verify` + `/api/users/me` calls, toast:
  **"Account created and verified."**

### Apple sign-in

- Button is visible but **not configured**. Clicking it shows the error
  toast **"Apple Sign-In is not configured yet."** Do not wire it up
  without an explicit task.

### Other social providers (GitHub, Microsoft, GitLab, Slack, SSO)

- Buttons are visible but **not configured**. Clicking any of them shows
  **"This provider is not configured yet."**

### Post-sign-in routing

After `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, or
`signInWithPopup(GoogleAuthProvider)` succeeds, `completeLoginFlow` in
`src/auth.js` always does:

1. `POST /api/auth/verify` with the Firebase ID token → reads `response.user`.
2. `GET /api/users/me` with the same token (for debug logging and a sanity
   check that the two responses agree on `id` / `firebaseUid`).
3. Branches on `verifiedUser.onboardingStatus`:
   - **`!== "completed"`** → brief per-kind success toast, then
     `window.location.href = "registration.html"` after
     `REDIRECT_TO_REGISTRATION_DELAY_MS` (~700 ms). The Firebase session is
     **kept** because the wizard needs it.
   - **`=== "completed"`** → success toast
     **"Login successful. Dashboard is not available yet."**, then
     `signOut(auth)` and `window.location.replace("login.html")` after
     `SIGN_OUT_DELAY_MS` (2000 ms). The dashboard repo doesn't exist yet, so
     "completed" users have nowhere to land — they are intentionally
     reset to the login page.

There is no auto sign-out for the redirect-to-registration branch.

### Registration wizard (`registration.html` + `src/registration.js`)

- Auth gate via `onAuthStateChanged(auth, …)`. If no Firebase user →
  `window.location.replace("login.html")`.
- If signed in, calls `GET /api/users/me`. If `onboardingStatus === "completed"`
  → `window.location.replace("login.html")` (this page isn't for them).
- Otherwise reveals a 6-slide wizard (single-field cards for slides 1–5,
  three pill rows for the combined slide 6) covering exactly the eight
  enum fields validated by `POST /api/onboarding/complete`:
  `role`, `technicalLevel`, `primaryUseCase`, `projectStage`, `teamSize`,
  `detailLevel`, `preferredLanguage`, `planPreference`.
- Submit posts the answers to `POST /api/onboarding/complete` with
  `Authorization: Bearer <idToken>`; on success shows
  **"Registration completed. Dashboard will be available soon."**, signs
  out, and replaces the URL with `login.html`.
- All slide data, field names, and allowed values live in `SLIDES` /
  `REQUIRED_FIELDS` at the top of `src/registration.js`. If the backend
  enum list changes (in `quantiliom-ai-backend/src/server.js
  → ONBOARDING_ENUMS`), update both ends together.

### Shared BACKEND_URL

Both `src/auth.js` and `src/registration.js` import `BACKEND_URL` from
`src/config.js`. There is **one** place to change the backend port — do
not hard-code it elsewhere.

### Logging hygiene

The frontend logs a `safeUserSummary` to the console after each
verify/me call: `{ id, email, plan, onboardingStatus }`. The Firebase ID
token is **never** logged. Keep it that way.

## 7. Local development notes

- The backend must be running. Defaults: `http://localhost:5050`. The
  product spec sometimes writes `:5000` as the canonical URL; in this
  workspace the actual value is `:5050` because of the macOS AirPlay
  collision (see `BACKEND_URL` in `src/auth.js`).
- PostgreSQL must be running for the backend's persistence to work — if it
  isn't, `/api/auth/verify` returns 500 even though Firebase succeeded.
- The frontend must be served from `http://localhost:5500/login.html` (or
  `http://127.0.0.1:5500/login.html`). Use Live Server or
  `python3 -m http.server 5500`.
- **Do not open `login.html` via `file://`.** ES modules and CORS both
  refuse to work over `file://`, and Firebase popups expect an `http(s)`
  origin.
- Firebase Console → **Authentication → Settings → Authorized domains**
  must include `localhost`. It is included by default; do not remove it.

## 8. Common error meanings

Practical translations for errors you will see during local dev:

- **`auth/unauthorized-domain`** — the origin is not in Firebase
  Authorized Domains. Add `localhost` in the Firebase Console.
- **`Failed to fetch` / `TypeError: NetworkError`** — almost always means
  the backend is not running, the wrong `BACKEND_URL` is set, or the page
  is being served from the wrong port (CORS preflight rejected). Check
  the backend `/health` endpoint and confirm the frontend is on port 5500.
- **`auth/invalid-credential`, `auth/wrong-password`** — surfaced to the
  user as **"Invalid email or password."**
- **`auth/email-already-in-use`** — surfaced as **"This email is already
  registered. Please sign in instead."**
- **`auth/weak-password`** — surfaced as **"Password is too weak. Use at
  least 6 characters."**
- **`auth/invalid-email`** — surfaced as **"Please enter a valid email
  address."**
- **`auth/user-not-found`** — surfaced as **"No account found with this
  email."**

The mapping lives in `friendlyAuthError()` inside `src/auth.js`. Surface
new Firebase error codes through the same map rather than letting raw
error strings reach the UI.

## 9. Safety rules for future agents

Hard rules. Violating these is a regression even if the code "works."

- **Do not add the Firebase Admin SDK to the frontend.** Admin is a
  server-side library and pulls in credentials this repo must never see.
- **Do not add Prisma (or any ORM / DB driver) to the frontend.**
- **Do not store a service account JSON in this repo** under any name.
- **Do not log full Firebase ID tokens.** Use the existing
  `safeUserSummary` pattern.
- **Do not redesign the login page or the registration wizard** (markup,
  layout, brand voice, color tokens) unless the task explicitly asks for
  it. Surgical changes only.
- **Do not build dashboard pages in this repo.** The dashboard is a
  separate codebase. The "completed" branch in `src/auth.js` exists *only*
  because there is no dashboard yet — when the dashboard repo lands, that
  branch will redirect, not sign the user out.
- **Do not introduce a build step / framework / package manager** (Vite,
  React, Next.js, etc.) from this document. The site is intentionally
  static today; switching is a separate, scoped task.
- **Do not create future dashboard / onboarding / billing / project /
  AI-generation features from this document.**
- **Do not change backend contracts** (request/response shapes, endpoint
  paths, error envelopes) from this repo. Backend changes happen in the
  backend repo and are co-deployed.

## 10. What this document is not

This file is **not** a product spec, **not** a roadmap, **not** a backlog,
and **not** a list of future features. It only explains the current
technical structure and the guardrails around it. If a future task seems
to require deviating from the rules above, ask first.
