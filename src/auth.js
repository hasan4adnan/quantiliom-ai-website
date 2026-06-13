import {
  auth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "./firebase.js";

const BACKEND_URL = "http://localhost:5050";
const SIGN_OUT_DELAY_MS = 2000;

const els = {
  errorToast: document.getElementById("toastError"),
  errorMsg: document.getElementById("toastErrorMsg"),
  successToast: document.getElementById("toastSuccess"),
  successMsg: document.getElementById("toastSuccessMsg"),
  submitBtn: document.getElementById("submitBtn"),
  emailInput: document.getElementById("li-email"),
  passwordInput: document.getElementById("li-password"),
};

const submitBtnOriginalHtml = els.submitBtn.innerHTML;

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

function setSubmitLoading(loading) {
  if (loading) {
    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "Signing in…";
  } else {
    els.submitBtn.disabled = false;
    els.submitBtn.innerHTML = submitBtnOriginalHtml;
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

async function verifyTokenWithBackend(idToken) {
  const res = await fetch(`${BACKEND_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {
    // non-JSON body
  }
  if (!res.ok || !data.success) {
    const reason = data.error || `Backend returned HTTP ${res.status}`;
    throw new Error(reason);
  }
  return data;
}

async function completeLoginFlow(userCredential) {
  const user = userCredential.user;
  const idToken = await user.getIdToken();
  await verifyTokenWithBackend(idToken);
  showSuccess("Login successful. User exists and token verified.");
  setTimeout(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("signOut failed:", err);
    }
    hideToasts();
  }, SIGN_OUT_DELAY_MS);
}

function friendlyAuthError(err) {
  const code = (err && err.code) || "";
  const map = {
    "auth/invalid-credential": "Invalid email or password.",
    "auth/wrong-password": "Invalid email or password.",
    "auth/user-not-found": "No account found for that email.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/popup-blocked": "Popup blocked by the browser. Please allow popups and retry.",
  };
  return map[code] || (err && err.message) || "Sign-in failed. Please try again.";
}

async function handleSignIn() {
  hideToasts();
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
    await completeLoginFlow(cred);
  } catch (err) {
    console.error("email/password sign-in failed:", err);
    showError(friendlyAuthError(err));
  } finally {
    setSubmitLoading(false);
  }
}

async function socialLogin(provider) {
  hideToasts();

  if (provider === "Google") {
    const btn = findSocialBtn("Google");
    setSocialBtnLoading(btn, true);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await completeLoginFlow(cred);
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

window.handleSignIn = handleSignIn;
window.socialLogin = socialLogin;
