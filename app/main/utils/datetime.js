const PK_TIMEZONE = 'Asia/Karachi';
const PK_OFFSET_MINUTES = 5 * 60;

function getPkParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find(p => p.type === type)?.value || '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function formatPkDate(value = new Date()) {
  const p = getPkParts(value);
  if (!p) return '';
  return `${p.year}-${p.month}-${p.day}`;
}

function formatPkDateTime(value = new Date()) {
  const p = getPkParts(value);
  if (!p) return '';
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

function shiftPkDate(dateStr, days = 0) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) return '';
  const ms = Date.UTC(year, month - 1, day) + (days * 86400000);
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function extractDatePk(value) {
  if (!value) return '';
  const str = String(value).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match && !str.includes('T')) return match[1];
  return formatPkDate(str);
}

function getPkDateUtcBounds(dateStr) {
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) return { from: '', to: '' };

  const offsetMs = PK_OFFSET_MINUTES * 60 * 1000;
  const fromMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMs;
  const toMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - offsetMs;

  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
  };
}

module.exports = {
  PK_TIMEZONE,
  formatPkDate,
  formatPkDateTime,
  shiftPkDate,
  extractDatePk,
  getPkDateUtcBounds,
};
