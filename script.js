const API_BASE = 'https://api.z88.tech';

const form            = document.getElementById('generate-form');
const handleInput     = document.getElementById('handle');
const handleHint      = document.getElementById('handle-hint');
const submitBtn       = document.getElementById('submit-btn');
const socialList      = document.getElementById('social-list');
const addSocialBtn    = document.getElementById('add-social');

const progressPanel   = document.getElementById('progress-panel');
const progressHandle  = document.getElementById('progress-handle');
const progressSteps   = document.getElementById('progress-steps');
const successPanel    = document.getElementById('success-panel');
const resultUrl       = document.getElementById('result-url');
const visitSiteBtn    = document.getElementById('visit-site-btn');
const generateAnotherBtn = document.getElementById('generate-another-btn');
const errorPanel      = document.getElementById('error-panel');
const errorMessage    = document.getElementById('error-message');
const retryBtn        = document.getElementById('retry-btn');

const HANDLE_RE = /^[a-z0-9-]+$/;
let pollTimer = null;

// ─── Handle live validation ────────────────────────────────────────────────
handleInput.addEventListener('input', () => {
  const raw = handleInput.value;
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (raw !== cleaned) handleInput.value = cleaned;
  const valid = cleaned.length > 0 && HANDLE_RE.test(cleaned);
  handleInput.classList.toggle('invalid', cleaned.length > 0 && !valid);
});

// ─── File drop zones (click-to-upload with filename display) ─────────────
document.querySelectorAll('.file-drop').forEach((zone) => {
  const inputId = zone.dataset.for;
  const input = document.getElementById(inputId);
  const nameLabel = document.getElementById(`${inputId}-name`);

  zone.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    if (input.files.length === 0) {
      nameLabel.textContent = '';
    } else if (input.files.length === 1) {
      nameLabel.textContent = input.files[0].name;
    } else {
      nameLabel.textContent = `${input.files.length} files selected`;
    }
  });

  ['dragover', 'dragleave', 'drop'].forEach((evt) => {
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.toggle('dragover', evt === 'dragover');
      if (evt === 'drop' && e.dataTransfer.files.length) {
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event('change'));
      }
    });
  });
});

// ─── Dynamic social link rows ──────────────────────────────────────────────
function wrapFirstSocialRow() {
  const first = socialList.querySelector('.social-input');
  if (first && !first.closest('.social-input-row')) {
    const row = document.createElement('div');
    row.className = 'social-input-row';
    first.parentNode.insertBefore(row, first);
    row.appendChild(first);
  }
}
wrapFirstSocialRow();

addSocialBtn.addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'social-input-row';
  row.innerHTML = `
    <input type="url" class="social-input" placeholder="https://youtube.com/@yourname" />
    <button type="button" class="remove-social" aria-label="Remove">&times;</button>
  `;
  socialList.appendChild(row);
  row.querySelector('.remove-social').addEventListener('click', () => row.remove());
});

function collectSocialUrls() {
  return Array.from(document.querySelectorAll('.social-input'))
    .map((i) => i.value.trim())
    .filter(Boolean);
}

// ─── Panel switching ────────────────────────────────────────────────────────
function showPanel(panel) {
  [progressPanel, successPanel, errorPanel].forEach((p) => (p.hidden = true));
  if (panel) panel.hidden = false;
}

function resetForm() {
  form.reset();
  document.querySelectorAll('.file-drop-name').forEach((el) => (el.textContent = ''));
  const rows = socialList.querySelectorAll('.social-input-row');
  rows.forEach((row, i) => { if (i > 0) row.remove(); });
  showPanel(null);
  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

generateAnotherBtn.addEventListener('click', resetForm);
retryBtn.addEventListener('click', () => {
  showPanel(null);
  form.hidden = false;
});

// ─── Progress step rendering ────────────────────────────────────────────────
const STEP_ORDER = ['enrich', 'github', 'build', 'netlify', 'dns'];

function updateProgressSteps(steps, failedStep) {
  STEP_ORDER.forEach((stepName) => {
    const li = progressSteps.querySelector(`[data-step="${stepName}"]`);
    if (!li) return;
    li.classList.remove('active', 'done', 'error');
    const state = steps ? steps[stepName] : 'pending';
    if (stepName === failedStep) li.classList.add('error');
    else if (state === 'done') li.classList.add('done');
    else if (state === 'in_progress') li.classList.add('active');
  });
}

// ─── Polling ─────────────────────────────────────────────────────────────────
function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function pollStatus(jobId) {
  try {
    const res = await fetch(`${API_BASE}/v1/sites/status/${jobId}`);
    const data = await res.json();

    if (!res.ok) {
      stopPolling();
      showError(data.error || 'Lost track of your job. Please try again.');
      return;
    }

    updateProgressSteps(data.steps, data.status === 'failed' ? data.step : null);

    if (data.status === 'complete') {
      stopPolling();
      showSuccess(data.result);
    } else if (data.status === 'failed') {
      stopPolling();
      showError(data.error || 'Site generation failed. Please try again.');
    }
  } catch (err) {
    stopPolling();
    showError('Lost connection while checking progress. Please try again.');
  }
}

function showSuccess(result) {
  showPanel(successPanel);
  resultUrl.textContent = result.siteUrl.replace(/^https?:\/\//, '');
  resultUrl.href = result.siteUrl;
  visitSiteBtn.href = result.siteUrl;
}

function showError(message) {
  errorMessage.textContent = message;
  showPanel(errorPanel);
}

// ─── Form submit ─────────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const handle = handleInput.value.trim();
  const name = document.getElementById('name').value.trim();

  if (!handle || !HANDLE_RE.test(handle)) {
    handleInput.classList.add('invalid');
    handleInput.focus();
    return;
  }
  if (!name) {
    document.getElementById('name').focus();
    return;
  }

  const fd = new FormData();
  fd.append('handle', handle);
  fd.append('name', name);

  const email = document.getElementById('email').value.trim();
  if (email) fd.append('email', email);

  const tagline = document.getElementById('customTagline').value.trim();
  if (tagline) fd.append('customTagline', tagline);

  const bio = document.getElementById('customBio').value.trim();
  if (bio) fd.append('customBio', bio);

  const resumeFile = document.getElementById('resumeFile').files[0];
  if (resumeFile) fd.append('resumeFile', resumeFile);

  const images = document.getElementById('images').files;
  Array.from(images).slice(0, 10).forEach((img) => fd.append('images', img));

  const socialUrls = collectSocialUrls();
  if (socialUrls.length) fd.append('socialUrls', JSON.stringify(socialUrls));

  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').textContent = 'Starting…';

  try {
    const res = await fetch(`${API_BASE}/v1/sites/generate`, { method: 'POST', body: fd });
    const data = await res.json();

    if (res.status === 429) {
      showError(data.error || 'Too many requests right now — please try again in a bit.');
      return;
    }
    if (!res.ok) {
      const detail = Array.isArray(data.errors)
        ? data.errors.map((er) => er.msg).join(', ')
        : (data.error || 'Something went wrong starting generation.');
      showError(detail);
      return;
    }

    form.hidden = true;
    progressHandle.textContent = data.handle;
    updateProgressSteps(null, null);
    showPanel(progressPanel);

    pollStatus(data.jobId);
    pollTimer = setInterval(() => pollStatus(data.jobId), 4000);
  } catch (err) {
    showError('Could not reach the server. Please check your connection and try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = 'Generate my site';
  }
});
