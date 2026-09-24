/**
 * Admin report export — builds a report from real data and saves it as PDF / Excel.
 *
 *   - PDF   → HTML rendered by expo-print
 *   - Excel → real .xlsx built with SheetJS
 *
 * Saving:
 *   - Android → written straight into a folder the admin picks once (Storage Access Framework),
 *               e.g. "Download". The folder is remembered for next exports.
 *   - iOS     → share sheet ("Save to Files", AirDrop, email, …)
 */
import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as XLSX from "xlsx";
import type { Land } from "../contexts/LandContext";
import type { ApiUser } from "../services/UserService";
import type { ApiComplaint } from "../services/ComplaintService";
import i18n from "./i18n";

// Report text follows the app language at the moment the report is generated
const T = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts) as string;

export type ReportKind = "property" | "verification" | "users" | "complaints";
export type ExportFormat = "pdf" | "excel";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ReportSource {
  lands: Land[];
  users: ApiUser[];
  complaints: ApiComplaint[];
}

interface Report {
  title: string;
  fileSlug: string;
  summary: { label: string; value: number }[];
  columns: string[];
  rows: (string | number)[][];
}

const SAF_DIR_KEY = "@lokatani_report_dir";

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const months = () => (i18n.language?.startsWith("en") ? MONTHS_EN : MONTHS_ID);

// "YYYY-MM-DD" in local time
export const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const formatDate = (d: Date) => `${d.getDate()} ${months()[d.getMonth()]} ${d.getFullYear()}`;

const formatDay = (value?: string | null) => {
  if (!value) return "-";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return y && m && d ? `${d} ${months()[m - 1]} ${y}` : value;
};

// Inclusive date-range check on an ISO/date string; rows without a date are excluded
const inRange = (value: string | null | undefined, range: DateRange) => {
  if (!value) return false;
  const day = value.slice(0, 10);
  return day >= toDateStr(range.start) && day <= toDateStr(range.end);
};

const rupiah = (n?: number) => (n == null ? "-" : `Rp ${n.toLocaleString("id-ID")}`);

const typeLabel = (type?: string) => (type ? T(`property.type.${type}`, { defaultValue: type }) : "-");
const statusLabel = (status?: string) => (status ? T(`reportDoc.status.${status}`, { defaultValue: status }) : "-");

/* ================= BUILD ================= */
function buildReport(kind: ReportKind, range: DateRange, src: ReportSource): Report {
  const lands = src.lands.filter((l) => inRange(l.createdAt, range));
  const countStatus = (s: string) => lands.filter((l) => l.status === s).length;

  switch (kind) {
    case "property":
      return {
        title: T("reportDoc.propertyTitle"),
        fileSlug: T("reportDoc.slug.property"),
        summary: [
          { label: T("reportDoc.totalProperties"), value: lands.length },
          { label: statusLabel("Approved"), value: countStatus("Approved") },
          { label: statusLabel("Pending"), value: countStatus("Pending") },
          { label: statusLabel("Rejected"), value: countStatus("Rejected") },
          { label: statusLabel("Sold"), value: countStatus("Sold") },
        ],
        columns: [T("reportDoc.col.no"), T("reportDoc.col.propertyName"), T("reportDoc.col.type"), T("reportDoc.col.transaction"), T("reportDoc.col.price"), T("reportDoc.col.location"), T("reportDoc.col.owner"), T("reportDoc.col.status"), T("reportDoc.col.date")],
        rows: lands.map((l, i) => [
          i + 1,
          l.name,
          typeLabel(l.type),
          l.isForSale === false ? T("property.forRent") : T("property.forSale"),
          rupiah(l.price),
          l.location,
          l.owner ?? "-",
          statusLabel(l.status),
          formatDay(l.createdAt),
        ]),
      };

    case "verification":
      return {
        title: T("reportDoc.verificationTitle"),
        fileSlug: T("reportDoc.slug.verification"),
        summary: [
          { label: T("reportDoc.totalSubmissions"), value: lands.length },
          { label: statusLabel("Approved"), value: countStatus("Approved") },
          { label: statusLabel("Pending"), value: countStatus("Pending") },
          { label: statusLabel("Rejected"), value: countStatus("Rejected") },
        ],
        columns: [T("reportDoc.col.no"), T("reportDoc.col.propertyName"), T("reportDoc.col.owner"), T("reportDoc.col.status"), T("reportDoc.col.rejectionReason"), T("reportDoc.col.submittedAt")],
        rows: lands.map((l, i) => [
          i + 1,
          l.name,
          l.owner ?? "-",
          statusLabel(l.status),
          l.rejectionReason || "-",
          formatDay(l.createdAt),
        ]),
      };

    case "users": {
      const users = src.users.filter((u) => inRange(u.joinDate, range));
      return {
        title: T("reportDoc.usersTitle"),
        fileSlug: T("reportDoc.slug.users"),
        summary: [
          { label: T("reportDoc.totalUsers"), value: users.length },
          { label: T("admin.users.active"), value: users.filter((u) => u.status === "active").length },
          { label: T("admin.users.inactive"), value: users.filter((u) => u.status === "inactive").length },
          { label: T("auth.owner"), value: users.filter((u) => u.role === "owner").length },
          { label: T("admin.users.buyers"), value: users.filter((u) => u.role === "buyer").length },
        ],
        columns: [T("reportDoc.col.no"), T("reportDoc.col.name"), T("reportDoc.col.email"), T("reportDoc.col.phone"), T("reportDoc.col.role"), T("reportDoc.col.status"), T("reportDoc.col.joinedAt")],
        rows: users.map((u, i) => [
          i + 1,
          u.name,
          u.email,
          u.phone || "-",
          T(`roles.${u.role}`, { defaultValue: u.role }),
          u.status === "active" ? T("admin.users.active") : T("admin.users.inactive"),
          formatDay(u.joinDate),
        ]),
      };
    }

    case "complaints": {
      const complaints = src.complaints.filter((c) => inRange(c.date, range));
      return {
        title: T("reportDoc.complaintsTitle"),
        fileSlug: T("reportDoc.slug.complaints"),
        summary: [
          { label: T("reportDoc.totalComplaints"), value: complaints.length },
          { label: T("complaint.statuses.open"), value: complaints.filter((c) => c.status === "open").length },
          { label: T("complaint.statuses.in_progress"), value: complaints.filter((c) => c.status === "in_progress").length },
          { label: T("complaint.statuses.resolved"), value: complaints.filter((c) => c.status === "resolved").length },
        ],
        columns: [T("reportDoc.col.no"), T("reportDoc.col.date"), T("reportDoc.col.reporter"), T("reportDoc.col.property"), T("reportDoc.col.category"), T("reportDoc.col.message"), T("reportDoc.col.status")],
        rows: complaints.map((c, i) => [
          i + 1,
          formatDay(c.date),
          c.reporter ?? "-",
          c.property ?? "-",
          T(`complaint.categories.${c.category.replace(/\s/g, "")}`, { defaultValue: c.category }),
          c.message,
          T(`complaint.statuses.${c.status}`, { defaultValue: c.status }),
        ]),
      };
    }
  }
}

/* ================= RENDER ================= */
const esc = (v: string | number) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function toHtml(report: Report, range: DateRange): string {
  const period = `${formatDate(range.start)} – ${formatDate(range.end)}`;
  const generated = new Date().toLocaleString(i18n.language?.startsWith("en") ? "en-US" : "id-ID");
  const summary = report.summary
    .map((s) => `<div class="stat"><div class="val">${s.value}</div><div class="lbl">${esc(s.label)}</div></div>`)
    .join("");
  const head = report.columns.map((c) => `<th>${esc(c)}</th>`).join("");
  const body = report.rows.length
    ? report.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${report.columns.length}" class="empty">${esc(T("reportDoc.noData"))}</td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>
  @page { margin: 24px; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #0F172A; font-size: 11px; }
  .brand { color: #2E7D32; font-weight: 800; font-size: 13px; letter-spacing: 1px; }
  h1 { font-size: 20px; margin: 4px 0 2px; }
  .meta { color: #64748B; margin-bottom: 16px; }
  .stats { display: flex; gap: 8px; margin-bottom: 18px; }
  .stat { flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px; }
  .val { font-size: 18px; font-weight: 800; color: #2E7D32; }
  .lbl { color: #64748B; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #2E7D32; color: #fff; text-align: left; padding: 6px; font-size: 10px; }
  td { border-bottom: 1px solid #E2E8F0; padding: 6px; vertical-align: top; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .empty { text-align: center; color: #64748B; padding: 20px; }
</style></head><body>
  <div class="brand">TITIKHUNI</div>
  <h1>${esc(report.title)}</h1>
  <div class="meta">${esc(T("reportDoc.period", { period }))} &nbsp;·&nbsp; ${esc(T("reportDoc.generated", { date: generated }))}</div>
  <div class="stats">${summary}</div>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
}

function toXlsxBase64(report: Report, range: DateRange): string {
  const period = `${formatDate(range.start)} – ${formatDate(range.end)}`;
  const aoa: (string | number)[][] = [
    [report.title],
    [T("reportDoc.period", { period })],
    [],
    ...report.summary.map((s) => [s.label, s.value]),
    [],
    report.columns,
    ...report.rows,
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = report.columns.map((c, i) => ({
    wch: Math.min(50, Math.max(c.length, ...report.rows.map((r) => String(r[i] ?? "").length), 8) + 2),
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, T("reportDoc.sheetName"));
  return XLSX.write(book, { type: "base64", bookType: "xlsx" });
}

/* ================= SAVE ================= */
const MIME: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

async function getAndroidDir(forcePick = false): Promise<string | null> {
  if (!forcePick) {
    const saved = await AsyncStorage.getItem(SAF_DIR_KEY);
    if (saved) return saved;
  }
  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(
    FileSystem.StorageAccessFramework.getUriForDirectoryInRoot("Download")
  );
  if (!perm.granted) return null;
  await AsyncStorage.setItem(SAF_DIR_KEY, perm.directoryUri);
  return perm.directoryUri;
}

async function writeToAndroidDir(dir: string, fileName: string, format: ExportFormat, base64: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const uri = await FileSystem.StorageAccessFramework.createFileAsync(dir, baseName, MIME[format]);
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
}

export type ExportResult =
  | { status: "saved"; fileName: string }   // Android: written to the picked folder
  | { status: "shared"; fileName: string }  // iOS (or fallback): share sheet opened
  | { status: "cancelled" };

export async function exportReport(
  kind: ReportKind,
  format: ExportFormat,
  range: DateRange,
  src: ReportSource
): Promise<ExportResult> {
  const report = buildReport(kind, range, src);
  const ext = format === "pdf" ? "pdf" : "xlsx";
  const fileName = `${T("reportDoc.slug.prefix")}-${report.fileSlug}_${toDateStr(range.start)}_${toDateStr(range.end)}.${ext}`;

  // 1) Produce the file content as base64
  let base64: string;
  if (format === "pdf") {
    const pdf = await Print.printToFileAsync({ html: toHtml(report, range), base64: true });
    base64 = pdf.base64 ?? (await FileSystem.readAsStringAsync(pdf.uri, { encoding: FileSystem.EncodingType.Base64 }));
  } else {
    base64 = toXlsxBase64(report, range);
  }

  // 2) Android: save straight into the chosen folder
  if (Platform.OS === "android") {
    let dir = await getAndroidDir();
    if (!dir) return { status: "cancelled" };
    try {
      await writeToAndroidDir(dir, fileName, format, base64);
    } catch {
      // Saved folder permission may have been revoked — ask again once
      dir = await getAndroidDir(true);
      if (!dir) return { status: "cancelled" };
      await writeToAndroidDir(dir, fileName, format, base64);
    }
    return { status: "saved", fileName };
  }

  // 3) iOS / others: write to cache and open the share sheet
  const cacheUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(cacheUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(T("reportDoc.sharingUnavailable"));
  }
  await Sharing.shareAsync(cacheUri, {
    mimeType: MIME[format],
    dialogTitle: report.title,
    UTI: format === "pdf" ? "com.adobe.pdf" : "org.openxmlformats.spreadsheetml.sheet",
  });
  return { status: "shared", fileName };
}

/** Clear the remembered Android export folder (next export asks again). */
export const resetExportFolder = () => AsyncStorage.removeItem(SAF_DIR_KEY);
