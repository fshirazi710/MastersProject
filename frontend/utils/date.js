export function normaliseTs(ts) {
  if (ts == null) return null; // pass through null/undefined

  // Try parsing as a date string first (handles ISO 8601)
  const asDate = new Date(ts);
  if (!isNaN(asDate.getTime())) {
    return asDate.toISOString();
  }

  // Try parsing as a number (Unix timestamp in seconds)
  const asNumber = Number(ts);
  if (!isNaN(asNumber)) {
    // Assuming it's seconds, convert to milliseconds for Date constructor
    const dateFromTimestamp = new Date(asNumber * 1000);
    if (!isNaN(dateFromTimestamp.getTime())) {
      return dateFromTimestamp.toISOString();
    }
  }

  // Fallback – keep the original so debugging is easier
  console.warn('[normaliseTs] Un-recognised timestamp format:', ts);
  return ts; // Return original problematic value
} 