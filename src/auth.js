import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "./firebase.js";
import { BACKEND_URL } from "./config.js";

const SIGN_OUT_DELAY_MS = 2000;
const REDIRECT_TO_REGISTRATION_DELAY_MS = 700;
const PASSWORD_MIN_LENGTH = 6;

const SUBMIT_ARROW_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

const els = {
  errorToast: document.getElementById("toastError"),
  errorMsg: document.getElementById("toastErrorMsg"),
  successToast: document.getElementById("toastSuccess"),
  successMsg: document.getElementById("toastSuccessMsg"),
  submitBtn: document.getElementById("submitBtn"),
  emailInput: document.getElementById("li-email"),
  passwordInput: document.getElementById("li-password"),
  confirmPasswordInput: document.getElementById("li-password-confirm"),
  confirmPasswordField: document.getElementById("confirmPasswordField"),
  fieldMetaRow: document.getElementById("fieldMetaRow"),
  heading: document.querySelector(".r-heading"),
  legalPrompt: document.getElementById("legalPrompt"),
  modeTogglePrompt: document.getElementById("modeTogglePrompt"),
  modeToggleLink: document.getElementById("modeToggleLink"),
};

const MODE_CONFIG = {
  signin: {
    heading: "Welcome back.",
    submitLabel: "Sign in",
    loadingLabel: "Signing in…",
    confirmShown: false,
    fieldMetaShown: true,
    legalPrompt: "By signing in",
    togglePrompt: "Don't have an account?",
    toggleLabel: "Create one →",
  },
  signup: {
    heading: "Create your account.",
    submitLabel: "Create account",
    loadingLabel: "Creating account…",
    confirmShown: true,
    fieldMetaShown: false,
    legalPrompt: "By creating an account",
    togglePrompt: "Already have an account?",
    toggleLabel: "Sign in →",
  },
};

let currentMode = "signin";

function hideToasts() {
  els.errorToast.classList.remove("visible");
  els.successToast.classList.remove("visible");
}

function showError(message) {
  els.successToast.classList.remove("visible");
  els.errorMsg.textContent = message;
  els.errorToast.classList.add("visible");
}

function showSuccess(message) {
  els.errorToast.classList.remove("visible");
  els.successMsg.textContent = message;
  els.successToast.classList.add("visible");
}

function applySubmitButton(label) {
  els.submitBtn.innerHTML = `${label} ${SUBMIT_ARROW_SVG}`;
}

function setSubmitLoading(loading) {
  const cfg = MODE_CONFIG[currentMode];
  if (loading) {
    els.submitBtn.disabled = true;
    els.submitBtn.textContent = cfg.loadingLabel;
  } else {
    els.submitBtn.disabled = false;
    applySubmitButton(cfg.submitLabel);
  }
}

function setSocialBtnLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset._origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.style.opacity = "0.6";
    btn.style.pointerEvents = "none";
    btn.textContent = "Connecting…";
  } else {
    if (btn.dataset._origHtml) btn.innerHTML = btn.dataset._origHtml;
    delete btn.dataset._origHtml;
    btn.disabled = false;
    btn.style.opacity = "";
    btn.style.pointerEvents = "";
  }
}

function findSocialBtn(providerLabel) {
  const buttons = document.querySelectorAll(".social-grid .social-btn");
  for (const btn of buttons) {
    if (btn.textContent.trim().toLowerCase().includes(providerLabel.toLowerCase())) {
      return btn;
    }
  }
  return null;
}

function setMode(mode) {
  if (mode !== "signin" && mode !== "signup") return;
  currentMode = mode;
  const cfg = MODE_CONFIG[mode];

  els.heading.textContent = cfg.heading;
  applySubmitButton(cfg.submitLabel);
  els.confirmPasswordField.style.display = cfg.confirmShown ? "" : "none";
  els.fieldMetaRow.style.display = cfg.fieldMetaShown ? "" : "none";
  els.legalPrompt.textContent = cfg.legalPrompt;
  els.modeTogglePrompt.textContent = cfg.togglePrompt;
  els.modeToggleLink.textContent = cfg.toggleLabel;

  if (mode === "signin") {
    els.confirmPasswordInput.value = "";
  }
  hideToasts();
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch (_) {
    return {};
  }
}

async function postVerify(idToken) {
  const res = await fetch(`${BACKEND_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const data = await readJsonSafe(res);
  if (!res.ok || !data.success || !data.user) {
    const reason = data.error || `Backend returned HTTP ${res.status}`;
    throw new Error(reason);
  }
  return data.user;
}

async function fetchMe(idToken) {
  const res = await fetch(`${BACKEND_URL}/api/users/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await readJsonSafe(res);
  if (!res.ok || !data.success || !data.user) {
    const reason = data.error || `Backend returned HTTP ${res.status}`;
    throw new Error(reason);
  }
  return data.user;
}

function safeUserSummary(user) {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan,
    onboardingStatus: user.onboardingStatus,
  };
}

function scheduleSignOutAndReload() {
  setTimeout(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("signOut failed:", err);
    }
    window.location.replace("login.html");
  }, SIGN_OUT_DELAY_MS);
}

function successMessageFor(kind, verifiedUser) {
  if (kind === "signup") return "Account created and verified.";
  if (kind === "signin") return "Login successful. User verified.";
  const plan = (verifiedUser && verifiedUser.plan) || "free";
  return `Login successful. User persisted as ${plan} plan.`;
}

async function completeLoginFlow(userCredential, kind) {
  const idToken = await userCredential.user.getIdToken();

  const verifiedUser = await postVerify(idToken);
  console.log("[auth] /api/auth/verify →", safeUserSummary(verifiedUser));

  let meUser;
  try {
    meUser = await fetchMe(idToken);
  } catch (err) {
    console.error("[auth] /api/users/me failed:", err);
    showError("Login succeeded, but user profile check failed.");
    scheduleSignOutAndReload();
    return;
  }
  console.log("[auth] /api/users/me   →", safeUserSummary(meUser));

  if (meUser.id !== verifiedUser.id || meUser.firebaseUid !== verifiedUser.firebaseUid) {
    console.warn("[auth] /api/users/me returned a different user than /api/auth/verify");
  }

  if (verifiedUser.onboardingStatus !== "completed") {
    // First-time user — keep the Firebase session and continue to the wizard.
    showSuccess(successMessageFor(kind, verifiedUser));
    setTimeout(() => {
      window.location.href = "registration.html";
    }, REDIRECT_TO_REGISTRATION_DELAY_MS);
    return;
  }

  // Already onboarded — dashboard isn't built yet. Sign out and reload login.
  showSuccess("Login successful. Dashboard is not available yet.");
  scheduleSignOutAndReload();
}

function friendlyAuthError(err) {
  const code = (err && err.code) || "";
  const map = {
    "auth/email-already-in-use": "This email is already registered. Please sign in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": `Password is too weak. Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    "auth/missing-password": "Please enter your password.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/wrong-password": "Invalid email or password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/popup-blocked": "Popup blocked by the browser. Please allow popups and retry.",
  };
  return map[code] || (err && err.message) || "Sign-in failed. Please try again.";
}

async function handleEmailSignIn() {
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;

  if (!email) {
    showError("Please enter your email address.");
    els.emailInput.focus();
    return;
  }
  if (!password) {
    showError("Please enter your password.");
    els.passwordInput.focus();
    return;
  }

  setSubmitLoading(true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await completeLoginFlow(cred, "signin");
  } catch (err) {
    console.error("email/password sign-in failed:", err);
    showError(friendlyAuthError(err));
  } finally {
    setSubmitLoading(false);
  }
}

async function handleEmailSignUp() {
  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;
  const confirmPassword = els.confirmPasswordInput.value;

  if (!email) {
    showError("Please enter your email address.");
    els.emailInput.focus();
    return;
  }
  if (!password) {
    showError("Please enter a password.");
    els.passwordInput.focus();
    return;
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    showError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    els.passwordInput.focus();
    return;
  }
  if (password !== confirmPassword) {
    showError("Passwords do not match.");
    els.confirmPasswordInput.focus();
    return;
  }

  setSubmitLoading(true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await completeLoginFlow(cred, "signup");
  } catch (err) {
    console.error("email/password sign-up failed:", err);
    showError(friendlyAuthError(err));
  } finally {
    setSubmitLoading(false);
  }
}

async function handleSignIn() {
  hideToasts();
  if (currentMode === "signup") {
    return handleEmailSignUp();
  }
  return handleEmailSignIn();
}

async function socialLogin(provider) {
  hideToasts();

  if (provider === "Google") {
    const btn = findSocialBtn("Google");
    setSocialBtnLoading(btn, true);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await completeLoginFlow(cred, "google");
    } catch (err) {
      const code = err && err.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        // User dismissed — no error message needed.
      } else {
        console.error("Google sign-in failed:", err);
        showError(friendlyAuthError(err));
      }
    } finally {
      setSocialBtnLoading(btn, false);
    }
    return;
  }

  if (provider === "Apple") {
    showError("Apple Sign-In is not configured yet.");
    return;
  }

  showError("This provider is not configured yet.");
}

els.modeToggleLink.addEventListener("click", (e) => {
  e.preventDefault();
  setMode(currentMode === "signin" ? "signup" : "signin");
  els.emailInput.focus();
});

setMode("signin");

window.handleSignIn = handleSignIn;
window.socialLogin = socialLogin;
