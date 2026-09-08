// ===================================================
// CF Tracker — Utility Functions
// ===================================================

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Escape HTML special characters for safe insertion.
 */
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/**
 * Get CSS class name for a CF rating value.
 */
function getRatingClass(r) {
  if (r == null) return 'rating-unrated';
  if (r < 1200) return 'rating-gray';
  if (r < 1400) return 'rating-green';
  if (r < 1600) return 'rating-cyan';
  if (r < 1900) return 'rating-blue';
  if (r < 2100) return 'rating-violet';
  if (r < 2400) return 'rating-orange';
  return 'rating-red';
}

/**
 * Format a Unix timestamp to "DD Mon YYYY".
 */
function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate().toString().padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format a Unix timestamp to "D Mon YYYY, HH:MM".
 */
function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const h = d.getHours().toString().padStart(2,'0');
  const m = d.getMinutes().toString().padStart(2,'0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${h}:${m}`;
}

/**
 * Build a Codeforces problem URL.
 */
function getProblemUrl(cid, idx) {
  return `https://codeforces.com/contest/${cid}/problem/${idx}`;
}

/**
 * Build a Codeforces submission URL.
 */
function getSubmissionUrl(contestId, subId) {
  return `https://codeforces.com/contest/${contestId}/submission/${subId}`;
}

/**
 * Get short verdict string from CF API verdict.
 */
function getVerdictShort(v) {
  if (!v) return '—';
  const m = {
    'OK': 'AC', 'WRONG_ANSWER': 'WA', 'TIME_LIMIT_EXCEEDED': 'TLE',
    'MEMORY_LIMIT_EXCEEDED': 'MLE', 'RUNTIME_ERROR': 'RE',
    'COMPILATION_ERROR': 'CE', 'IDLENESS_LIMIT_EXCEEDED': 'ILE',
    'CHALLENGED': 'HACK', 'SKIPPED': 'SKIP', 'TESTING': '...',
    'PARTIAL': 'PARTIAL', 'CRASHED': 'CRASH',
  };
  return m[v] || v.replace(/_/g, ' ').substring(0, 10);
}

/**
 * Get CSS class for verdict highlighting.
 */
function getVerdictClass(v) {
  if (v === 'OK') return 'ac';
  if (v === 'WRONG_ANSWER') return 'wa';
  if (v === 'TIME_LIMIT_EXCEEDED' || v === 'MEMORY_LIMIT_EXCEEDED') return 'tle';
  return 'other';
}

/**
 * Save a Map to localStorage as JSON.
 */
function saveMap(key, map) {
  localStorage.setItem(key, JSON.stringify([...map]));
}

/**
 * Load a Map from localStorage.
 */
function loadMap(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try { return new Map(JSON.parse(raw)); } catch { return null; }
}

export {
  sleep,
  escapeHtml,
  getRatingClass,
  formatDate,
  formatDateTime,
  getProblemUrl,
  getSubmissionUrl,
  getVerdictShort,
  getVerdictClass,
  saveMap,
  loadMap,
};
