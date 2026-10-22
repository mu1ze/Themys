const TOTAL_STEPS = 4;
let currentStep = 0;
const policy = globalThis.ThemysCapturePolicy;
if (!policy) throw new Error("ThemysCapturePolicy must load before onboarding.js");

let onboardingState = { complete: false, step: 0 };

// Elements
const steps = Array.from(document.querySelectorAll('.step'));
const dots  = Array.from(document.querySelectorAll('.dot'));
const btnBack    = document.getElementById('btn-back');
const btnSkipAll = document.getElementById('btn-skip-all');
const navBar     = document.getElementById('nav-bar');

// --- Storage helpers ---

async function getState() {
  const result = await chrome.storage.local.get('themys-onboarding');
  return result['themys-onboarding'] || { complete: false, step: 0 };
}

async function saveState(state) {
  onboardingState = state;
  await chrome.storage.local.set({ 'themys-onboarding': state });
}

async function markComplete() {
  await saveState(policy.completeOnboarding(TOTAL_STEPS));
}

// --- Navigation ---

function showStep(index) {
  currentStep = index;
  steps.forEach((s, i) => s.classList.toggle('active', i === index));
  dots.forEach((d, i) => {
    d.classList.toggle('active', i === index);
    d.classList.toggle('done', i < index);
  });

  // Back button visibility
  btnBack.style.visibility = index > 0 ? 'visible' : 'hidden';

  // Hide skip on last step
  btnSkipAll.style.display = index === TOTAL_STEPS - 1 ? 'none' : '';

  // Hide nav bar entirely on last step
  navBar.style.display = index === TOTAL_STEPS - 1 ? 'none' : '';

  saveState(policy.persistOnboardingStep(onboardingState, index));
}

function goNext() {
  if (currentStep < TOTAL_STEPS - 1) showStep(currentStep + 1);
}

function goBack() {
  if (currentStep > 0) showStep(currentStep - 1);
}

// --- Auth handling ---

function waitForAuth() {
  document.getElementById('auth-waiting').style.display = 'block';
  document.getElementById('btn-signin').style.display = 'none';
  document.getElementById('btn-skip-signin').style.display = 'none';
}

// Listen for auth success from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'AUTH_SUCCESS') {
    markComplete().then(() => {
      showStep(TOTAL_STEPS - 1);
    });
  }
});

// --- Init ---

async function init() {
  const state = await getState();
  onboardingState = state;

  if (state.complete) {
    window.close();
    return;
  }

  // Check if already authenticated
  const authResponse = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, resolve);
  });

  let startStep = state.step || 0;

  // If already signed in, skip the sign-in step
  if (authResponse && authResponse.authenticated && startStep <= 1) {
    await markComplete();
    startStep = TOTAL_STEPS - 1;
  }

  showStep(startStep);
}

// Step 0 → Next
document.getElementById('btn-next-0').addEventListener('click', goNext);

// Step 1 → Sign In
document.getElementById('btn-signin').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_AUTH' });
  waitForAuth();
});

// Step 1 → Skip
document.getElementById('btn-skip-signin').addEventListener('click', goNext);

// Step 2 → Next
document.getElementById('btn-next-2').addEventListener('click', goNext);

// Step 3 → Done
document.getElementById('btn-done').addEventListener('click', async () => {
  await markComplete();
  window.close();
});

// Nav buttons
btnBack.addEventListener('click', goBack);

btnSkipAll.addEventListener('click', async () => {
  await markComplete();
  window.close();
});

init();
