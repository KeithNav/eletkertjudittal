const TIME_ZONE = 'Europe/Budapest';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

// 'YYYY-MM-DD' kulcs magyarországi idő szerint; érvénytelen dátumnál null.
export function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

// Egy piac akkor aktuális, ha a napja ma vagy később van (a mai nap még látszik).
export function isUpcoming(item, now = new Date()) {
  const day = dayKey(item.date);
  return day !== null && day >= dayKey(now);
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString('hu-HU', { timeZone: TIME_ZONE });
}
