// ===================================================
// CF Tracker — Data Processing, Filtering, Sorting
// ===================================================

import { getBookmarks, getCheckmarks, getUserRating } from './storage.js';
import { getRatingClass } from './utils.js';

// ===================================================
// Combined List Builder
// ===================================================

/**
 * Merge target user's problem map with your own to build a unified list.
 */
function buildCombinedList(targetMap, userMap) {
  const list = [];
  for (const [key, t] of targetMap) {
    const u = userMap.get(key) || null;
    let yourStatus = 'not-attempted';
    if (u) yourStatus = u.solved ? 'solved' : 'attempted';
    list.push({
      key, contestId: t.contestId, index: t.index, name: t.name,
      rating: t.rating, tags: t.tags, targetSolved: t.solved,
      targetFirstAttempt: t.firstAttemptTime, targetSolvedTime: t.solvedTime,
      targetAttempts: t.attempts, yourStatus,
      yourSolvedTime: u?.solvedTime || null, yourAttempts: u?.attempts || 0,
    });
  }
  return list;
}

// ===================================================
// Sorting
// ===================================================

function sortList(list, by) {
  const bookmarks = getBookmarks();
  const s = [...list];
  switch (by) {
    case 'date-desc': s.sort((a,b) => (b.targetFirstAttempt||0) - (a.targetFirstAttempt||0)); break;
    case 'date-asc': s.sort((a,b) => (a.targetFirstAttempt||0) - (b.targetFirstAttempt||0)); break;
    case 'rating-desc': s.sort((a,b) => (b.rating||0) - (a.rating||0)); break;
    case 'rating-asc': s.sort((a,b) => (a.rating||0) - (b.rating||0)); break;
    case 'rating-date-desc': s.sort((a,b) => { const d = (b.rating||0)-(a.rating||0); return d !== 0 ? d : (b.targetFirstAttempt||0)-(a.targetFirstAttempt||0); }); break;
    case 'rating-date-asc': s.sort((a,b) => { const d = (a.rating||0)-(b.rating||0); return d !== 0 ? d : (a.targetFirstAttempt||0)-(b.targetFirstAttempt||0); }); break;
    case 'status': { const o = {'not-attempted':0,'attempted':1,'solved':2}; s.sort((a,b)=>o[a.yourStatus]-o[b.yourStatus]); break; }
    case 'bookmark-first': {
      s.sort((a,b) => {
        const aB = bookmarks.has(a.key) ? 0 : 1;
        const bB = bookmarks.has(b.key) ? 0 : 1;
        if (aB !== bB) return aB - bB;
        return (b.targetFirstAttempt||0) - (a.targetFirstAttempt||0);
      });
      break;
    }
  }
  return s;
}

// ===================================================
// Filtering
// ===================================================

function filterList(list, f, currentViewMode) {
  const checkmarks = getCheckmarks();
  const bookmarks = getBookmarks();

  return list.filter(item => {
    // View mode filtering
    if (currentViewMode === 'all') {
      if (checkmarks.has(item.key)) return false;
    } else if (currentViewMode === 'bookmarked') {
      if (!bookmarks.has(item.key)) return false;
      if (checkmarks.has(item.key)) return false;
    } else if (currentViewMode === 'checkmarked') {
      if (!checkmarks.has(item.key)) return false;
    }

    // Standard filters
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !String(item.contestId).includes(q)
        && !item.key.toLowerCase().includes(q) && !item.tags.some(t=>t.toLowerCase().includes(q))) return false;
    }
    if (f.yourStatus !== 'all' && item.yourStatus !== f.yourStatus) return false;
    if (f.targetStatus === 'solved' && !item.targetSolved) return false;
    if (f.targetStatus === 'failed' && item.targetSolved) return false;
    const r = item.rating || 0;
    if (f.ratingMin != null && r < f.ratingMin) return false;
    if (f.ratingMax != null && r > f.ratingMax) return false;
    if (f.tag !== 'all' && !item.tags.includes(f.tag)) return false;
    return true;
  });
}

/**
 * Collect all unique tags from a list and sort alphabetically.
 */
function collectAllTags(list) {
  const s = new Set();
  for (const i of list) for (const t of i.tags) s.add(t);
  return [...s].sort();
}

// ===================================================
// Rating Bucket Helpers (for Daily Planner)
// ===================================================

function getRatingBucketKey(rating) {
  if (rating == null) return 'Unrated';
  return String(rating);
}

function getRatingBucketColor(key) {
  if (key === 'Unrated') return 'unrated';
  const r = parseInt(key, 10);
  if (isNaN(r)) return 'unrated';
  if (r < 1200) return 'gray';
  if (r < 1400) return 'green';
  if (r < 1600) return 'cyan';
  if (r < 1900) return 'blue';
  if (r < 2100) return 'violet';
  if (r < 2400) return 'orange';
  return 'red';
}

function getRatingBucketCssClass(key) {
  if (key === 'Unrated') return 'rating-unrated';
  const r = parseInt(key, 10);
  if (isNaN(r)) return 'rating-unrated';
  if (r < 1200) return 'rating-gray';
  if (r < 1400) return 'rating-green';
  if (r < 1600) return 'rating-cyan';
  if (r < 1900) return 'rating-blue';
  if (r < 2100) return 'rating-violet';
  if (r < 2400) return 'rating-orange';
  return 'rating-red';
}

// ===================================================
// Daily Planner Data
// ===================================================

function getUnsolved(combinedList) {
  const checkmarks = getCheckmarks();
  return combinedList.filter(p => p.yourStatus !== 'solved' && !checkmarks.has(p.key));
}

function computePlannerData(combinedList) {
  const unsolved = getUnsolved(combinedList);
  const totalRemaining = unsolved.length;

  // Group by exact rating (per-100 buckets)
  const bucketMap = new Map();
  for (const p of unsolved) {
    const k = getRatingBucketKey(p.rating);
    if (!bucketMap.has(k)) bucketMap.set(k, []);
    bucketMap.get(k).push(p);
  }

  // Build sorted bucket order
  const bucketOrder = [...bucketMap.keys()].sort((a, b) => {
    if (a === 'Unrated') return 1;
    if (b === 'Unrated') return -1;
    return parseInt(a, 10) - parseInt(b, 10);
  });

  // Calculate days and daily target
  const dateStr = document.getElementById('plannerTargetDate').value;
  const overrideVal = parseInt(document.getElementById('plannerDailyOverride').value, 10);
  let daysLeft = 0;
  let dailyTarget = 0;
  let usingOverride = false;

  if (!isNaN(overrideVal) && overrideVal > 0) {
    dailyTarget = overrideVal;
    usingOverride = true;
    daysLeft = totalRemaining > 0 ? Math.ceil(totalRemaining / dailyTarget) : 0;
  } else if (dateStr) {
    const targetDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    targetDate.setHours(0,0,0,0);
    daysLeft = Math.max(0, Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24)));
    dailyTarget = daysLeft > 0 ? Math.ceil(totalRemaining / daysLeft) : totalRemaining;
  }

  // Distribute daily target using growth-based distribution
  const bucketTargets = new Map();
  if (dailyTarget > 0 && totalRemaining > 0) {
    const R = getUserRating();
    const numericBuckets = bucketOrder.filter(k => k !== 'Unrated').map(Number);
    const useGrowth = R != null && numericBuckets.length > 0;
    
    let assigned = 0;
    const entries = [];
    
    if (useGrowth) {
      const R_b = Math.floor(R / 100) * 100;
      
      const distribution = [
        { label: 'Warmup',  buckets: [String(R_b - 200), String(R_b - 100)], weight: 0.20 },
        { label: 'Comfort', buckets: [String(R_b)],                          weight: 0.30 },
        { label: 'Growth',  buckets: [String(R_b + 100)],                    weight: 0.35 },
        { label: 'Stretch', buckets: [String(R_b + 200), String(R_b + 300)], weight: 0.15 }
      ];
      
      const tierData = distribution.map(tier => {
        let totalCount = 0;
        const tierBucketKeys = [];
        for (const bk of tier.buckets) {
          if (bucketMap.has(bk) && bucketMap.get(bk).length > 0) {
            totalCount += bucketMap.get(bk).length;
            tierBucketKeys.push(bk);
          }
        }
        return { ...tier, totalCount, tierBucketKeys };
      }).filter(t => t.totalCount > 0);
      
      if (tierData.length > 0) {
        const totalWeight = tierData.reduce((s, t) => s + t.weight, 0);
        for (const tier of tierData) {
          const raw = (tier.weight / totalWeight) * dailyTarget;
          const tierTarget = Math.min(Math.round(raw), tier.totalCount);
          
          let tierAssigned = 0;
          for (const bk of tier.tierBucketKeys) {
            const bCount = bucketMap.get(bk).length;
            const bShare = tier.totalCount > 0 ? Math.round(tierTarget * (bCount / tier.totalCount)) : 0;
            const actual = Math.min(bShare, bCount);
            entries.push({ key: bk, floored: actual, frac: 0, count: bCount });
            tierAssigned += actual;
          }
          let tierLeftover = tierTarget - tierAssigned;
          for (const bk of tier.tierBucketKeys) {
            if (tierLeftover <= 0) break;
            const e = entries.find(x => x.key === bk);
            const space = e.count - e.floored;
            if (space > 0) {
              const add = Math.min(space, tierLeftover);
              e.floored += add;
              tierLeftover -= add;
            }
          }
          assigned += tierTarget;
        }
      } else {
        for (const [k, problems] of bucketMap) {
          if (problems.length === 0) continue;
          const proportion = problems.length / totalRemaining;
          const raw = proportion * dailyTarget;
          const floored = Math.floor(raw);
          entries.push({ key: k, floored, frac: raw - floored, count: problems.length });
          assigned += floored;
        }
      }
    } else {
      for (const [k, problems] of bucketMap) {
        if (problems.length === 0) continue;
        const proportion = problems.length / totalRemaining;
        const raw = proportion * dailyTarget;
        const floored = Math.floor(raw);
        entries.push({ key: k, floored, frac: raw - floored, count: problems.length });
        assigned += floored;
      }
    }
    
    for (const e of entries) bucketTargets.set(e.key, e.floored);
    
    // Distribute remainder
    let remainder = dailyTarget - assigned;
    entries.sort((a, b) => b.frac - a.frac);
    for (const e of entries) {
      if (remainder <= 0) break;
      const current = bucketTargets.get(e.key) || 0;
      if (current < e.count) {
        bucketTargets.set(e.key, current + 1);
        remainder--;
      }
    }
    
    // Spill into adjacent buckets
    if (remainder > 0) {
      for (const k of bucketOrder) {
        if (remainder <= 0) break;
        const count = bucketMap.get(k).length;
        const current = bucketTargets.get(k) || 0;
        const space = count - current;
        if (space > 0) {
          const add = Math.min(space, remainder);
          bucketTargets.set(k, current + add);
          remainder -= add;
        }
      }
    }
  }

  return { unsolved, totalRemaining, bucketMap, bucketOrder, daysLeft, dailyTarget, usingOverride, bucketTargets };
}

function generateSuggestions(combinedList) {
  const data = computePlannerData(combinedList);
  const { bucketMap, bucketTargets, dailyTarget } = data;
  if (dailyTarget === 0) return [];

  const suggestions = [];
  for (const [key, problems] of bucketMap) {
    const target = bucketTargets.get(key) || 0;
    if (target === 0 || problems.length === 0) continue;

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));

    const sorted = [...problems].sort((a, b) => {
      if (a.contestId !== b.contestId) return a.contestId - b.contestId;
      return a.index.localeCompare(b.index);
    });

    const offset = dayOfYear % sorted.length;
    for (let i = 0; i < Math.min(target, sorted.length); i++) {
      const idx = (offset + i) % sorted.length;
      suggestions.push(sorted[idx]);
    }
  }

  return suggestions;
}

export {
  buildCombinedList,
  sortList,
  filterList,
  collectAllTags,
  getRatingBucketKey,
  getRatingBucketColor,
  getRatingBucketCssClass,
  getUnsolved,
  computePlannerData,
  generateSuggestions,
};
