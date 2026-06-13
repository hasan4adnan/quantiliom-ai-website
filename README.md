# Quantiliom AI — Website / Frontend

Static landing site and authentication UI for Quantiliom AI. The login page
talks to the [`quantiliom-ai-backend`](../quantiliom-ai-backend) service to
verify Firebase ID tokens and persist users in PostgreSQL.

This milestone implements **Email/Password sign-up + sign-in** and keeps the
existing Google sign-in working. Apple and other social providers are visible
but show "not configured yet" until later milestones.

## Project layout

```
.
├── index.html
├── login.html               # Sign in / Create account (this milestone)
├── pricing.html
├── services.html
├── contact-sales.html
├── nav.js
├── theme.css / variables.css / tokens.json
├── src/
│   ├── firebase.js                  # Firebase App + Auth init (CDN ESM)
│   ├── firebase-config.example.js   # Template — copy and fill in
│   ├── firebase-config.js           # Local config (gitignored)
│   └── auth.js                      # Login page wiring
├── .env.example                     # VITE_FIREBASE_* keys (documentation)
├── .gitignore
└── README.md
```

## One-time Firebase project setup

In the [Firebase Console](https://console.firebase.google.com/) for the
project that backs the `firebase-config.js` you use:

1. **Authentication → Sign-in method → Add provider → Email/Password** →
   enable **Email/Password** (leave Email link / passwordless off for now) →
   **Save**.
2. **Authentication → Sign-in method → Add provider → Google** → enable →
   pick a support email → **Save**.
3. **Authentication → Settings → Authorized domains** must include
   `localhost` (it is by default).

Without step 1, sign-up will fail with
`auth/operation-not-allowed`.

## Local Firebase web config

```bash
cp src/firebase-config.example.js src/firebase-config.js
```

Fill in the values from **Project settings → General → Your apps → Web app →
SDK setup and configuration** (or the names listed in `.env.example`).
`src/firebase-config.js` is gitignored — never commit it.

## Run the frontend locally

CORS in the backend allows only `http://localhost:5500` and
`http://127.0.0.1:5500`. Serve the static files from port **5500**:

```bash
# Option A — VS Code Live Server: right-click login.html → "Open with Live Server"
# Option B — Python http.server
python3 -m http.server 5500
```

Then open <http://localhost:5500/login.html>.

The backend must already be running (see
[`quantiliom-ai-backend`](../quantiliom-ai-backend)). It listens on
`http://localhost:5050` by default (macOS reserves `:5000` for AirPlay
Receiver). The frontend constant `BACKEND_URL` in `src/auth.js` is set to
match.

## Using the login page

The login page has two modes — **Sign in** and **Create account** — that
toggle via the link under the form:

> Don't have an account? **Create one →**
> Already have an account? **Sign in →**

### Email/Password — create an account

1. Click **Create one →** below the form.
2. Heading switches to *"Create your account."*; the **Confirm password**
   field appears; the submit button becomes **Create account**.
3. Enter email + password (min 6 chars) + matching confirmation → submit.
4. Firebase creates the user; the frontend posts the ID token to the backend;
   the backend upserts the local PostgreSQL row.
5. Green toast: **"Account created and verified."**
6. The user is auto-signed-out after 2 s (this temporary test behavior stays
   until the dashboard repo lands).

Open DevTools Console while you do this. You should see two log lines (the
Firebase ID token is **never** logged):

```
[auth] /api/auth/verify → { id, email, plan: "free", onboardingStatus: "not_started" }
[auth] /api/users/me   → { id, email, plan: "free", onboardingStatus: "not_started" }
```

### Email/Password — sign in to the same account

1. Click **Sign in →** to switch back.
2. Enter the same email + password → submit.
3. Green toast: **"Login successful. User verified."**

### Google — unchanged

Click **Google**, complete the popup. Green toast:
**"Login successful. User persisted as free plan."**

### Validation errors (client-side, before Firebase is called)

| Condition | Toast |
| --- | --- |
| Email blank | "Please enter your email address." |
| Password blank | "Please enter your password." / "Please enter a password." |
| Password < 6 chars (signup) | "Password must be at least 6 characters." |
| Confirm ≠ password (signup) | "Passwords do not match." |

### Firebase error mapping

| Firebase code | Toast |
| --- | --- |
| `auth/email-already-in-use` | "This email is already registered. Please sign in instead." |
| `auth/invalid-email` | "Please enter a valid email address." |
| `auth/weak-password` | "Password is too weak. Use at least 6 characters." |
| `auth/invalid-credential`, `auth/wrong-password` | "Invalid email or password." |
| `auth/user-not-found` | "No account found with this email." |
| `auth/too-many-requests` | "Too many attempts. Please try again later." |
| `auth/network-request-failed` | "Network error. Check your connection." |

## Verifying the user end-to-end

After signing up via the UI:

### Firebase Console → Authentication → Users

The new user appears with its email, the provider icon (orange person for
password / Google logo for Google), the created timestamp, and a UID.

### Prisma Studio → User table

In the backend repo:

```bash
cd ../quantiliom-ai-backend
npx prisma studio
```

A browser tab opens at <http://localhost:5555>. The `User` table shows one row
per account with:

- `firebaseUid` — matches the UID in Firebase Console
- `email` — matches
- `provider` — `"password"` for email/password, `"google.com"` for Google
- `plan` — `"free"`
- `onboardingStatus` — `"not_started"`
- `lastLoginAt` — advances on every sign-in

Signing into the **same** account again must not create a new row — it
should only update `lastLoginAt`, `name`, `picture`, `provider`,
`updatedAt`.

Or check with `psql`:

```bash
PGPASSWORD=quantiliom psql -h localhost -U quantiliom -d quantiliom_ai \
  -c 'SELECT id, "firebaseUid", email, provider, plan, "lastLoginAt" FROM "User";'
```

## What this milestone does NOT include

- Dashboard or post-login redirect (dashboard will be a separate repo).
- Onboarding flow (`onboardingStatus` exists in the DB but isn't driven yet).
- Apple / Microsoft / GitHub / GitLab / Slack / SSO sign-in — the buttons
  show "not configured yet."
- Billing or plan upgrades.
- Password reset flow (the "Forgot password?" link is decorative).
