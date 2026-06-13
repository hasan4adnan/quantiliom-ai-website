import { auth, onAuthStateChanged, signOut } from "./firebase.js";
import { BACKEND_URL } from "./config.js";

const POST_SUBMIT_DELAY_MS = 1800;
const REDIRECT_AFTER_ERROR_MS = 1500;

const STEP_LABELS = [
  "Your role",
  "Technical level",
  "Primary use case",
  "Project stage",
  "Team size",
  "Your plan",
];

// Slide 6 is now a focused pricing chooser. The two preference fields
// (detailLevel, preferredLanguage) that used to live on the final slide are
// derived automatically so the user never has to think about them:
//   - detailLevel follows technicalLevel (beginner → simple, intermediate
//     → balanced, advanced → technical).
//   - preferredLanguage follows the browser locale (tr → "tr", anything
//     else → "en").
// The backend still receives all eight fields it validates.
const TECHNICAL_TO_DETAIL = {
  beginner: "simple",
  intermediate: "balanced",
  advanced: "technical",
};

const SLIDES = [
  {
    type: "single",
    field: "role",
    question: "What best describes your role?",
    helper: "Pick the one that fits you best — you can change this later.",
    options: [
      { value: "founder", label: "Founder / Entrepreneur" },
      { value: "developer", label: "Developer" },
      { value: "student", label: "Student" },
      { value: "product_manager", label: "Product Manager" },
      { value: "freelancer_agency", label: "Freelancer / Agency" },
      { value: "other", label: "Other" },
    ],
  },
  {
    type: "single",
    field: "technicalLevel",
    question: "How technical are you?",
    helper: "We'll match the depth of explanations to your comfort level.",
    options: [
      { value: "beginner", label: "Beginner" },
      { value: "intermediate", label: "Intermediate" },
      { value: "advanced", label: "Advanced" },
    ],
  },
  {
    type: "single",
    field: "primaryUseCase",
    question: "What do you mainly want to use Quantiliom for?",
    helper: "Your main goal shapes the questions we ask next.",
    options: [
      { value: "new_product_architecture", label: "Design architecture for a new product" },
      { value: "tech_stack_decision", label: "Choose the right tech stack" },
      { value: "cost_estimation", label: "Estimate technical cost" },
      { value: "documentation", label: "Generate technical documentation" },
      { value: "learning_system_design", label: "Learn system design" },
      { value: "other", label: "Other" },
    ],
  },
  {
    type: "single",
    field: "projectStage",
    question: "What stage is your project in?",
    helper: "So we know whether to plan, design, or refactor with you.",
    options: [
      { value: "idea", label: "Just an idea" },
      { value: "planning_mvp", label: "Planning an MVP" },
      { value: "already_building", label: "Already building" },
      { value: "scaling_or_refactoring", label: "Scaling or refactoring" },
      { value: "other", label: "Other" },
    ],
  },
  {
    type: "single",
    field: "teamSize",
    question: "How many people are in your team?",
    helper: "We tailor collaboration suggestions to your team shape.",
    options: [
      { value: "solo", label: "Just me" },
      { value: "two_to_five", label: "2–5 people" },
      { value: "six_to_fifteen", label: "6–15 people" },
      { value: "sixteen_plus", label: "16+ people" },
    ],
  },
  {
    type: "pricing",
    field: "planPreference",
    question: "Pick the plan that fits today.",
    helper:
      "We just save your preference for now — you can stay on Free as long as you want and switch anytime.",
    options: [
      {
        value: "free",
        tier: "Free forever",
        name: "Starter",
        monthlyPrice: "$0",
        annualPrice: "$0",
        period: "/ month",
        tagline:
          "Explore the platform and get real architecture value on your first project. No credit card required.",
        features: [
          { ok: true,  text: "1 project workspace" },
          { ok: true,  text: "Full architecture overview" },
          { ok: true,  text: "Interactive system diagram" },
          { ok: true,  text: "Tech stack recommendation" },
          { ok: true,  text: "5 chatbot revisions per project" },
          { ok: false, text: "PDF documentation export" },
          { ok: false, text: "Cost optimization reports" },
          { ok: false, text: "Architecture alternatives" },
        ],
      },
      {
        value: "interested_pro",
        tier: "Most popular",
        name: "Pro",
        monthlyPrice: "$29",
        annualPrice: "$23",
        annualOrig: "$29",
        annualNote: "Billed $276 / year — save $72",
        period: "/ month",
        pro: true,
        tagline:
          "Full access to the architecture workspace for solo founders and developers who need the complete picture.",
        features: [
          { ok: true, text: "Unlimited projects" },
          { ok: true, text: "Full architecture generation" },
          { ok: true, text: "2–3 architecture alternatives" },
          { ok: true, text: "Unlimited chatbot revisions" },
          { ok: true, text: "PDF documentation export" },
          { ok: true, text: "Cost optimization reports" },
          { ok: true, text: "Security recommendations" },
          { ok: true, text: "Full tech stack comparisons" },
        ],
      },
      {
        value: "team_evaluation",
        tier: "For teams",
        name: "Team",
        monthlyPrice: "$79",
        annualPrice: "$63",
        annualOrig: "$79",
        annualNote: "Billed $756 / year — save $192",
        period: "/ month",
        tagline:
          "Collaborate on architecture decisions across your entire team in shared, versioned workspaces.",
        features: [
          { ok: true,  text: "Everything in Pro" },
          { ok: true,  text: "Up to 5 team members" },
          { ok: true,  text: "Shared project workspaces" },
          { ok: true,  text: "Collaborative revision history" },
          { ok: true,  text: "Team comments & annotations" },
          { ok: true,  text: "Organization workspace" },
          { ok: true,  text: "Priority support" },
          { ok: false, text: "Enterprise controls (coming soon)" },
        ],
      },
    ],
  },
];

// UI-only billing toggle. Does not change the backend payload — the
// onboarding contract still records planPreference ∈
// { free | interested_pro | team_evaluation } and nothing about cadence.
let billingPeriod = "monthly";

const NB_SPACE = " ";

const REQUIRED_FIELDS = [
  "role",
  "technicalLevel",
  "primaryUseCase",
  "projectStage",
  "teamSize",
  "detailLevel",
  "preferredLanguage",
  "planPreference",
];

const answers = Object.fromEntries(REQUIRED_FIELDS.map((f) => [f, null]));

// Pre-fill the derived fields so the Submit button activates as soon as
// the visible questions are answered.
answers.preferredLanguage =
  (navigator.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en";

let currentSlide = 0;
let navDirection = "next";
let submitting = false;

const els = {
  loader: document.getElementById("loader"),
  card: document.getElementById("wizardCard"),
  slideBody: document.getElementById("slideBody"),
  backBtn: document.getElementById("backBtn"),
  nextBtn: document.getElementById("nextBtn"),
  nextLabel: document.getElementById("nextLabel"),
  stepCurrent: document.getElementById("stepCurrent"),
  stepTotal: document.getElementById("stepTotal"),
  stepLabel: document.getElementById("stepLabel"),
  toastError: document.getElementById("toastError"),
  toastErrorMsg: document.getElementById("toastErrorMsg"),
  toastSuccess: document.getElementById("toastSuccess"),
  toastSuccessMsg: document.getElementById("toastSuccessMsg"),
};

function showError(message) {
  els.toastSuccess.hidden = true;
  els.toastErrorMsg.textContent = message;
  els.toastError.hidden = false;
}
function showSuccess(message) {
  els.toastError.hidden = true;
  els.toastSuccessMsg.textContent = message;
  els.toastSuccess.hidden = false;
}
function hideToasts() {
  els.toastError.hidden = true;
  els.toastSuccess.hidden = true;
}

function safeUserSummary(user) {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan,
    onboardingStatus: user.onboardingStatus,
  };
}

async function fetchMe(idToken) {
  const res = await fetch(`${BACKEND_URL}/api/users/me`, {
    method: "GET",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  if (!res.ok || !data.success || !data.user) {
    const reason = data.error || `Backend returned HTTP ${res.status}`;
    throw new Error(reason);
  }
  return data.user;
}

async function postOnboarding(idToken, payload) {
  const res = await fetch(`${BACKEND_URL}/api/onboarding/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  if (!res.ok || !data.success) {
    const reason = data.error || `Backend returned HTTP ${res.status}`;
    throw new Error(reason);
  }
  return data.user || null;
}

function setAnswer(field, value) {
  answers[field] = value;
  if (field === "technicalLevel") {
    answers.detailLevel = TECHNICAL_TO_DETAIL[value] || "balanced";
  }
}

function isSlideComplete(slide) {
  return answers[slide.field] !== null;
}

function updateTopbarSegments() {
  document.querySelectorAll("[data-step]").forEach((el) => {
    const idx = Number(el.dataset.step);
    el.classList.toggle("is-active", idx === currentSlide);
    el.classList.toggle("is-done", idx < currentSlide);
  });
}

function applySelectionWithinSlide(fieldName) {
  const value = answers[fieldName];
  els.slideBody.querySelectorAll(".opt, .plan").forEach((el) => {
    const selected = el.dataset.value === value;
    el.classList.toggle("is-selected", selected);
    el.setAttribute("aria-pressed", selected ? "true" : "false");
  });
}

function updateNavState() {
  const slide = SLIDES[currentSlide];
  els.backBtn.disabled = currentSlide === 0;
  const isLast = currentSlide === SLIDES.length - 1;
  const allAnswered = REQUIRED_FIELDS.every((f) => answers[f] !== null);
  els.nextLabel.textContent = isLast ? "Finish setup" : "Next";
  els.nextBtn.disabled = isLast ? !allAnswered : !isSlideComplete(slide);
}

function handleSelect(fieldName, value) {
  setAnswer(fieldName, value);
  applySelectionWithinSlide(fieldName);
  updateNavState();
}

function buildOption(opt, fieldName) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "opt";
  btn.dataset.value = opt.value;
  if (answers[fieldName] === opt.value) btn.classList.add("is-selected");
  const check = document.createElement("span");
  check.className = "opt-check";
  check.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = opt.label;
  btn.appendChild(check);
  btn.appendChild(label);
  btn.setAttribute("aria-pressed", btn.classList.contains("is-selected") ? "true" : "false");
  btn.addEventListener("click", () => handleSelect(fieldName, opt.value));
  return btn;
}

function buildPlan(plan, fieldName) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "plan" + (plan.pro ? " pro" : "");
  card.dataset.value = plan.value;
  if (answers[fieldName] === plan.value) card.classList.add("is-selected");
  card.setAttribute("aria-pressed", card.classList.contains("is-selected") ? "true" : "false");

  const tier = document.createElement("span");
  tier.className = "plan-tier";
  tier.textContent = plan.tier;
  card.appendChild(tier);

  const name = document.createElement("div");
  name.className = "plan-name";
  name.textContent = plan.name;
  card.appendChild(name);

  // Price row: val + period + (strikethrough orig, hidden in monthly mode)
  const priceRow = document.createElement("div");
  priceRow.className = "plan-price-row";
  const val = document.createElement("span");
  val.className = "plan-price-val";
  val.dataset.role = "price";
  val.textContent = plan.monthlyPrice;
  const per = document.createElement("span");
  per.className = "plan-price-per";
  per.textContent = plan.period;
  const orig = document.createElement("span");
  orig.className = "plan-price-orig";
  orig.dataset.role = "orig";
  priceRow.appendChild(val);
  priceRow.appendChild(per);
  priceRow.appendChild(orig);
  card.appendChild(priceRow);

  const tagline = document.createElement("p");
  tagline.className = "plan-tagline";
  tagline.textContent = plan.tagline;
  card.appendChild(tagline);

  const sep = document.createElement("div");
  sep.className = "plan-sep";
  card.appendChild(sep);

  const feats = document.createElement("ul");
  feats.className = "plan-feats";
  for (const f of plan.features) {
    const li = document.createElement("li");
    li.className = "plan-feat";
    const icon = document.createElement("span");
    icon.className = "feat-icon " + (f.ok ? "y" : "n");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = f.ok ? "✓" : "✗";
    const text = document.createElement("span");
    text.textContent = f.text;
    li.appendChild(icon);
    li.appendChild(text);
    feats.appendChild(li);
  }
  card.appendChild(feats);

  // Annual savings note (empty placeholder in monthly mode)
  const note = document.createElement("div");
  note.className = "plan-annual-note";
  note.dataset.role = "note";
  note.textContent = NB_SPACE;
  card.appendChild(note);

  card.addEventListener("click", () => handleSelect(fieldName, plan.value));
  return card;
}

function buildBillingToggle() {
  const wrap = document.createElement("div");
  wrap.className = "billing-wrap";

  const toggle = document.createElement("div");
  toggle.className = "billing-toggle";
  toggle.dataset.role = "billing-toggle";

  for (const period of ["monthly", "annual"]) {
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "billing-opt" + (period === billingPeriod ? " active" : "");
    opt.dataset.period = period;
    opt.textContent = period === "monthly" ? "Monthly" : "Annual";
    opt.addEventListener("click", () => applyBillingPeriod(period));
    toggle.appendChild(opt);
  }
  wrap.appendChild(toggle);

  const badge = document.createElement("span");
  badge.className = "save-badge" + (billingPeriod === "annual" ? " visible" : "");
  badge.dataset.role = "save-badge";
  badge.textContent = "Save 20%";
  wrap.appendChild(badge);

  return wrap;
}

function applyBillingPeriod(period) {
  if (period !== "monthly" && period !== "annual") return;
  billingPeriod = period;

  // Toggle pill state
  els.slideBody.querySelectorAll(".billing-opt").forEach((o) => {
    o.classList.toggle("active", o.dataset.period === period);
  });
  const badge = els.slideBody.querySelector('[data-role="save-badge"]');
  if (badge) badge.classList.toggle("visible", period === "annual");

  // Per-card price / strikethrough orig / annual note
  const slide = SLIDES.find((s) => s.type === "pricing");
  if (!slide) return;
  els.slideBody.querySelectorAll(".plan").forEach((card) => {
    const plan = slide.options.find((p) => p.value === card.dataset.value);
    if (!plan) return;
    const priceEl = card.querySelector('[data-role="price"]');
    const origEl = card.querySelector('[data-role="orig"]');
    const noteEl = card.querySelector('[data-role="note"]');

    if (period === "annual") {
      if (priceEl) priceEl.textContent = plan.annualPrice;
      if (origEl) {
        origEl.textContent = plan.annualOrig || "";
        origEl.classList.toggle("show", !!plan.annualOrig);
      }
      if (noteEl) noteEl.textContent = plan.annualNote || NB_SPACE;
    } else {
      if (priceEl) priceEl.textContent = plan.monthlyPrice;
      if (origEl) {
        origEl.textContent = "";
        origEl.classList.remove("show");
      }
      if (noteEl) noteEl.textContent = NB_SPACE;
    }
  });
}

function renderSlide() {
  if (submitting) return;
  hideToasts();
  const slide = SLIDES[currentSlide];

  // Apply animation direction. Clearing innerHTML and re-appending children
  // means the new content automatically picks up the directional keyframes
  // defined on `.wiz-slide.dir-next > *` / `.dir-back > *`.
  els.slideBody.classList.remove("dir-next", "dir-back");
  els.slideBody.classList.add(navDirection === "back" ? "dir-back" : "dir-next");
  els.slideBody.innerHTML = "";

  const q = document.createElement("h2");
  q.className = "q";
  q.textContent = slide.question;
  els.slideBody.appendChild(q);

  if (slide.helper) {
    const helper = document.createElement("p");
    helper.className = "q-helper";
    helper.textContent = slide.helper;
    els.slideBody.appendChild(helper);
  }

  if (slide.type === "single") {
    const opts = document.createElement("div");
    opts.className = "opts";
    for (const opt of slide.options) opts.appendChild(buildOption(opt, slide.field));
    els.slideBody.appendChild(opts);
  } else if (slide.type === "pricing") {
    els.slideBody.appendChild(buildBillingToggle());

    const grid = document.createElement("div");
    grid.className = "plans";
    for (const plan of slide.options) grid.appendChild(buildPlan(plan, slide.field));
    els.slideBody.appendChild(grid);

    // Sync the freshly built cards with the persisted billing period
    // (e.g. user picked Annual, navigated Back to slide 5, then Next).
    applyBillingPeriod(billingPeriod);
  }

  els.stepCurrent.textContent = String(currentSlide + 1).padStart(2, "0");
  els.stepTotal.textContent = String(SLIDES.length).padStart(2, "0");
  if (els.stepLabel) els.stepLabel.textContent = STEP_LABELS[currentSlide] || "";

  updateTopbarSegments();
  updateNavState();
}

async function submitOnboarding() {
  const missing = REQUIRED_FIELDS.filter((f) => !answers[f]);
  if (missing.length) {
    showError(`Please answer: ${missing.join(", ")}`);
    return;
  }
  if (!auth.currentUser) {
    showError("Session expired. Redirecting to login…");
    setTimeout(() => window.location.replace("login.html"), REDIRECT_AFTER_ERROR_MS);
    return;
  }

  submitting = true;
  const originalNext = els.nextLabel.textContent;
  els.nextBtn.disabled = true;
  els.backBtn.disabled = true;
  els.nextLabel.textContent = "Submitting…";
  hideToasts();

  try {
    const idToken = await auth.currentUser.getIdToken();
    const updatedUser = await postOnboarding(idToken, answers);
    if (updatedUser) {
      console.log("[registration] /api/onboarding/complete →", safeUserSummary(updatedUser));
    }

    showSuccess("Registration completed. Dashboard will be available soon.");
    setTimeout(async () => {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn("signOut failed:", err);
      }
      window.location.replace("login.html");
    }, POST_SUBMIT_DELAY_MS);
  } catch (err) {
    console.error("[registration] submit failed:", err);
    submitting = false;
    showError(err.message || "Could not save your answers. Please try again.");
    els.nextBtn.disabled = false;
    els.backBtn.disabled = currentSlide === 0;
    els.nextLabel.textContent = originalNext;
  }
}

els.backBtn.addEventListener("click", () => {
  if (submitting) return;
  if (currentSlide > 0) {
    navDirection = "back";
    currentSlide -= 1;
    renderSlide();
  }
});

els.nextBtn.addEventListener("click", async () => {
  if (submitting) return;
  const slide = SLIDES[currentSlide];
  if (!isSlideComplete(slide)) return;
  if (currentSlide < SLIDES.length - 1) {
    navDirection = "next";
    currentSlide += 1;
    renderSlide();
    return;
  }
  await submitOnboarding();
});

async function handleAuthState(fbUser) {
  if (!fbUser) {
    window.location.replace("login.html");
    return;
  }
  try {
    const idToken = await fbUser.getIdToken();
    const meUser = await fetchMe(idToken);
    console.log("[registration] /api/users/me →", safeUserSummary(meUser));

    if (meUser.onboardingStatus === "completed") {
      window.location.replace("login.html");
      return;
    }

    els.stepTotal.textContent = String(SLIDES.length).padStart(2, "0");
    els.loader.hidden = true;
    els.card.hidden = false;
    renderSlide();
  } catch (err) {
    console.error("[registration] could not load user record:", err);
    els.loader.hidden = true;
    els.card.hidden = false;
    showError("Could not load your account. Redirecting…");
    setTimeout(() => window.location.replace("login.html"), REDIRECT_AFTER_ERROR_MS);
  }
}

onAuthStateChanged(auth, handleAuthState);
