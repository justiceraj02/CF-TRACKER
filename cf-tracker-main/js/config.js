// ===================================================
// CF Tracker — Configuration & Constants
// ===================================================

const CF_API_BASE = 'https://codeforces.com/api';
const PAGE_SIZE_TABLE = 50;

// --- localStorage Keys ---
const USER_HANDLE_KEY = 'cf_tracker_user_handle';
const PROFILES_KEY = 'cf_tracker_profiles';
const ACTIVE_PROFILE_KEY = 'cf_tracker_active_profile';
const BOOKMARKS_KEY = 'cf_tracker_bookmarks';
const CHECKMARKS_KEY = 'cf_tracker_checkmarked';
const PLANNER_DATE_KEY = 'cf_tracker_planner_date';
const PLANNER_OVERRIDE_KEY = 'cf_tracker_planner_override';
const SETUP_DONE_KEY = 'cf_tracker_setup_done';
const EXPIRY_KEY = 'cf_tracker_expiry';

// --- Per-profile storage key generators ---
function skTarget(handle) { return `cf_tracker_target_${handle}`; }
function skUser(handle) { return `cf_tracker_user_${handle}`; }
function skSync(handle) { return `cf_tracker_sync_${handle}`; }
function skTargetRawSubs(handle) { return `cf_tracker_target_rawsubs_${handle}`; }
function skUserRawSubs(handle) { return `cf_tracker_user_rawsubs_${handle}`; }

// --- Dynamic user handle (no hardcoded defaults) ---
function getUserHandle() {
  return localStorage.getItem(USER_HANDLE_KEY) || '';
}

function setUserHandle(handle) {
  localStorage.setItem(USER_HANDLE_KEY, handle);
}

function isSetupDone() {
  if (localStorage.getItem(SETUP_DONE_KEY) !== 'true' || getUserHandle() === '') return false;
  
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (expiry && expiry !== 'session') {
    const expiryTime = parseInt(expiry, 10);
    if (!isNaN(expiryTime) && Date.now() > expiryTime) {
      // Session has expired
      localStorage.removeItem(SETUP_DONE_KEY);
      localStorage.removeItem(EXPIRY_KEY);
      return false;
    }
  } else if (!expiry) {
     return false;
  }
  // For 'session' expiry (which isn't strictly auto-expiring in localStorage without sessionStorage),
  // we could use sessionStorage for a true session clear. For now, checking 'session' in sessionStorage.
  if (expiry === 'session' && !sessionStorage.getItem('cf_tracker_active_session')) {
      localStorage.removeItem(SETUP_DONE_KEY);
      localStorage.removeItem(EXPIRY_KEY);
      return false;
  }
  
  return true;
}

function markSetupDone(rememberForMonth = false) {
  localStorage.setItem(SETUP_DONE_KEY, 'true');
  if (rememberForMonth) {
    // 30 days in milliseconds
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem(EXPIRY_KEY, String(expiry));
  } else {
    // Session tracking marker
    localStorage.setItem(EXPIRY_KEY, 'session');
    sessionStorage.setItem('cf_tracker_active_session', 'true');
  }
}


export {
  CF_API_BASE,
  PAGE_SIZE_TABLE,
  USER_HANDLE_KEY,
  PROFILES_KEY,
  ACTIVE_PROFILE_KEY,
  BOOKMARKS_KEY,
  CHECKMARKS_KEY,
  PLANNER_DATE_KEY,
  PLANNER_OVERRIDE_KEY,
  SETUP_DONE_KEY,
  skTarget,
  skUser,
  skSync,
  skTargetRawSubs,
  skUserRawSubs,
  getUserHandle,
  setUserHandle,
  isSetupDone,
  markSetupDone,
};
