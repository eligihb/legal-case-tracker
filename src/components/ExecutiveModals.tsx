'use client';

import React, { useRef, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  FileUp,
  Printer,
  RefreshCw,
  Settings,
  ShieldCheck,
  Upload,
  Users,
  X,
  Database,
  Landmark,
} from 'lucide-react';
import {
  CASE_CATEGORIES,
  CATEGORY_LABELS,
  CaseCategory,
  CaseItem,
  MunicipalitySetting,
  SystemUserAccount,
  UserSession,
} from '@/types/database';
import {
  calculateTotalDebt,
  formatCurrencyILS,
  formatDateHe,
  getDueCountdown,
} from '@/lib/dateUtils';
import {
  downloadFullSystemBackupJson,
  loadSampleDataSafeMerge,
  restoreFromBackupSafeMerge,
} from '@/lib/dataService';
import { quickExportFilteredCasesToXlsx } from './ExcelExportModal';
import CopyButton from './CopyButton';
import { DrawerTab } from './CaseDrawer';

export type ExecutiveKpiType =
  | 'upcoming_hearings'
  | 'postponed_hearings'
  | 'urgent_tasks'
  | 'reminders_week'
  | 'court_submissions'
  | 'delayed_cases';

interface KpiDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiType: ExecutiveKpiType | null;
  title: string;
  subtitle: string;
  casesList: CaseItem[];
  onSelectCase: (caseItem: CaseItem, tab?: DrawerTab) => void;
  onApplyTableFilter: (kpiType: ExecutiveKpiType) => void;
}

export function KpiDetailsModal({
  isOpen,
  onClose,
  kpiType,
  title,
  subtitle,
  casesList,
  onSelectCase,
  onApplyTableFilter,
}: KpiDetailsModalProps) {
  const [copiedAll, setCopiedAll] = useState(false);

  if (!isOpen || !kpiType) return null;

  const preferredTab: DrawerTab =
    kpiType === 'urgent_tasks'
      ? 'tasks'
      : kpiType === 'postponed_hearings'
      ? 'logs'
      : 'overview';

  const handleCopyAllList = async () => {
    const lines = casesList.map((c, idx) => {
      const due = c.next_due_date ? formatDateHe(c.next_due_date) : 'ללא מועד';
      return `${idx + 1}. ${c.debtor_name} | תיק: ${
        c.case_number || '—'
      } | תחום: ${c.category} | סטטוס: ${c.status} | פעולה: ${
        c.next_action_type
      } - ${c.next_action_description || ''} | יעד: ${due}`;
    });
    const text = `דוח ריכוז: ${title} (${casesList.length} תיקים)\n${'='.repeat(
      45
    )}\n${lines.join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 no-print transition-all duration-200"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[86dvh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#0F172A] text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-extrabold">{title}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-white/15 text-white">
                {casesList.length} תיקים
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">{subtitle}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyAllList}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/15 transition"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>הרשימה הועתקה ✓</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>העתק רשימה</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                quickExportFilteredCasesToXlsx(casesList, title)
              }
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>ייצוא לאקסל</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onApplyTableFilter(kpiType);
                onClose();
                setTimeout(() => window.print(), 150);
              }}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/15 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>הדפסה</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List body */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-200 p-4 space-y-2 bg-[#F8FAFC]">
          {casesList.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-bold">
              אין תיקים בקטגוריה זו כעת.
            </div>
          ) : (
            casesList.map((c) => {
              const cd = getDueCountdown(c.next_due_date);
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onClose();
                    onSelectCase(c, preferredTab);
                  }}
                  className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 cursor-pointer transition flex flex-wrap items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
                        {c.category}
                      </span>
                      <span className="font-extrabold text-slate-900 text-base">
                        {c.debtor_name}
                      </span>
                      <CopyButton value={c.debtor_name} label="העתק שם" />
                      {c.case_number && (
                        <span className="text-xs font-mono font-bold text-slate-600">
                          תיק: {c.case_number}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                        {c.status}
                      </span>
                    </div>

                    <div className="text-sm text-slate-700 font-medium">
                      <strong className="text-slate-900">
                        [{c.next_action_type}]
                      </strong>{' '}
                      {c.next_action_description || c.notes || 'ללא פירוט'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {c.next_due_date && (
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1 ${
                          cd.urgency === 'overdue'
                            ? 'bg-red-50 text-red-800 border border-red-200'
                            : cd.urgency === 'today'
                            ? 'bg-amber-50 text-amber-900 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {cd.label} ({formatDateHe(c.next_due_date)})
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onSelectCase(c, preferredTab);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-xs font-extrabold inline-flex items-center gap-1 transition"
                    >
                      <span>פתח תיק</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onApplyTableFilter(kpiType);
              onClose();
            }}
            className="text-xs font-extrabold text-[#1E3A8A] hover:underline"
          >
            הצג וסנן רשימה זו בטבלה הראשית ➔
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// חלון דוחות ותרשימים ניהוליים (Reports & Charts Modal)
// ============================================================================
interface ReportsAndChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCases: CaseItem[];
  filteredCases: CaseItem[];
  onOpenCustomColumnsExport: () => void;
}

export function ReportsAndChartsModal({
  isOpen,
  onClose,
  allCases,
  filteredCases,
  onOpenCustomColumnsExport,
}: ReportsAndChartsModalProps) {
  if (!isOpen) return null;

  const activeCases = allCases.filter((c) => !c.is_archived);
  const archivedCases = allCases.filter((c) => c.is_archived);
  const totalActive = Math.max(1, activeCases.length);

  const totalGviyaDebt = activeCases
    .filter((c) => c.category === 'גבייה')
    .reduce((sum, c) => sum + calculateTotalDebt(c), 0);

  return (
    <div
      className="fixed inset-0 z-[65] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 no-print transition-all duration-200"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[88dvh] overflow-hidden"
      >
        <div className="px-5 py-4 bg-[#0F172A] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="text-lg font-extrabold">
                דוחות ותרשימים ניהוליים — Executive Overview
              </h3>
              <p className="text-xs text-slate-300">
                פילוח תיקים לפי תחומים, עומסים, ארכיון וייצוא לאקסל / הדפסה
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 bg-[#F8FAFC]">
          {/* KPI Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-500">
                תיקים פעילים
              </div>
              <div className="text-2xl font-extrabold text-[#0F172A] mt-1">
                {activeCases.length}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-500">
                בארכיון (הושלמו)
              </div>
              <div className="text-2xl font-extrabold text-slate-700 mt-1">
                {archivedCases.length}
              </div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 sm:col-span-2">
              <div className="text-xs font-bold text-slate-500">
                סה&quot;כ חוב מנוהל בתיקי רשויות (גבייה)
              </div>
              <div className="text-2xl font-extrabold text-[#1E3A8A] mt-1">
                {formatCurrencyILS(totalGviyaDebt)}
              </div>
            </div>
          </div>

          {/* Visual Bar Chart by Category */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-sm font-extrabold text-slate-900">
              התפלגות תיקים פעילים לפי 4 תחומי הפעילות:
            </h4>
            <div className="space-y-2.5">
              {CASE_CATEGORIES.map((cat) => {
                const count = activeCases.filter(
                  (c) => c.category === cat
                ).length;
                const pct = Math.round((count / totalActive) * 100);
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>{CATEGORY_LABELS[cat].title}</span>
                      <span>
                        {count} תיקים ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1E3A8A] rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Export Actions */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-sm font-extrabold text-slate-900">
              הפקת דוחות וייצוא נתונים:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() =>
                  quickExportFilteredCasesToXlsx(filteredCases, 'סינון_נוכחי')
                }
                className="p-3 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-xs font-extrabold flex items-center justify-center gap-2 transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>ייצוא תצוגה נוכחית ({filteredCases.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCustomColumnsExport();
                }}
                className="p-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-extrabold flex items-center justify-center gap-2 transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>ייצוא מותאם אישית (בחירת עמודות)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  setTimeout(() => window.print(), 150);
                }}
                className="p-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-extrabold flex items-center justify-center gap-2 transition"
              >
                <Printer className="w-4 h-4 text-slate-700" />
                <span>הדפסת דוח רשימה נוכחית</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// חלון הגדרות מאוחד (Executive Settings Modal):
// מאגד הרשאות/סיסמת עריכה, גיבוי מלא (JSON), שחזור במיזוג בטוח, ייבוא ונתוני דוגמה
// ============================================================================
interface ExecutiveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession;
  onToggleRoleQuick: () => void;
  onOpenUsersModal: () => void;
  onOpenMuniModal: () => void;
  onOpenCsvModal: () => void;
  onDataRestored: (result: {
    cases: CaseItem[];
    muniSettings: MunicipalitySetting[];
    users: SystemUserAccount[];
  }) => void;
}

export function ExecutiveSettingsModal({
  isOpen,
  onClose,
  currentUser,
  onToggleRoleQuick,
  onOpenUsersModal,
  onOpenMuniModal,
  onOpenCsvModal,
  onDataRestored,
}: ExecutiveSettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        const res = restoreFromBackupSafeMerge(parsed);
        onDataRestored({
          cases: res.cases,
          muniSettings: res.muniSettings,
          users: res.users,
        });
        setStatusMessage(
          `שחזור במיזוג בטוח הושלם בהצלחה: נוספו ${res.addedCasesCount} תיקים חדשים ועודכנו ${res.updatedCasesCount} תיקים קיימים (ללא מחיקת מידע).`
        );
      } catch (err) {
        console.error('Backup restore failed:', err);
        alert('שגיאה בקריאת קובץ הגיבוי (JSON). ודא שהקובץ תקין.');
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleLoadSampleDataSafe = () => {
    const res = loadSampleDataSafeMerge();
    onDataRestored({
      cases: res.cases,
      muniSettings: res.muniSettings,
      users: res.users,
    });
    setStatusMessage(
      `נתוני הדוגמה מוזגו בבטחה (${res.addedCasesCount} נוספו, ${res.updatedCasesCount} עודכנו) מבלי לדרוס תיקים קיימים.`
    );
  };

  return (
    <div
      className="fixed inset-0 z-[65] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 no-print transition-all duration-200"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[88dvh] overflow-hidden"
      >
        <div className="px-5 py-4 bg-[#0F172A] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-slate-300" />
            <div>
              <h3 className="text-lg font-extrabold">
                הגדרות מערכת, הרשאות וגיבוי בטוח (Non-Destructive)
              </h3>
              <p className="text-xs text-slate-300">
                ניהול גיבוי ושחזור במיזוג בטוח, הרשאות עריכה, תעריפי רשויות וייבוא
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 bg-[#F8FAFC]">
          {statusMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-extrabold">
              ✓ {statusMessage}
            </div>
          )}

          {/* 1. הגנה על נתונים: גיבוי מלא (JSON) ושחזור במיזוג בטוח */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#1E3A8A]" />
              <h4 className="text-sm font-extrabold text-slate-900">
                1. גיבוי ושחזור נתונים (Non-Destructive Data Safety)
              </h4>
            </div>
            <p className="text-xs text-slate-600">
              המערכת שומרת על התיקים שלך במפתח קבוע ב-LocalStorage ולעולם אינה דורסת אותם בעדכוני גרסה. מכאן תוכל להוריד גיבוי מלא או לשחזר במיזוג בטוח.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  downloadFullSystemBackupJson();
                  setStatusMessage('קובץ הגיבוי המלא (JSON) הורד למחשב שלך.');
                }}
                className="p-3 rounded-xl bg-[#0F172A] hover:bg-[#1E3A8A] text-white text-xs font-extrabold flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4 text-sky-300" />
                <span>הורד גיבוי מלא (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition"
              >
                <FileUp className="w-4 h-4" />
                <span>שחזר מגיבוי (מיזוג בטוח)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreFileChange}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleLoadSampleDataSafe}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                <span>טען נתוני דוגמה (במיזוג בטוח)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCsvModal();
                }}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                <span>ייבוא תיקים מקובץ CSV</span>
              </button>
            </div>
          </div>

          {/* 2. הרשאות, משתמשים וסיסמת עריכה */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1E3A8A]" />
                <h4 className="text-sm font-extrabold text-slate-900">
                  2. הרשאות, משתמשים וכללי שכר טרחה לרשויות
                </h4>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800">
                מחובר כעת: {currentUser.displayName} ({currentUser.role})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={onToggleRoleQuick}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <ShieldCheck className="w-4 h-4 text-[#1E3A8A]" />
                <span>
                  החלף לתצוגת {currentUser.role === 'admin' ? 'עובד' : 'מנהל'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenUsersModal();
                }}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <Users className="w-4 h-4 text-[#1E3A8A]" />
                <span>משתמשים וסיסמאות</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMuniModal();
                }}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
              >
                <Landmark className="w-4 h-4 text-[#1E3A8A]" />
                <span>הגדרות שכ&quot;ט רשויות</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
