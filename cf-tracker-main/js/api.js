// ===================================================
// CF Tracker — Codeforces API Communication
// ===================================================

import { CF_API_BASE } from './config.js';
import { sleep } from './utils.js';

/**
 * Fetch all submissions for a CF user, paginated in batches of 10,000.
 * @param {string} handle — Codeforces username
 * @param {function} onProgress — callback with status message
 * @returns {Array} — raw submission objects from CF API
 */
async function fetchAllSubmissions(handle, onProgress) {
  const BATCH = 10000;
  let from = 1, page = 1, all = [];
  while (true) {
    onProgress(`Fetching ${handle} — page ${page}...`);
    const url = `${CF_API_BASE}/user.status?handle=${encodeURIComponent(handle)}&from=${from}&count=${BATCH}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`CF API error for ${handle}: ${res.status}`);
    const data = await res.json();
    if (data.status !== 'OK') throw new Error(`CF API: ${data.comment || data.status}`);
    all = all.concat(data.result);
    if (data.result.length < BATCH) break;
    from += BATCH;
    page++;
    await sleep(600);
  }
  return all;
}

/**
 * Process raw submissions into a Map of problemKey -> problem summary.
 * Each entry tracks solve status, attempts, and timestamps.
 */
function processSubmissions(submissions) {
  const map = new Map();
  for (const sub of submissions) {
    const p = sub.problem;
    const key = `${p.contestId}-${p.index}`;
    if (!map.has(key)) {
      map.set(key, {
        contestId: p.contestId, index: p.index, name: p.name,
        rating: p.rating || null, tags: p.tags || [],
        solved: false, bestVerdict: sub.verdict,
        firstAttemptTime: sub.creationTimeSeconds,
        latestAttemptTime: sub.creationTimeSeconds,
        solvedTime: null, attempts: 1,
      });
    } else {
      const e = map.get(key);
      e.attempts++;
      if (sub.creationTimeSeconds < e.firstAttemptTime) e.firstAttemptTime = sub.creationTimeSeconds;
      if (sub.creationTimeSeconds > e.latestAttemptTime) e.latestAttemptTime = sub.creationTimeSeconds;
    }
    if (sub.verdict === 'OK') {
      const e = map.get(key);
      e.solved = true;
      e.bestVerdict = 'OK';
      if (!e.solvedTime || sub.creationTimeSeconds < e.solvedTime) e.solvedTime = sub.creationTimeSeconds;
    }
  }
  return map;
}

/**
 * Build a map of problemKey -> array of submission details (most recent first, limited to 10).
 */
function buildRawSubsMap(submissions) {
  const map = new Map();
  for (const sub of submissions) {
    const p = sub.problem;
    const key = `${p.contestId}-${p.index}`;
    if (!map.has(key)) map.set(key, []);
    const arr = map.get(key);
    // Keep at most 10 submissions per problem to limit storage
    if (arr.length < 10) {
      arr.push({
        id: sub.id,
        contestId: p.contestId,
        verdict: sub.verdict,
        language: sub.programmingLanguage || '—',
        timeConsumed: sub.timeConsumedMillis,
        memoryConsumed: sub.memoryConsumedBytes,
        creationTimeSeconds: sub.creationTimeSeconds,
      });
    }
  }
  // Sort each array by creation time descending (most recent first)
  for (const [, arr] of map) {
    arr.sort((a, b) => b.creationTimeSeconds - a.creationTimeSeconds);
  }
  return map;
}

export {
  fetchAllSubmissions,
  processSubmissions,
  buildRawSubsMap,
};
