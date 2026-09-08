// ===================================================
// CF Tracker — Main Application (Entry Point)
// ===================================================

import {
  PAGE_SIZE_TABLE,
  skTarget, skUser, skSync, skTargetRawSubs, skUserRawSubs,
  getUserHandle, setUserHandle, isSetupDone, markSetupDone,
} from './config.js';

import {
  escapeHtml, getRatingClass, formatDate, formatDateTime,
  getProblemUrl, getSubmissionUrl, getVerdictShort, getVerdictClass,
  saveMap, loadMap,
} from './utils.js';

import {
  getProfiles, getActiveProfile, setActiveProfile,
  addProfile, removeProfile,
  getBookmarks, toggleBookmark,
  getCheckmarks, toggleCheckmark,
  getPlannerDate, savePlannerDate,
  getPlannerOverride, savePlannerOverride,
  fetchAndCacheUserRating,
} from './storage.js';

import {
  fetchAllSubmissions, processSubmissions, buildRawSubsMap,
} from './api.js';

import {
  buildCombinedList, sortList, filterList, collectAllTags,
  getRatingBucketColor, getRatingBucketCssClass,
  computePlannerData, generateSuggestions,
} from './data.js';

// ===================================================
// App State
// ===================================================

let combinedList = [];
let filteredSorted = [];
let allTags = [];
let currentPage = 1;
let activeTargetHandle = null;
let currentViewMode = 'all';
let expandedRows = new Set();
let targetRawSubsMap = new Map();
let userRawSubsMap = new Map();

// ===================================================
// Setup Modal (First-Time Configuration)
// ===================================================

function showSetupModal() {
  const overlay = document.createElement('div');
  overlay.className = 'setup-modal-overlay';
  overlay.id = 'setupModalOverlay';
  overlay.innerHTML = `
    <div class="setup-modal">
      <span class="setup-icon">⚡</span>
      <h2>Welcome to CF Tracker</h2>
      <p>Enter your Codeforces username and the handle of the user you want to track.</p>
      <div class="setup-field">
        <label>Your CF Handle</label>
        <input type="text" id="setupUserHandle" placeholder="e.g. tourist" autocomplete="off" />
      </div>
      <div class="setup-field">
        <label>Target Handle (to track)</label>
        <input type="text" id="setupTargetHandle" placeholder="e.g. jiangly" autocomplete="off" />
      </div>
      <div class="setup-field" style="flex-direction:row; align-items:center; gap:10px; margin-top:5px; margin-bottom:15px;">
        <input type="checkbox" id="setupRememberMe" checked />
        <label for="setupRememberMe" style="text-transform:none; font-size:0.85rem; color:var(--text-secondary); cursor:pointer;">Remember me for 1 month</label>
      </div>
      <div class="setup-error" id="setupError"></div>
      <button class="btn-setup-start" id="btnSetupStart">🚀 Start Tracking</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const btnStart = document.getElementById('btnSetupStart');
  const errorEl = document.getElementById('setupError');

  btnStart.addEventListener('click', () => {
    const userHandle = document.getElementById('setupUserHandle').value.trim();
    const targetHandle = document.getElementById('setupTargetHandle').value.trim();
    const rememberMe = document.getElementById('setupRememberMe').checked;

    if (!userHandle) {
      errorEl.textContent = '❌ Please enter your Codeforces handle.';
      return;
    }
    if (!targetHandle) {
      errorEl.textContent = '❌ Please enter a target handle to track.';
      return;
    }
    if (userHandle.toLowerCase() === targetHandle.toLowerCase()) {
      errorEl.textContent = '⚠️ Your handle and target handle should be different.';
      return;
    }

    // Save configuration
    setUserHandle(userHandle);
    addProfile(targetHandle);
    markSetupDone(rememberMe);

    // Remove modal and boot the app
    overlay.remove();
    bootApp();
  });

  // Enter key on inputs
  ['setupUserHandle', 'setupTargetHandle'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnStart.click();
    });
  });

  // Focus first input
  setTimeout(() => document.getElementById('setupUserHandle').focus(), 100);
}

// ===================================================
// Rendering — Stats
// ===================================================

function renderStats(list) {
  const total = list.length;
  const solved = list.filter(p => p.yourStatus === 'solved').length;
  const attempted = list.filter(p => p.yourStatus === 'attempted').length;
  const remaining = list.filter(p => p.yourStatus === 'not-attempted').length;
  const targetFailed = list.filter(p => !p.targetSolved).length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statSolved').textContent = solved;
  document.getElementById('statAttempted').textContent = attempted;
  document.getElementById('statRemaining').textContent = remaining;
  document.getElementById('statTargetFailed').textContent = targetFailed;

  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
  document.getElementById('progressBar').style.setProperty('--progress', `${pct}%`);
  document.getElementById('progressText').textContent = `${pct}%`;
}

// ===================================================
// Rendering — Submission Details
// ===================================================

function renderSubmissionDetails(key) {
  const USER_HANDLE = getUserHandle();
  const targetSubs = targetRawSubsMap.get(key) || [];
  const userSubs = userRawSubsMap.get(key) || [];

  function renderSubList(subs) {
    if (subs.length === 0) {
      return `<div class="sub-empty">No submissions found</div>`;
    }
    return `<div class="sub-list">${subs.slice(0, 5).map(s => {
      const verdictShort = getVerdictShort(s.verdict);
      const verdictClass = getVerdictClass(s.verdict);
      const time = s.timeConsumed != null ? `${s.timeConsumed}ms` : '—';
      const mem = s.memoryConsumed != null ? `${Math.round(s.memoryConsumed / 1024)}KB` : '—';
      const date = formatDateTime(s.creationTimeSeconds);
      const subUrl = getSubmissionUrl(s.contestId, s.id);
      return `<div class="sub-entry">
        <span class="sub-verdict ${verdictClass}">${verdictShort}</span>
        <span class="sub-meta">
          <span>${escapeHtml(s.language)}</span>
          <span>⏱${time}</span>
          <span>💾${mem}</span>
          <span>${date}</span>
        </span>
        <a href="${subUrl}" target="_blank" class="sub-link">View →</a>
      </div>`;
    }).join('')}</div>`;
  }

  return `<div class="sub-details">
    <div class="sub-card target-card">
      <div class="sub-card-title">🎯 Target (${escapeHtml(activeTargetHandle || '—')})</div>
      ${renderSubList(targetSubs)}
    </div>
    <div class="sub-card user-card">
      <div class="sub-card-title">👤 You (${escapeHtml(USER_HANDLE)})</div>
      ${renderSubList(userSubs)}
    </div>
  </div>`;
}

// ===================================================
// Rendering — Problem Table
// ===================================================

function renderTable(list, page) {
  const tbody = document.getElementById('problemTableBody');
  const emptyState = document.getElementById('emptyState');
  const tableContainer = document.getElementById('tableContainer');
  const resultsCount = document.getElementById('resultsCount');

  if (list.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'flex';
    tableContainer.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  tableContainer.style.display = 'block';

  const totalPages = Math.ceil(list.length / PAGE_SIZE_TABLE);
  if (page > totalPages) page = totalPages;
  if (page < 1) page = 1;
  currentPage = page;

  const start = (page - 1) * PAGE_SIZE_TABLE;
  const end = Math.min(start + PAGE_SIZE_TABLE, list.length);
  const pageItems = list.slice(start, end);

  resultsCount.textContent = `Showing ${start + 1}–${end} of ${list.length} problems`;

  const bookmarks = getBookmarks();
  const checkmarks = getCheckmarks();

  const rows = pageItems.map((item, idx) => {
    const globalIdx = start + idx + 1;
    const rc = getRatingClass(item.rating);
    const rt = item.rating != null ? item.rating : '?';
    const url = getProblemUrl(item.contestId, item.index);
    const date = formatDate(item.targetFirstAttempt);

    const tBadge = item.targetSolved
      ? '<span class="status-badge status-target-solved">✅ AC</span>'
      : '<span class="status-badge status-target-failed">❌ Fail</span>';

    let yBadge;
    if (item.yourStatus === 'solved') yBadge = '<span class="status-badge status-solved">✅ AC</span>';
    else if (item.yourStatus === 'attempted') yBadge = '<span class="status-badge status-attempted">⚠️ WA</span>';
    else yBadge = '<span class="status-badge status-not-attempted">❌ —</span>';

    const tags = item.tags.length > 0
      ? item.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')
      : '<span class="tag">—</span>';

    const delay = Math.min(idx, 30) * 15;

    const bmActive = bookmarks.has(item.key) ? 'active' : '';
    const bmIcon = bookmarks.has(item.key) ? '★' : '☆';
    const cmActive = checkmarks.has(item.key) ? 'active' : '';
    const cmIcon = checkmarks.has(item.key) ? '☑' : '☐';
    const isExpanded = expandedRows.has(item.key);
    const expandedClass = isExpanded ? 'expanded' : '';

    let html = `<tr class="problem-row" style="--row-delay:${delay}ms" data-key="${escapeHtml(item.key)}">
      <td class="col-check"><button class="check-btn ${cmActive}" data-check-key="${escapeHtml(item.key)}" title="Checkmark this problem">${cmIcon}</button></td>
      <td class="col-bookmark"><button class="bookmark-btn ${bmActive}" data-bm-key="${escapeHtml(item.key)}" title="Bookmark this problem">${bmIcon}</button></td>
      <td class="idx-cell">${globalIdx}</td>
      <td><a href="${url}" target="_blank" class="problem-name">${escapeHtml(item.name)}</a><div class="problem-contest">${item.contestId}${item.index}</div></td>
      <td style="text-align:center"><span class="rating-badge ${rc}">${rt}</span></td>
      <td class="col-tags"><div class="tags-cell">${tags}</div></td>
      <td style="text-align:center">${tBadge}</td>
      <td style="text-align:center">${yBadge}</td>
      <td style="text-align:center"><button class="subs-btn ${expandedClass}" data-subs-key="${escapeHtml(item.key)}">📄 View</button></td>
      <td class="date-cell col-date">${date}</td>
    </tr>`;

    html += `<tr class="expand-row ${isExpanded ? 'open' : ''}" data-expand-key="${escapeHtml(item.key)}">
      <td colspan="10">
        <div class="sub-details-wrapper">
          ${isExpanded ? renderSubmissionDetails(item.key) : ''}
        </div>
      </td>
    </tr>`;

    return html;
  }).join('');

  tbody.innerHTML = rows;
  renderPagination(list.length, page, totalPages);
}

// ===================================================
// Rendering — Pagination
// ===================================================

function renderPagination(total, current, totalPages) {
  const container = document.getElementById('pagination');
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button onclick="window.__cfGoToPage(${current - 1})" ${current === 1 ? 'disabled' : ''}>← Prev</button>`;

  const pages = [];
  pages.push(1);
  for (let i = Math.max(2, current - 2); i <= Math.min(totalPages - 1, current + 2); i++) pages.push(i);
  if (totalPages > 1) pages.push(totalPages);
  const uniquePages = [...new Set(pages)].sort((a,b) => a - b);

  let lastPage = 0;
  for (const p of uniquePages) {
    if (p - lastPage > 1) html += '<span class="page-info">…</span>';
    html += `<button onclick="window.__cfGoToPage(${p})" class="${p === current ? 'active' : ''}">${p}</button>`;
    lastPage = p;
  }

  html += `<button onclick="window.__cfGoToPage(${current + 1})" ${current === totalPages ? 'disabled' : ''}>Next →</button>`;
  container.innerHTML = html;
}

// Global page navigation
window.__cfGoToPage = function(page) {
  renderTable(filteredSorted, page);
  document.getElementById('tableContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ===================================================
// Rendering — Tags Filter Dropdown
// ===================================================

function renderTagsFilter(tags) {
  const sel = document.getElementById('filterTags');
  sel.innerHTML = '<option value="all">All Tags</option>';
  for (const t of tags) {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    sel.appendChild(o);
  }
}

// ===================================================
// Rendering — Profile Tabs
// ===================================================

function renderProfileTabs() {
  const bar = document.getElementById('profileBar');
  const profiles = getProfiles();
  const active = getActiveProfile();
  const USER_HANDLE = getUserHandle();

  bar.innerHTML = profiles.map(handle => {
    const isActive = handle === active;
    const canDelete = profiles.length > 1;
    return `<div class="profile-tab ${isActive ? 'active' : ''}" data-handle="${escapeHtml(handle)}">
      <span class="tab-handle">👤 ${escapeHtml(handle)}</span>
      ${canDelete ? `<span class="tab-close" data-close="${escapeHtml(handle)}" title="Remove profile">✕</span>` : ''}
    </div>`;
  }).join('');

  // Update footer
  const footerP = document.querySelector('.app-footer p');
  if (footerP) {
    footerP.innerHTML = `Tracking <strong>${escapeHtml(active || '—')}</strong> → <strong>${escapeHtml(USER_HANDLE)}</strong> · Data from <a href="https://codeforces.com" target="_blank">Codeforces API</a>`;
  }
}

// ===================================================
// View Mode Tab Counts
// ===================================================

function updateViewModeCounts() {
  const checkmarks = getCheckmarks();
  const bookmarks = getBookmarks();
  
  const allCount = combinedList.filter(p => !checkmarks.has(p.key)).length;
  const bmCount = combinedList.filter(p => bookmarks.has(p.key) && !checkmarks.has(p.key)).length;
  const cmCount = combinedList.filter(p => checkmarks.has(p.key)).length;

  document.getElementById('viewCountAll').textContent = allCount;
  document.getElementById('viewCountBookmarked').textContent = bmCount;
  document.getElementById('viewCountCheckmarked').textContent = cmCount;
}

// ===================================================
// UI Helpers
// ===================================================

function setLoading(active, msg) {
  const overlay = document.getElementById('loadingOverlay');
  document.getElementById('loadingText').textContent = msg || 'Fetching submissions...';
  overlay.classList.toggle('active', active);
}

function setSyncing(active) {
  const btn = document.getElementById('btnSync');
  btn.classList.toggle('syncing', active);
  btn.disabled = active;
}

function updateLastSync(ts) {
  const el = document.getElementById('lastSync');
  if (!ts) { el.textContent = 'Never synced'; return; }
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2,'0');
  const m = d.getMinutes().toString().padStart(2,'0');
  const day = d.getDate().toString().padStart(2,'0');
  const mon = d.toLocaleString('en', { month: 'short' });
  el.textContent = `Synced: ${day} ${mon}, ${h}:${m}`;
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast ' + type;
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

function parseNum(id) {
  const v = document.getElementById(id).value.trim();
  if (v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

// ===================================================
// View Mode Tabs
// ===================================================

function setViewMode(mode) {
  currentViewMode = mode;
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === mode);
  });
  expandedRows.clear();
  applyFiltersAndSort();
}

// ===================================================
// Add Profile Popover
// ===================================================

function toggleAddPopover(show) {
  const popover = document.getElementById('addProfilePopover');
  const input = document.getElementById('newProfileInput');
  if (show) {
    popover.classList.add('visible');
    input.value = '';
    setTimeout(() => input.focus(), 50);
  } else {
    popover.classList.remove('visible');
  }
}

function handleAddProfile() {
  const input = document.getElementById('newProfileInput');
  const handle = input.value.trim();
  if (!handle) {
    showToast('❌ Please enter a username', 'error');
    return;
  }
  if (getProfiles().includes(handle)) {
    showToast('⚠️ Profile already exists, switching to it', 'success');
    toggleAddPopover(false);
    loadProfileData(handle);
    return;
  }
  addProfile(handle);
  toggleAddPopover(false);
  showToast(`👤 Added ${handle}`, 'success');
  loadProfileData(handle);
}

// ===================================================
// Submission Row Toggle
// ===================================================

function toggleSubmissionRow(key) {
  if (expandedRows.has(key)) {
    expandedRows.delete(key);
  } else {
    expandedRows.add(key);
  }
  renderTable(filteredSorted, currentPage);
}

// ===================================================
// Daily Target Planner — Rendering
// ===================================================

function renderPlanner() {
  const section = document.getElementById('plannerSection');
  if (combinedList.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  const data = computePlannerData(combinedList);
  const { totalRemaining, bucketMap, bucketOrder, daysLeft, dailyTarget, usingOverride, bucketTargets } = data;

  // Summary
  const summaryEl = document.getElementById('plannerSummary');
  if (daysLeft > 0 || dailyTarget > 0) {
    summaryEl.innerHTML = `
      <span class="planner-stat"><strong>${daysLeft}</strong> days left</span>
      <span class="planner-stat"><strong>${totalRemaining}</strong> total remaining</span>
    `;
  } else {
    summaryEl.innerHTML = `<span class="planner-stat">Set a target date or daily count to start planning</span>`;
  }

  // Buckets
  const bucketsEl = document.getElementById('plannerBuckets');
  let bucketsHtml = '';
  for (const key of bucketOrder) {
    const problems = bucketMap.get(key) || [];
    if (problems.length === 0) continue;
    const color = getRatingBucketColor(key);
    const cssClass = getRatingBucketCssClass(key);
    const target = bucketTargets.get(key) || 0;
    const label = key === '<1200' ? '800' : key;

    bucketsHtml += `
      <div class="planner-bucket" data-color="${color}">
        <span class="bucket-rating ${cssClass}">${escapeHtml(label)}</span>
        <div class="bucket-info">
          <span class="bucket-left">${problems.length} left</span>
          <span class="bucket-arrow">→</span>
          <span class="bucket-solve ${target > 0 ? 'has-target' : 'no-target'}">Solve: <strong>${target}</strong></span>
        </div>
      </div>`;
  }
  bucketsEl.innerHTML = bucketsHtml;

  document.getElementById('plannerTodayTarget').textContent = dailyTarget;
}

function renderSuggestions() {
  const cardsEl = document.getElementById('suggestionCards');
  const suggestions = generateSuggestions(combinedList);

  if (suggestions.length === 0) {
    cardsEl.innerHTML = '<div class="suggestions-empty">🎉 Set a target date or daily count to see suggestions!</div>';
    return;
  }

  suggestions.sort((a, b) => (a.rating || 0) - (b.rating || 0));

  cardsEl.innerHTML = suggestions.map(p => {
    const rc = getRatingClass(p.rating);
    const rt = p.rating != null ? p.rating : '?';
    const url = getProblemUrl(p.contestId, p.index);
    const tagsHtml = p.tags.slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    return `<a href="${url}" target="_blank" class="suggestion-card">
      <span class="sg-rating ${rc}">${rt}</span>
      <div class="sg-info">
        <span class="sg-name">${escapeHtml(p.name)}</span>
        <span class="sg-contest">${p.contestId}${p.index}</span>
        ${tagsHtml ? `<div class="sg-tags">${tagsHtml}</div>` : ''}
      </div>
      <span class="sg-arrow">→</span>
    </a>`;
  }).join('');
}

function toggleSuggestionsPanel() {
  const panel = document.getElementById('suggestionsPanel');
  const btn = document.getElementById('btnShowSuggestions');
  const isOpen = panel.classList.contains('open');
  if (!isOpen) {
    renderSuggestions();
    panel.classList.add('open');
    btn.innerHTML = '<span>🔽</span> Hide Today\'s Problems';
  } else {
    panel.classList.remove('open');
    btn.innerHTML = '<span>💡</span> Show Today\'s Problems';
  }
}

function onPlannerChange() {
  const dateInput = document.getElementById('plannerTargetDate');
  const overrideInput = document.getElementById('plannerDailyOverride');
  savePlannerDate(dateInput.value);
  const ov = parseInt(overrideInput.value, 10);
  savePlannerOverride(!isNaN(ov) && ov > 0 ? ov : null);
  renderPlanner();
  if (document.getElementById('suggestionsPanel').classList.contains('open')) {
    renderSuggestions();
  }
}

function initPlanner() {
  const dateInput = document.getElementById('plannerTargetDate');
  const overrideInput = document.getElementById('plannerDailyOverride');

  const savedDate = getPlannerDate();
  if (savedDate) dateInput.value = savedDate;
  const savedOverride = getPlannerOverride();
  if (savedOverride) overrideInput.value = savedOverride;

  if (!savedDate && !savedOverride) {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    dateInput.value = d.toISOString().split('T')[0];
    savePlannerDate(dateInput.value);
  }

  dateInput.addEventListener('change', onPlannerChange);
  overrideInput.addEventListener('input', onPlannerChange);
  document.getElementById('btnShowSuggestions').addEventListener('click', toggleSuggestionsPanel);

  renderPlanner();
}

// ===================================================
// Core Logic
// ===================================================

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterStatus').value = 'all';
  document.getElementById('filterTargetStatus').value = 'all';
  document.getElementById('filterRatingMin').value = '';
  document.getElementById('filterRatingMax').value = '';
  document.getElementById('filterTags').value = 'all';
  document.getElementById('sortSelect').value = 'date-desc';
}

function applyFiltersAndSort() {
  const filters = {
    search: document.getElementById('searchInput').value.trim(),
    yourStatus: document.getElementById('filterStatus').value,
    targetStatus: document.getElementById('filterTargetStatus').value,
    ratingMin: parseNum('filterRatingMin'),
    ratingMax: parseNum('filterRatingMax'),
    tag: document.getElementById('filterTags').value,
  };
  const sortBy = document.getElementById('sortSelect').value;
  filteredSorted = sortList(filterList(combinedList, filters, currentViewMode), sortBy);
  currentPage = 1;
  renderTable(filteredSorted, 1);
  updateViewModeCounts();
}

async function syncData() {
  const USER_HANDLE = getUserHandle();
  const targetHandle = activeTargetHandle;
  if (!targetHandle || !USER_HANDLE) return;

  setSyncing(true);
  setLoading(true, `Fetching ${targetHandle}'s submissions...`);

  try {
    const targetSubs = await fetchAllSubmissions(targetHandle, msg => setLoading(true, msg));
    const targetMap = processSubmissions(targetSubs);
    saveMap(skTarget(targetHandle), targetMap);

    const targetRaw = buildRawSubsMap(targetSubs);
    targetRawSubsMap = targetRaw;
    saveMap(skTargetRawSubs(targetHandle), targetRaw);

    setLoading(true, `Fetching ${USER_HANDLE}'s submissions...`);
    await new Promise(r => setTimeout(r, 600));

    const userSubs = await fetchAllSubmissions(USER_HANDLE, msg => setLoading(true, msg));
    const userMap = processSubmissions(userSubs);
    saveMap(skUser(targetHandle), userMap);

    const userRaw = buildRawSubsMap(userSubs);
    userRawSubsMap = userRaw;
    saveMap(skUserRawSubs(targetHandle), userRaw);

    await fetchAndCacheUserRating();

    localStorage.setItem(skSync(targetHandle), Date.now().toString());
    updateLastSync(Date.now());

    combinedList = buildCombinedList(targetMap, userMap);
    allTags = collectAllTags(combinedList);
    renderTagsFilter(allTags);
    renderStats(combinedList);
    applyFiltersAndSort();
    renderPlanner();

    showToast(`✅ Synced ${targetHandle}! ${combinedList.length} problems loaded.`, 'success');
  } catch (err) {
    console.error('Sync failed:', err);
    showToast(`❌ ${err.message}`, 'error');
    setLoading(true, `❌ Error: ${err.message}`);
    setTimeout(() => setLoading(false), 3000);
    setSyncing(false);
    return;
  }

  setLoading(false);
  setSyncing(false);
}

function loadProfileData(handle) {
  activeTargetHandle = handle;
  setActiveProfile(handle);
  renderProfileTabs();
  resetFilters();
  expandedRows.clear();

  const cachedTarget = loadMap(skTarget(handle));
  const cachedUser = loadMap(skUser(handle));
  const syncTs = localStorage.getItem(skSync(handle));
  const lastSync = syncTs ? parseInt(syncTs, 10) : null;

  targetRawSubsMap = loadMap(skTargetRawSubs(handle)) || new Map();
  userRawSubsMap = loadMap(skUserRawSubs(handle)) || new Map();

  if (cachedTarget && cachedUser) {
    combinedList = buildCombinedList(cachedTarget, cachedUser);
    allTags = collectAllTags(combinedList);
    renderTagsFilter(allTags);
    renderStats(combinedList);
    applyFiltersAndSort();
    renderPlanner();
    updateLastSync(lastSync);
  } else {
    combinedList = [];
    filteredSorted = [];
    allTags = [];
    renderTagsFilter([]);
    renderStats([]);
    renderTable([], 1);
    updateLastSync(null);
    updateViewModeCounts();
    syncData();
  }
}

// ===================================================
// Data Migration (old single-profile format)
// ===================================================

function migrateOldData() {
  const oldTarget = localStorage.getItem('cf_tracker_target_data');
  const oldUser = localStorage.getItem('cf_tracker_user_data');
  const oldSync = localStorage.getItem('cf_tracker_last_sync');

  // Check if there are any existing profiles to migrate to
  const profiles = getProfiles();
  const firstProfile = profiles[0];

  if (oldTarget && firstProfile && !localStorage.getItem(skTarget(firstProfile))) {
    localStorage.setItem(skTarget(firstProfile), oldTarget);
    localStorage.setItem(skUser(firstProfile), oldUser || '');
    if (oldSync) localStorage.setItem(skSync(firstProfile), oldSync);
    localStorage.removeItem('cf_tracker_target_data');
    localStorage.removeItem('cf_tracker_user_data');
    localStorage.removeItem('cf_tracker_last_sync');
  }
}

// ===================================================
// Event Attachment
// ===================================================

function attachEvents() {
  document.getElementById('btnSync').addEventListener('click', () => syncData());

  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => applyFiltersAndSort(), 200);
  });

  ['sortSelect','filterStatus','filterTargetStatus','filterTags'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => applyFiltersAndSort());
  });

  let ratingTimer;
  ['filterRatingMin','filterRatingMax'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      clearTimeout(ratingTimer);
      ratingTimer = setTimeout(() => applyFiltersAndSort(), 300);
    });
  });

  // Profile tab clicks
  document.getElementById('profileBar').addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.tab-close');
    if (closeBtn) {
      e.stopPropagation();
      const handle = closeBtn.dataset.close;
      if (confirm(`Remove profile "${handle}"? Cached data will be deleted.`)) {
        removeProfile(handle);
        const remaining = getProfiles();
        if (remaining.length === 0) {
          // All profiles removed — show setup
          localStorage.removeItem('cf_tracker_setup_done');
          location.reload();
          return;
        }
        loadProfileData(getActiveProfile());
      }
      return;
    }
    const tab = e.target.closest('.profile-tab');
    if (tab) {
      const handle = tab.dataset.handle;
      if (handle !== activeTargetHandle) {
        loadProfileData(handle);
      }
    }
  });

  // Add profile button
  document.getElementById('btnAddProfile').addEventListener('click', () => {
    const popover = document.getElementById('addProfilePopover');
    toggleAddPopover(!popover.classList.contains('visible'));
  });

  document.getElementById('btnConfirmAdd').addEventListener('click', () => handleAddProfile());
  document.getElementById('btnCancelAdd').addEventListener('click', () => toggleAddPopover(false));

  document.getElementById('newProfileInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddProfile();
    if (e.key === 'Escape') toggleAddPopover(false);
  });

  // Close popover on outside click
  document.addEventListener('click', (e) => {
    const popover = document.getElementById('addProfilePopover');
    const addBtn = document.getElementById('btnAddProfile');
    if (popover.classList.contains('visible') && !popover.contains(e.target) && !addBtn.contains(e.target)) {
      toggleAddPopover(false);
    }
  });

  // View mode tabs
  document.getElementById('viewModeBar').addEventListener('click', (e) => {
    const tab = e.target.closest('.view-tab');
    if (tab && tab.dataset.view) {
      setViewMode(tab.dataset.view);
    }
  });

  // Table interaction — bookmark, checkmark, submissions
  document.getElementById('problemTableBody').addEventListener('click', (e) => {
    const bmBtn = e.target.closest('.bookmark-btn');
    if (bmBtn) {
      e.stopPropagation();
      const key = bmBtn.dataset.bmKey;
      const nowBookmarked = toggleBookmark(key);
      bmBtn.classList.toggle('active', nowBookmarked);
      bmBtn.textContent = nowBookmarked ? '★' : '☆';
      updateViewModeCounts();
      if (currentViewMode === 'bookmarked' && !nowBookmarked) {
        applyFiltersAndSort();
      }
      return;
    }

    const cmBtn = e.target.closest('.check-btn');
    if (cmBtn) {
      e.stopPropagation();
      toggleCheckmark(cmBtn.dataset.checkKey);
      applyFiltersAndSort();
      return;
    }

    const subsBtn = e.target.closest('.subs-btn');
    if (subsBtn) {
      e.stopPropagation();
      toggleSubmissionRow(subsBtn.dataset.subsKey);
      return;
    }
  });

  // User Section / Badge
  const userBadge = document.getElementById('userBadge');
  const userModal = document.getElementById('userModalOverlay');
  if (userBadge) {
    userBadge.addEventListener('click', () => {
      document.getElementById('currentUserDisplay').textContent = getUserHandle();
      userModal.style.display = 'flex';
    });
  }

  const btnCloseUserModal = document.getElementById('btnCloseUserModal');
  if (btnCloseUserModal) {
    btnCloseUserModal.addEventListener('click', () => {
      userModal.style.display = 'none';
    });
  }

  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('cf_tracker_setup_done');
      localStorage.removeItem('cf_tracker_expiry');
      sessionStorage.removeItem('cf_tracker_active_session');
      location.reload();
    });
  }
}

// ===================================================
// Boot Application
// ===================================================

function bootApp() {
  migrateOldData();
  const active = getActiveProfile();
  if (active) {
    renderProfileTabs();
    loadProfileData(active);
  }
  const handleBadge = document.getElementById('userBadgeHandle');
  if (handleBadge) handleBadge.textContent = getUserHandle() || 'User';

  attachEvents();
  initPlanner();
  fetchAndCacheUserRating().then(() => {
    if (document.getElementById('suggestionsPanel').classList.contains('open')) {
      renderSuggestions();
    }
  });
}

// ===================================================
// DOMContentLoaded — Entry Point
// ===================================================

document.addEventListener('DOMContentLoaded', () => {
  if (!isSetupDone()) {
    showSetupModal();
  } else {
    bootApp();
  }
});
