// ===================================================
// CF Tracker — Storage (localStorage CRUD)
// ===================================================

import {
  PROFILES_KEY,
  ACTIVE_PROFILE_KEY,
  BOOKMARKS_KEY,
  CHECKMARKS_KEY,
  PLANNER_DATE_KEY,
  PLANNER_OVERRIDE_KEY,
  skTarget,
  skUser,
  skSync,
  skTargetRawSubs,
  skUserRawSubs,
  getUserHandle,
} from './config.js';

import { CF_API_BASE } from './config.js';

// ===================================================
// Profile Management
// ===================================================

function getProfiles() {
  const raw = localStorage.getItem(PROFILES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function getActiveProfile() {
  const active = localStorage.getItem(ACTIVE_PROFILE_KEY);
  const profiles = getProfiles();
  if (active && profiles.includes(active)) return active;
  return profiles[0] || null;
}

function setActiveProfile(handle) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, handle);
}

function addProfile(handle) {
  const profiles = getProfiles();
  if (!profiles.includes(handle)) {
    profiles.push(handle);
    saveProfiles(profiles);
  }
  setActiveProfile(handle);
}

function removeProfile(handle) {
  let profiles = getProfiles().filter(p => p !== handle);
  if (profiles.length === 0) profiles = [];
  saveProfiles(profiles);
  // Clean up cached data for removed profile
  localStorage.removeItem(skTarget(handle));
  localStorage.removeItem(skUser(handle));
  localStorage.removeItem(skSync(handle));
  localStorage.removeItem(skTargetRawSubs(handle));
  localStorage.removeItem(skUserRawSubs(handle));
  if (getActiveProfile() === handle || !profiles.includes(getActiveProfile())) {
    if (profiles.length > 0) setActiveProfile(profiles[0]);
  }
  return profiles;
}

// ===================================================
// Bookmark CRUD (Global across profiles)
// ===================================================

function getBookmarks() {
  const raw = localStorage.getItem(BOOKMARKS_KEY);
  if (!raw) return new Set();
  try { return new Set(JSON.parse(raw)); } catch { return new Set(); }
}

function saveBookmarks(set) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...set]));
}

function isBookmarked(key) {
  return getBookmarks().has(key);
}

function toggleBookmark(key) {
  const bm = getBookmarks();
  if (bm.has(key)) bm.delete(key);
  else bm.add(key);
  saveBookmarks(bm);
  return bm.has(key);
}

// ===================================================
// Checkmark CRUD (Global across profiles)
// ===================================================

function getCheckmarks() {
  const raw = localStorage.getItem(CHECKMARKS_KEY);
  if (!raw) return new Set();
  try { return new Set(JSON.parse(raw)); } catch { return new Set(); }
}

function saveCheckmarks(set) {
  localStorage.setItem(CHECKMARKS_KEY, JSON.stringify([...set]));
}

function isCheckmarked(key) {
  return getCheckmarks().has(key);
}

function toggleCheckmark(key) {
  const cm = getCheckmarks();
  if (cm.has(key)) cm.delete(key);
  else cm.add(key);
  saveCheckmarks(cm);
  return cm.has(key);
}

// ===================================================
// Planner Persistence
// ===================================================

function getPlannerDate() {
  return localStorage.getItem(PLANNER_DATE_KEY) || '';
}

function savePlannerDate(v) {
  localStorage.setItem(PLANNER_DATE_KEY, v);
}

function getPlannerOverride() {
  const v = localStorage.getItem(PLANNER_OVERRIDE_KEY);
  return v ? parseInt(v, 10) : null;
}

function savePlannerOverride(v) {
  if (v != null && !isNaN(v) && v > 0) localStorage.setItem(PLANNER_OVERRIDE_KEY, String(v));
  else localStorage.removeItem(PLANNER_OVERRIDE_KEY);
}

// ===================================================
// User CF Rating Cache
// ===================================================

let cachedUserRating = null;

function getUserRating() {
  if (cachedUserRating != null) return cachedUserRating;
  const stored = localStorage.getItem('cf_tracker_user_rating');
  if (stored) {
    cachedUserRating = parseInt(stored, 10);
    return cachedUserRating;
  }
  return null;
}

async function fetchAndCacheUserRating() {
  const userHandle = getUserHandle();
  if (!userHandle) return;
  try {
    const res = await fetch(`${CF_API_BASE}/user.info?handles=${encodeURIComponent(userHandle)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.status === 'OK' && data.result && data.result.length > 0) {
      const r = data.result[0].rating;
      if (r != null) {
        cachedUserRating = r;
        localStorage.setItem('cf_tracker_user_rating', String(r));
      }
    }
  } catch (e) {
    console.warn('Could not fetch user rating:', e);
  }
}

export {
  getProfiles,
  saveProfiles,
  getActiveProfile,
  setActiveProfile,
  addProfile,
  removeProfile,
  getBookmarks,
  saveBookmarks,
  isBookmarked,
  toggleBookmark,
  getCheckmarks,
  saveCheckmarks,
  isCheckmarked,
  toggleCheckmark,
  getPlannerDate,
  savePlannerDate,
  getPlannerOverride,
  savePlannerOverride,
  getUserRating,
  fetchAndCacheUserRating,
};
