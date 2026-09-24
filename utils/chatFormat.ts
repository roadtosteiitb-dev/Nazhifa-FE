/** Date / name helpers shared by the chat list and chat room — follow the app language. */
import i18n from "./i18n";

const NAMES = {
  id: {
    days: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
    months: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
    today: "Hari ini",
    yesterday: "Kemarin",
  },
  en: {
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    today: "Today",
    yesterday: "Yesterday",
  },
};
const L = () => (i18n.language?.startsWith("en") ? NAMES.en : NAMES.id);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysAgo = (d: Date) => Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
const pad = (n: number) => String(n).padStart(2, "0");

const parse = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

/** "14:05" in the device's local time */
export function formatClock(iso?: string | null): string {
  const d = parse(iso);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
}

/** Chat list: "14:05" today · yesterday · weekday within a week · "12 Sep" · "12 Sep 2025" */
export function formatListTime(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return "";
  const ago = daysAgo(d);
  if (ago <= 0) return formatClock(iso);
  if (ago === 1) return L().yesterday;
  if (ago < 7) return L().days[d.getDay()];
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${L().months[d.getMonth()]}${sameYear ? "" : ` ${d.getFullYear()}`}`;
}

/** Day separator in the chat room: today · yesterday · "Monday, 22 Sep 2026" */
export function formatDayLabel(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return "";
  const ago = daysAgo(d);
  if (ago <= 0) return L().today;
  if (ago === 1) return L().yesterday;
  return `${L().days[d.getDay()]}, ${d.getDate()} ${L().months[d.getMonth()]} ${d.getFullYear()}`;
}

export function dayKey(iso?: string | null): string {
  const d = parse(iso);
  return d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : "";
}

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter((p) => /[a-z0-9]/i.test(p));
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] ?? name).slice(0, 2).toUpperCase();
}

/** Stable avatar color per person */
const AVATAR_COLORS = ["#2E7D32", "#2563EB", "#9333EA", "#DB2777", "#EA580C", "#0891B2", "#CA8A04", "#4F46E5"];
export function avatarColor(seed?: string | null): string {
  const s = seed ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
