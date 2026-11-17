'use client';

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileUp,
  Filter,
  Flame,
  Gavel,
  Home,
  Landmark,
  Layers,
  Lock,
  MapPin,
  Printer,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Truck,
  Unlock,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  CASE_CATEGORIES,
  CASE_DISTRICTS,
  CATEGORY_LABELS,
  CaseCategory,
  CaseDistrict,
  CaseItem,
  MunicipalitySetting,
  SystemUserAccount,
  UserSession,
  WorkerPermissionsConfig,
} from '@/types/database';
import {
  calculateTotalDebt,
  formatCurrencyILS,
  formatDateHe,
  getDueCountdown,
  isDeliveryOver30DaysAlert,
} from '@/lib/dateUtils';
import {
  bulkApplyDistrictToCases,
  downloadFullSystemBackupJson,
  loadSampleDataSafeMerge,
  restoreFromBackupSafeMerge,
  saveWorkerPermissions,
  toggleCaseFeePaid,
  updateCaseItem,
  verifyAdminPassword,
} from '@/lib/dataService';
import { quickExportFilteredCasesToXlsx } from './ExcelExportModal';
import CopyButton from './CopyButton';
import { DrawerTab } from './CaseDrawer';

export type ExecutiveKpiType =
  | 'overall_progress'
  | 'upcoming_hearings'
  | 'postponed_hearings'
  | 'urgent_tasks'
  | 'reminders_week'
  | 'court_submissions'
  | 'delayed_cases'
  | 'legal_fees';

export type WorkflowStageBucket =
  | 'התראה'
  | 'מסירה'
  | 'הגשה'
  | 'דיון'
  | 'הסדר/סגירה';

export type DeliveryBucket =
  | 'ממתין למסירה'
  | 'נמסר (בתוך 30 יום)'
  | 'חלפו 30 יום — מוכן להוצל"פ/הגשה';

export type HearingAnalyticsBucket =
  | 'דיונים ב-7 הימים הקרובים'
  | 'דיונים בחודש הקרוב'
  | 'דיונים שנדחו';

export function classifyWorkflowStage(c: CaseItem): WorkflowStageBucket {
  const st = `${c.status} ${c.current_stage || ''} ${c.next_action_type || ''}`;
  if (
    c.status === 'בהסדר' ||
    c.status === 'בהסדר תשלומים' ||
    c.status === 'סיום הסדר / סילוק חוב' ||
    c.status === 'מחיקת חוב ישן' ||
    c.status === 'סגור' ||
    c.is_archived
  ) {
    return 'הסדר/סגירה';
  }
  if (
    c.status === 'דיון קבוע' ||
    c.status === 'דיון נדחה' ||
    c.next_action_type === 'דיון' ||
    c.next_action_type === 'דיון שנדחה' ||
    st.includes('דיון') ||
    st.includes('חקירה')
  ) {
    return 'דיון';
  }
  if (
    c.status === 'בהוצל"פ' ||
    c.status === 'הגשה ממתינה לביהמ"ש' ||
    c.status === 'ממתין להחלטה' ||
    c.next_action_type === 'הגשה לביהמ"ש' ||
    c.next_action_type === 'תביעת חוב' ||
    c.next_action_type === 'פתיחת תביעה בהוצל"פ' ||
    c.next_action_type === 'בקשת צו הבאה'
  ) {
    return 'הגשה';
  }
  if (c.delivery_confirmation_date || st.includes('מסירה')) {
    return 'מסירה';
  }
  return 'התראה';
}

export function classifyDeliveryStatus(c: CaseItem): DeliveryBucket {
  const d30 = isDeliveryOver30DaysAlert(c);
  if (d30.isAlert) {
    return 'חלפו 30 יום — מוכן להוצל"פ/הגשה';
  }
  if (c.delivery_confirmation_date) {
    const targetCd = getDueCountdown(c.execution_target_date);
    if (targetCd.daysDiff !== null && targetCd.daysDiff < 0) {
      return 'חלפו 30 יום — מוכן להוצל"פ/הגשה';
    }
    return 'נמסר (בתוך 30 יום)';
  }
  return 'ממתין למסירה';
}

export function isCaseOverdueOrAlert(c: CaseItem): boolean {
  if (c.status === 'סגור' || c.is_archived) return false;
  const cd = getDueCountdown(c.next_due_date);
  const d30 = isDeliveryOver30DaysAlert(c);
  return (cd.daysDiff !== null && cd.daysDiff < 0) || d30.isAlert;
}

interface KpiDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiType: ExecutiveKpiType | null;
  title: string;
  subtitle: string;
  casesList: CaseItem[];
  onSelectCase: (caseItem: CaseItem, tab?: DrawerTab) => void;
  onApplyTableFilter: (kpiType: ExecutiveKpiType) => void;
  onPrintList?: (list: CaseItem[], title: string) => void;
  onCasesUpdated?: (updatedCases: CaseItem[]) => void;
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
  onPrintList,
  onCasesUpdated,
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
      } | מחוז: ${c.district || 'מרכז'} | תחום: ${c.category} | סטטוס: ${
        c.status
      } | פעולה: ${c.next_action_type} - ${
        c.next_action_description || ''
      } | יעד: ${due}`;
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
      className="fixed inset-0 z-[65] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 no-print transition-all duration-200"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[88dvh] overflow-hidden"
      >
        {/* שורת ניווט עליונה: מסך הבית > שם החלון + חזרה למסך קודם */}
        <div className="px-4 py-2 bg-slate-800 text-slate-200 border-b border-slate-700 flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="hover:text-white inline-flex items-center gap-1 text-sky-300 font-extrabold"
            >
              <Home className="w-3.5 h-3.5" />
              <span>מסך הבית</span>
            </button>
            <span className="text-slate-500">&gt;</span>
            <span className="text-white font-extrabold">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-extrabold inline-flex items-center gap-1 transition"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>חזרה למסך קודם</span>
          </button>
        </div>

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
              onClick={() => quickExportFilteredCasesToXlsx(casesList, title)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>ייצוא לאקסל</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onPrintList) {
                  onPrintList(casesList, title);
                } else {
                  onApplyTableFilter(kpiType);
                  onClose();
                  setTimeout(() => window.print(), 150);
                }
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

        <div className="flex-1 overflow-y-auto divide-y divide-slate-200 p-4 space-y-2 bg-[#F8FAFC]">
          {casesList.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-bold">
              אין תיקים בקטגוריה זו כעת.
            </div>
          ) : (
            casesList.map((c) => {
              const cd = getDueCountdown(c.next_due_date);
              const feeTotal = Number(c.legal_fee_amount) || 4500;
              const isPaid = Boolean(c.legal_fee_paid);
              const prepDays = Number(c.prep_days_needed) || 7;

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onClose();
                    onSelectCase(c, preferredTab);
                  }}
                  className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 cursor-pointer transition flex flex-wrap items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
                        {c.category}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                        מחוז {c.district || 'מרכז'}
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

                    <div className="text-sm text-slate-700 font-medium flex flex-wrap items-center gap-2">
                      <span>
                        <strong className="text-slate-900">
                          [{c.next_action_type}]
                        </strong>{' '}
                        {c.next_action_description || c.notes || 'ללא פירוט'}
                      </span>

                      {kpiType === 'court_submissions' && (
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 text-xs font-extrabold">
                          זמן היערכות מומלץ: {prepDays} ימים מראש
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {kpiType === 'legal_fees' && (
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-sm font-extrabold text-slate-900">
                          שכ&quot;ט: {formatCurrencyILS(feeTotal)}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            const updated = await toggleCaseFeePaid(c.id);
                            if (onCasesUpdated) onCasesUpdated(updated);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-extrabold border transition ${
                            isPaid
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'
                          }`}
                        >
                          {isPaid ? 'שולם ✓' : 'לא שולם (לחץ לסימון שולם)'}
                        </button>
                      </div>
                    )}

                    {c.next_due_date && (
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1 ${
                          cd.urgency === 'overdue'
                            ? 'bg-red-100 text-red-900 border border-red-300'
                            : cd.urgency === 'today'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-blue-50 text-blue-900 border border-blue-200'
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
// מרכז הדוחות והתרשימים החכם (Smart Reports & BI Dashboard - v6.0)
// 6 תרשימים אינטראקטיביים עם תוויות מספרים ואחוזים + סינון חכם + טבלת דוח חיה
// ============================================================================
interface ReportsAndChartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCases: CaseItem[];
  filteredCases: CaseItem[];
  onOpenCustomColumnsExport: () => void;
  onSelectCase: (caseItem: CaseItem, tab?: DrawerTab) => void;
  onCasesUpdated: (updatedCases: CaseItem[]) => void;
  onPrintBiReport: (casesToPrint: CaseItem[], reportTitle: string) => void;
}

export function ReportsAndChartsModal({
  isOpen,
  onClose,
  allCases,
  onOpenCustomColumnsExport,
  onSelectCase,
  onCasesUpdated,
  onPrintBiReport,
}: ReportsAndChartsModalProps) {
  // פילטרים אינטראקטיביים של מרכז ה-BI
  const [filterDistrict, setFilterDistrict] = useState<'הכל' | CaseDistrict>(
    'הכל'
  );
  const [filterCategory, setFilterCategory] = useState<'הכל' | CaseCategory>(
    'הכל'
  );
  const [filterStage, setFilterStage] = useState<'הכל' | WorkflowStageBucket>(
    'הכל'
  );
  const [filterOverdue, setFilterOverdue] = useState<
    'הכל' | 'overdue' | 'on_time'
  >('הכל');
  const [filterDelivery, setFilterDelivery] = useState<'הכל' | DeliveryBucket>(
    'הכל'
  );
  const [filterHearingBucket, setFilterHearingBucket] = useState<
    'הכל' | HearingAnalyticsBucket
  >('הכל');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // החלה גורפת של מחוז מתוך מרכז ה-BI
  const [bulkDistrictVal, setBulkDistrictVal] =
    useState<CaseDistrict>('מרכז');
  const [bulkDistrictScope, setBulkDistrictScope] = useState<
    'filtered' | 'category' | 'all'
  >('filtered');
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  const activeCases = useMemo(
    () => allCases.filter((c) => !c.is_archived),
    [allCases]
  );

  // חישוב נתוני 6 התרשימים הוויזואליים
  const analytics = useMemo(() => {
    const total = Math.max(1, activeCases.length);

    // 1. תיקים באיחור / חריגת מועד מול בזמן
    const overdueCount = activeCases.filter((c) =>
      isCaseOverdueOrAlert(c)
    ).length;
    const onTimeCount = activeCases.length - overdueCount;

    // 2. פילוח לפי מחוזות (כמות תיקים, דיונים ומשימות פתוחות בכל מחוז)
    const byDistrict = CASE_DISTRICTS.map((dist) => {
      const distCases = activeCases.filter(
        (c) => (c.district || 'מרכז') === dist
      );
      const hearings = distCases.filter(
        (c) =>
          c.next_action_type === 'דיון' ||
          c.status === 'דיון קבוע' ||
          c.status === 'דיון נדחה'
      ).length;
      const openTasks = distCases.reduce(
        (acc, c) =>
          acc +
          (c.milestones || []).filter((m) => m.status !== 'done').length,
        0
      );
      return {
        district: dist,
        count: distCases.length,
        pct: Math.round((distCases.length / total) * 100),
        hearings,
        openTasks,
      };
    });

    // 3. התפלגות לפי שלבי התיק (Workflow Stages)
    const stageBuckets: WorkflowStageBucket[] = [
      'התראה',
      'מסירה',
      'הגשה',
      'דיון',
      'הסדר/סגירה',
    ];
    const byStage = stageBuckets.map((stage) => {
      const count = activeCases.filter(
        (c) => classifyWorkflowStage(c) === stage
      ).length;
      return {
        stage,
        count,
        pct: Math.round((count / total) * 100),
      };
    });

    // 4. מעקב מסירות (Deliveries & 30-Day Rule)
    const deliveryBuckets: DeliveryBucket[] = [
      'ממתין למסירה',
      'נמסר (בתוך 30 יום)',
      'חלפו 30 יום — מוכן להוצל"פ/הגשה',
    ];
    const byDelivery = deliveryBuckets.map((b) => {
      const count = activeCases.filter(
        (c) => classifyDeliveryStatus(c) === b
      ).length;
      return {
        bucket: b,
        count,
        pct: Math.round((count / total) * 100),
      };
    });

    // 5. לוח דיונים (Hearings Analytics: 7 ימים, החודש הקרוב, ודיונים שנדחו)
    const hearings7Days = activeCases.filter((c) => {
      const cd = getDueCountdown(c.next_due_date);
      return (
        cd.daysDiff !== null &&
        cd.daysDiff >= 0 &&
        cd.daysDiff <= 7 &&
        (c.next_action_type === 'דיון' || c.status === 'דיון קבוע')
      );
    }).length;

    const hearings30Days = activeCases.filter((c) => {
      const cd = getDueCountdown(c.next_due_date);
      return (
        cd.daysDiff !== null &&
        cd.daysDiff >= 0 &&
        cd.daysDiff <= 30 &&
        (c.next_action_type === 'דיון' ||
          c.status === 'דיון קבוע' ||
          Boolean(c.next_due_date))
      );
    }).length;

    const postponedHearings = activeCases.filter(
      (c) =>
        Boolean(c.is_hearing_postponed) ||
        c.status === 'דיון נדחה' ||
        c.next_action_type === 'דיון שנדחה' ||
        (Number(c.extensions_count) || 0) > 0
    ).length;

    // 6. עומס משימות ודחיפות לפי קטגוריה
    const byCategoryLoad = CASE_CATEGORIES.map((cat) => {
      const catCases = activeCases.filter((c) => c.category === cat);
      const urgentCount = catCases.filter((c) => {
        const hasUrgentMs = (c.milestones || []).some(
          (m) => m.status !== 'done' && m.urgency === 'דחוף מאוד'
        );
        return hasUrgentMs || isCaseOverdueOrAlert(c);
      }).length;
      const inProgressTasks = catCases.reduce(
        (sum, c) =>
          sum +
          (c.milestones || []).filter((m) => m.status === 'in_progress').length,
        0
      );
      return {
        category: cat,
        count: catCases.length,
        pct: Math.round((catCases.length / total) * 100),
        urgentCount,
        inProgressTasks,
      };
    });

    return {
      total: activeCases.length,
      overdueCount,
      overduePct: Math.round((overdueCount / total) * 100),
      onTimeCount,
      onTimePct: Math.round((onTimeCount / total) * 100),
      byDistrict,
      byStage,
      byDelivery,
      hearings: [
        {
          bucket: 'דיונים ב-7 הימים הקרובים' as HearingAnalyticsBucket,
          count: hearings7Days,
          pct: Math.round((hearings7Days / total) * 100),
          color: 'bg-amber-500',
        },
        {
          bucket: 'דיונים בחודש הקרוב' as HearingAnalyticsBucket,
          count: hearings30Days,
          pct: Math.round((hearings30Days / total) * 100),
          color: 'bg-blue-600',
        },
        {
          bucket: 'דיונים שנדחו' as HearingAnalyticsBucket,
          count: postponedHearings,
          pct: Math.round((postponedHearings / total) * 100),
          color: 'bg-rose-600',
        },
      ],
      byCategoryLoad,
    };
  }, [activeCases]);

  // סינון טבלת הדוח למטה לפי הלחיצות בתרשימים והפילטרים
  const biFilteredCases = useMemo(() => {
    return activeCases.filter((c) => {
      if (
        filterDistrict !== 'הכל' &&
        (c.district || 'מרכז') !== filterDistrict
      ) {
        return false;
      }
      if (filterCategory !== 'הכל' && c.category !== filterCategory) {
        return false;
      }
      if (
        filterStage !== 'הכל' &&
        classifyWorkflowStage(c) !== filterStage
      ) {
        return false;
      }
      if (filterOverdue === 'overdue' && !isCaseOverdueOrAlert(c)) {
        return false;
      }
      if (filterOverdue === 'on_time' && isCaseOverdueOrAlert(c)) {
        return false;
      }
      if (
        filterDelivery !== 'הכל' &&
        classifyDeliveryStatus(c) !== filterDelivery
      ) {
        return false;
      }
      if (filterHearingBucket !== 'הכל') {
        const cd = getDueCountdown(c.next_due_date);
        if (filterHearingBucket === 'דיונים ב-7 הימים הקרובים') {
          if (
            !(
              cd.daysDiff !== null &&
              cd.daysDiff >= 0 &&
              cd.daysDiff <= 7 &&
              (c.next_action_type === 'דיון' || c.status === 'דיון קבוע')
            )
          ) {
            return false;
          }
        } else if (filterHearingBucket === 'דיונים בחודש הקרוב') {
          if (!(cd.daysDiff !== null && cd.daysDiff >= 0 && cd.daysDiff <= 30)) {
            return false;
          }
        } else if (filterHearingBucket === 'דיונים שנדחו') {
          if (
            !(
              Boolean(c.is_hearing_postponed) ||
              c.status === 'דיון נדחה' ||
              c.next_action_type === 'דיון שנדחה' ||
              (Number(c.extensions_count) || 0) > 0
            )
          ) {
            return false;
          }
        }
      }
      if (dateFrom && (!c.next_due_date || c.next_due_date < dateFrom)) {
        return false;
      }
      if (dateTo && (!c.next_due_date || c.next_due_date > dateTo)) {
        return false;
      }
      return true;
    });
  }, [
    activeCases,
    filterDistrict,
    filterCategory,
    filterStage,
    filterOverdue,
    filterDelivery,
    filterHearingBucket,
    dateFrom,
    dateTo,
  ]);

  if (!isOpen) return null;

  const resetAllBiFilters = () => {
    setFilterDistrict('הכל');
    setFilterCategory('הכל');
    setFilterStage('הכל');
    setFilterOverdue('הכל');
    setFilterDelivery('הכל');
    setFilterHearingBucket('הכל');
    setDateFrom('');
    setDateTo('');
  };

  const handleBulkApplyDistrict = async () => {
    const updated = await bulkApplyDistrictToCases({
      district: bulkDistrictVal,
      scope:
        bulkDistrictScope === 'all'
          ? 'all'
          : bulkDistrictScope === 'category' && filterCategory !== 'הכל'
          ? 'category'
          : 'ids',
      target_category: filterCategory !== 'הכל' ? filterCategory : 'גבייה',
      target_ids: biFilteredCases.map((c) => c.id),
    });
    onCasesUpdated(updated);
    setBulkFeedback(
      `מחוז "${bulkDistrictVal}" הוחל בהצלחה על ${
        bulkDistrictScope === 'all'
          ? allCases.length
          : biFilteredCases.length
      } תיקים!`
    );
    setTimeout(() => setBulkFeedback(null), 3500);
  };

  const handleInlineDistrictChange = async (
    caseId: string,
    newDist: CaseDistrict
  ) => {
    const updated = await updateCaseItem(caseId, { district: newDist });
    onCasesUpdated(
      allCases.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const activeFilterSummary = [
    filterDistrict !== 'הכל' ? `מחוז: ${filterDistrict}` : null,
    filterCategory !== 'הכל' ? `קטגוריה: ${filterCategory}` : null,
    filterStage !== 'הכל' ? `שלב: ${filterStage}` : null,
    filterOverdue !== 'הכל'
      ? filterOverdue === 'overdue'
        ? 'סטטוס: באיחור/חריגה'
        : 'סטטוס: בזמן'
      : null,
    filterDelivery !== 'הכל' ? `מסירה: ${filterDelivery}` : null,
    filterHearingBucket !== 'הכל' ? filterHearingBucket : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div
      className="fixed inset-0 z-[65] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 no-print transition-all duration-200"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[1440px] bg-white rounded-2xl shadow-2xl border border-slate-300 flex flex-col h-[92dvh] overflow-hidden"
      >
        {/* שורת ניווט עליונה: מסך הבית > דוחות ותרשימים + חזרה למסך קודם */}
        <div className="px-4 py-2 bg-slate-800 text-slate-200 border-b border-slate-700 flex items-center justify-between text-xs font-bold shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="hover:text-white inline-flex items-center gap-1 text-sky-300 font-extrabold"
            >
              <Home className="w-3.5 h-3.5" />
              <span>מסך הבית</span>
            </button>
            <span className="text-slate-500">&gt;</span>
            <span className="text-white font-extrabold">
              דוחות ותרשימים (Smart BI Dashboard)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-extrabold inline-flex items-center gap-1 transition"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>חזרה למסך קודם</span>
          </button>
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0F172A] text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-inner">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold">
                מרכז דוחות, פילוחים ותרשימי BI — Smart Reports & Deep Analytics
              </h3>
              <p className="text-xs text-slate-300">
                לחץ על כל עמודה בגרפים או השתמש במסננים כדי לסנן מיד את טבלת הדוח למטה, לייצא לאקסל או להדפיס
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() =>
                quickExportFilteredCasesToXlsx(
                  biFilteredCases,
                  activeFilterSummary || 'דוח_BI_משרדי'
                )
              }
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>ייצוא דוח לאקסל (.xlsx) ({biFilteredCases.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCustomColumnsExport();
              }}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition"
            >
              בחירת עמודות
            </button>

            <button
              type="button"
              onClick={() =>
                onPrintBiReport(
                  biFilteredCases,
                  activeFilterSummary
                    ? `דוח BI מסונן (${activeFilterSummary})`
                    : 'דוח BI מלא — כלל התיקים הפעילים'
                )
              }
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>הדפסת דוח ({biFilteredCases.length})</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#F8FAFC]">
          {/* סרגל פילטרים חכם + החלה גורפת של מחוז */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-extrabold text-slate-900">
                  סינון חכם של הדוח והגרפים:
                </span>
                {activeFilterSummary && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-300">
                    {activeFilterSummary}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {bulkFeedback && (
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300">
                    ✓ {bulkFeedback}
                  </span>
                )}
                <button
                  type="button"
                  onClick={resetAllBiFilters}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold flex items-center gap-1 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  אפס פילטרים
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-0.5">
                  מחוז (District)
                </label>
                <select
                  value={filterDistrict}
                  onChange={(e) =>
                    setFilterDistrict(e.target.value as 'הכל' | CaseDistrict)
                  }
                  className="w-full p-2 text-xs rounded-xl border border-slate-300 bg-white font-extrabold text-slate-800"
                >
                  <option value="הכל">כל המחוזות</option>
                  {CASE_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      מחוז {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-0.5">
                  קטגוריה / תחום
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) =>
                    setFilterCategory(e.target.value as 'הכל' | CaseCategory)
                  }
                  className="w-full p-2 text-xs rounded-xl border border-slate-300 bg-white font-extrabold text-slate-800"
                >
                  <option value="הכל">כל 4 התחומים</option>
                  {CASE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-0.5">
                  שלב בתיק (Workflow)
                </label>
                <select
                  value={filterStage}
                  onChange={(e) =>
                    setFilterStage(
                      e.target.value as 'הכל' | WorkflowStageBucket
                    )
                  }
                  className="w-full p-2 text-xs rounded-xl border border-slate-300 bg-white font-extrabold text-slate-800"
                >
                  <option value="הכל">כל השלבים</option>
                  <option value="התראה">התראה</option>
                  <option value="מסירה">מסירה</option>
                  <option value="הגשה">הגשה</option>
                  <option value="דיון">דיון</option>
                  <option value="הסדר/סגירה">הסדר/סגירה</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-0.5">
                  איחור / עמידה ביעד
                </label>
                <select
                  value={filterOverdue}
                  onChange={(e) =>
                    setFilterOverdue(
                      e.target.value as 'הכל' | 'overdue' | 'on_time'
                    )
                  }
                  className="w-full p-2 text-xs rounded-xl border border-slate-300 bg-white font-extrabold text-slate-800"
                >
                  <option value="הכל">הכל</option>
                  <option value="overdue">באיחור / חריגת מועד</option>
                  <option value="on_time">בזמן (תקין)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-0.5">
                  מעקב מסירות (+30 יום)
                </label>
                <select
                  value={filterDelivery}
                  onChange={(e) =>
                    setFilterDelivery(e.target.value as 'הכל' | DeliveryBucket)
                  }
                  className="w-full p-2 text-xs rounded-xl border border-slate-300 bg-white font-extrabold text-slate-800"
                >
                  <option value="הכל">כל המסירות</option>
                  <option value="ממתין למסירה">ממתין למסירה</option>
                  <option value="נמסר (בתוך 30 יום)">נמסר (בתוך 30 יום)</option>
                  <option value='חלפו 30 יום — מוכן להוצל"פ/הגשה'>
                    חלפו 30 יום — להוצל&quot;פ
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-0.5">
                  מתאריך יעד
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full p-1.5 text-xs rounded-xl border border-slate-300 bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-600 mb-0.5">
                  עד תאריך יעד
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full p-1.5 text-xs rounded-xl border border-slate-300 bg-white font-bold"
                />
              </div>
            </div>

            {/* שורת החלה גורפת של מחוז */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <span className="font-extrabold text-slate-800">
                  החלה גורפת של שדה מחוז:
                </span>
                <select
                  value={bulkDistrictVal}
                  onChange={(e) =>
                    setBulkDistrictVal(e.target.value as CaseDistrict)
                  }
                  className="p-1.5 rounded-lg border border-slate-300 bg-white font-extrabold text-indigo-950"
                >
                  {CASE_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      מחוז {d}
                    </option>
                  ))}
                </select>
                <select
                  value={bulkDistrictScope}
                  onChange={(e) =>
                    setBulkDistrictScope(
                      e.target.value as 'filtered' | 'category' | 'all'
                    )
                  }
                  className="p-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                >
                  <option value="filtered">
                    על התיקים המסוננים כעת בדוח ({biFilteredCases.length})
                  </option>
                  <option value="all">
                    על כלל התיקים במערכת ({allCases.length})
                  </option>
                </select>
                <button
                  type="button"
                  onClick={handleBulkApplyDistrict}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold transition"
                >
                  החל מחוז כעת
                </button>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* 6 תרשימים ויזואליים עשירים (עם מספרים ואחוזים ולחיצה לסינון!)     */}
          {/* ================================================================ */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* תרשים 1: תיקים באיחור / חריגת מועד מול בזמן */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-red-600 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  1. תיקים באיחור / חריגת מועד
                </h4>
                <span className="text-xs font-bold text-slate-500">
                  סה&quot;כ {analytics.total} תיקים
                </span>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setFilterOverdue(
                      filterOverdue === 'overdue' ? 'הכל' : 'overdue'
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border text-right transition ${
                    filterOverdue === 'overdue'
                      ? 'bg-red-50 border-red-500 ring-2 ring-red-200'
                      : 'bg-slate-50/70 border-slate-200 hover:border-red-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                    <span className="text-red-800">
                      באיחור / חריגת מועד או מסירה +30 יום
                    </span>
                    <span className="text-red-700 font-mono">
                      {analytics.overdueCount} תיקים ({analytics.overduePct}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-600 rounded-full transition-all duration-300"
                      style={{ width: `${analytics.overduePct}%` }}
                    />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFilterOverdue(
                      filterOverdue === 'on_time' ? 'הכל' : 'on_time'
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border text-right transition ${
                    filterOverdue === 'on_time'
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200'
                      : 'bg-slate-50/70 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                    <span className="text-emerald-900">
                      בזמן — עומדים ביעדים
                    </span>
                    <span className="text-emerald-700 font-mono">
                      {analytics.onTimeCount} תיקים ({analytics.onTimePct}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${analytics.onTimePct}%` }}
                    />
                  </div>
                </button>
              </div>
            </div>

            {/* תרשים 2: פילוח לפי מחוזות (By District) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-indigo-600 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  2. פילוח לפי מחוזות (תיקים, דיונים ומשימות)
                </h4>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {analytics.byDistrict.map((d) => {
                  const active = filterDistrict === d.district;
                  return (
                    <button
                      key={d.district}
                      type="button"
                      onClick={() =>
                        setFilterDistrict(active ? 'הכל' : d.district)
                      }
                      className={`w-full p-1.5 rounded-lg border text-right transition ${
                        active
                          ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-300'
                          : 'bg-slate-50/60 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                        <span className="text-slate-900">
                          מחוז {d.district}{' '}
                          <span className="text-[11px] font-normal text-slate-500">
                            ({d.hearings} דיונים • {d.openTasks} משימות)
                          </span>
                        </span>
                        <span className="text-indigo-800 font-mono">
                          {d.count} ({d.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${Math.max(d.pct, d.count > 0 ? 6 : 0)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* תרשים 3: התפלגות לפי שלבי התיק (Workflow Stages) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-blue-600 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  3. התפלגות לפי שלבי התיק (צווארי בקבוק)
                </h4>
              </div>

              <div className="space-y-1.5">
                {analytics.byStage.map((s) => {
                  const active = filterStage === s.stage;
                  return (
                    <button
                      key={s.stage}
                      type="button"
                      onClick={() => setFilterStage(active ? 'הכל' : s.stage)}
                      className={`w-full p-2 rounded-lg border text-right transition ${
                        active
                          ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-300'
                          : 'bg-slate-50/60 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                        <span className="text-slate-900">שלב: {s.stage}</span>
                        <span className="text-blue-800 font-mono">
                          {s.count} תיקים ({s.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${Math.max(s.pct, s.count > 0 ? 6 : 0)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* תרשים 4: מעקב מסירות (Deliveries & 30-Day Rule) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-sky-600 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-sky-600" />
                  4. מעקב מסירות וכלל 30 הימים להוצל&quot;פ
                </h4>
              </div>

              <div className="space-y-2">
                {analytics.byDelivery.map((d) => {
                  const active = filterDelivery === d.bucket;
                  const isReady = d.bucket.includes('חלפו 30 יום');
                  return (
                    <button
                      key={d.bucket}
                      type="button"
                      onClick={() =>
                        setFilterDelivery(active ? 'הכל' : d.bucket)
                      }
                      className={`w-full p-2.5 rounded-xl border text-right transition ${
                        active
                          ? 'bg-sky-50 border-sky-500 ring-1 ring-sky-300'
                          : 'bg-slate-50/60 border-slate-200 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                        <span
                          className={
                            isReady ? 'text-red-800' : 'text-slate-900'
                          }
                        >
                          {d.bucket}
                        </span>
                        <span className="font-mono text-slate-800">
                          {d.count} ({d.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isReady ? 'bg-red-600' : 'bg-sky-600'
                          }`}
                          style={{ width: `${Math.max(d.pct, d.count > 0 ? 6 : 0)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* תרשים 5: לוח דיונים (Hearings Analytics) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-amber-500 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-amber-600" />
                  5. לוח דיונים ומועדים (7 ימים, חודש ונדחו)
                </h4>
              </div>

              <div className="space-y-2">
                {analytics.hearings.map((h) => {
                  const active = filterHearingBucket === h.bucket;
                  return (
                    <button
                      key={h.bucket}
                      type="button"
                      onClick={() =>
                        setFilterHearingBucket(active ? 'הכל' : h.bucket)
                      }
                      className={`w-full p-2.5 rounded-xl border text-right transition ${
                        active
                          ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-300'
                          : 'bg-slate-50/60 border-slate-200 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                        <span className="text-slate-900">{h.bucket}</span>
                        <span className="font-mono text-slate-800">
                          {h.count} תיקים ({h.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${h.color}`}
                          style={{ width: `${Math.max(h.pct, h.count > 0 ? 6 : 0)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* תרשים 6: עומס משימות ודחיפות לפי קטגוריה */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-emerald-600 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-emerald-600" />
                  6. עומס משימות ודחיפות לפי קטגוריה
                </h4>
              </div>

              <div className="space-y-1.5">
                {analytics.byCategoryLoad.map((c) => {
                  const active = filterCategory === c.category;
                  return (
                    <button
                      key={c.category}
                      type="button"
                      onClick={() =>
                        setFilterCategory(active ? 'הכל' : c.category)
                      }
                      className={`w-full p-2 rounded-xl border text-right transition ${
                        active
                          ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-300'
                          : 'bg-slate-50/60 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                        <span className="text-slate-900">
                          {c.category}{' '}
                          <span className="text-[11px] font-bold text-red-700">
                            ({c.urgentCount} דחופים • {c.inProgressTasks} במשימה)
                          </span>
                        </span>
                        <span className="font-mono text-emerald-900">
                          {c.count} ({c.pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full"
                          style={{ width: `${Math.max(c.pct, c.count > 0 ? 6 : 0)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* טבלת הדוח המסוננת החיה בתחתית מסך ה-BI                          */}
          {/* ================================================================ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold">
                  טבלת דוח מפורטת לפי הסינון בגרפים ({biFilteredCases.length}{' '}
                  תיקים)
                </span>
              </div>
              <span className="text-xs text-slate-300">
                ניתן לשנות מחוז ישירות מהטבלה או ללחוץ על שורה לפתיחת התיק
              </span>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-right border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 font-extrabold text-slate-800">
                    <th className="py-2.5 px-3">שם תיק / חייב</th>
                    <th className="py-2.5 px-3">מס׳ תיק</th>
                    <th className="py-2.5 px-3">קטגוריה</th>
                    <th className="py-2.5 px-3">מחוז (עריכה מהירה)</th>
                    <th className="py-2.5 px-3">שלב / סטטוס</th>
                    <th className="py-2.5 px-3">מעקב מסירה</th>
                    <th className="py-2.5 px-3">פעולה הבאה ויעד</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {biFilteredCases.map((c) => {
                    const overdue = isCaseOverdueOrAlert(c);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => {
                          onClose();
                          onSelectCase(c);
                        }}
                        className="hover:bg-blue-50/50 cursor-pointer transition"
                      >
                        <td className="py-2.5 px-3 font-extrabold text-slate-900">
                          {c.debtor_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                          {c.case_number || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {c.category}
                        </td>
                        <td
                          className="py-2.5 px-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            value={c.district || 'מרכז'}
                            onChange={(e) =>
                              handleInlineDistrictChange(
                                c.id,
                                e.target.value as CaseDistrict
                              )
                            }
                            className="p-1 rounded border border-slate-300 bg-white font-bold text-xs"
                          >
                            {CASE_DISTRICTS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800">
                            {classifyWorkflowStage(c)}
                          </span>{' '}
                          <span className="text-slate-500">({c.status})</span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">
                          {classifyDeliveryStatus(c)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900">
                            [{c.next_action_type}]
                          </span>{' '}
                          {c.next_action_description || ''}{' '}
                          {c.next_due_date && (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold ${
                                overdue
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {formatDateHe(c.next_due_date)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// מסך תפעול והרשאות למנהל (Admin Operations & Permissions Panel - v7.0):
// מוגן בסיסמת מנהל + מתגי הפעלה/נעילה (Toggle Switches) לקביעת מה פתוח ומה נעול לעובד רגיל
// + גיבוי מלא (JSON) ושחזור במיזוג בטוח (Non-Destructive)
// ============================================================================
interface ExecutiveSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession;
  workerPermissions: WorkerPermissionsConfig;
  onWorkerPermissionsChange: (next: WorkerPermissionsConfig) => void;
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

const PERMISSION_ITEMS: {
  key: keyof WorkerPermissionsConfig;
  title: string;
  description: string;
}[] = [
  {
    key: 'allowCustomFields',
    title: 'הוספת שדות מותאמים ותזכורות',
    description: 'מאפשר לעובד רגיל ליצור ולערוך שדות מעקב ותזכורות מותאמים בתיקים',
  },
  {
    key: 'allowEditStages',
    title: 'עריכת שלבי תיק ומשימות',
    description: 'מאפשר לעובד רגיל לשנות סטטוס, שלב בתיק ומשימות בצ׳ק-ליסט',
  },
  {
    key: 'allowEditFeesAndDebt',
    title: 'עריכת סכומי חוב ושכר טרחה',
    description: 'מאפשר לעובד רגיל לעדכן סכומי קרן, ריבית, הוצאות וסטטוס גביית שכ"ט',
  },
  {
    key: 'allowDeleteAndArchive',
    title: 'מחיקת / ארכוב תיקים',
    description: 'מאפשר לעובד רגיל להעביר תיקים לארכיון או למחוק תיקים ותרשומות',
  },
  {
    key: 'allowExportAndBackup',
    title: 'ייצוא וגיבוי נתונים',
    description: 'מאפשר לעובד רגיל לייצא דוחות לאקסל ולהוריד קובץ גיבוי JSON',
  },
];

export function ExecutiveSettingsModal({
  isOpen,
  onClose,
  currentUser,
  workerPermissions,
  onWorkerPermissionsChange,
  onToggleRoleQuick,
  onOpenUsersModal,
  onOpenMuniModal,
  onOpenCsvModal,
  onDataRestored,
}: ExecutiveSettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState<boolean>(
    currentUser.role === 'admin'
  );
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  if (!isOpen) return null;

  const handleUnlockAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminPassword(passwordInput)) {
      setAdminUnlocked(true);
      setPasswordError(false);
      setPasswordInput('');
    } else {
      setPasswordError(true);
    }
  };

  const handleTogglePermission = (key: keyof WorkerPermissionsConfig) => {
    if (!adminUnlocked) {
      alert('הזן סיסמת מנהל כדי לשנות מתגי הרשאות עובדים');
      return;
    }
    const updated: WorkerPermissionsConfig = {
      ...workerPermissions,
      [key]: !workerPermissions[key],
    };
    saveWorkerPermissions(updated);
    onWorkerPermissionsChange(updated);
  };

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
      className="fixed inset-0 z-[65] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 no-print transition-all duration-200"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90dvh] overflow-hidden"
      >
        {/* שורת ניווט עליונה: מסך הבית > מסך תפעול והרשאות למנהל + חזרה למסך קודם */}
        <div className="px-4 py-2 bg-slate-800 text-slate-200 border-b border-slate-700 flex items-center justify-between text-xs font-bold shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="hover:text-white inline-flex items-center gap-1 text-sky-300 font-extrabold"
            >
              <Home className="w-3.5 h-3.5" />
              <span>מסך הבית</span>
            </button>
            <span className="text-slate-500">&gt;</span>
            <span className="text-white font-extrabold">
              מסך תפעול והרשאות למנהל (Admin Operations Panel)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-extrabold inline-flex items-center gap-1 transition"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>חזרה למסך קודם</span>
          </button>
        </div>

        <div className="px-5 py-4 bg-[#0F172A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold">
                מסך תפעול והרשאות למנהל — Admin Operations Panel
              </h3>
              <p className="text-xs text-slate-300">
                מתגי הפעלה/נעילה לעובד רגיל, ניהול הרשאות וסיסמאות, גיבוי מלא (JSON) ושחזור בטוח
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

          {/* אימות סיסמת מנהל לפתיחת מתגי הניהול */}
          {!adminUnlocked ? (
            <form
              onSubmit={handleUnlockAdmin}
              className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-700" />
                  <span className="text-sm font-extrabold text-amber-950">
                    מסך תפעול מוגן בסיסמת מנהל — הזן סיסמת מנהל לפתיחת מתגי ההרשאות:
                  </span>
                </div>
                <span className="text-xs font-bold text-amber-800">
                  (סיסמת ברירת מחדל: 1234)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="הקלד סיסמת מנהל (1234)..."
                  className="flex-1 p-2.5 text-sm rounded-xl border border-amber-400 bg-white font-bold outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1.5"
                >
                  <Unlock className="w-4 h-4" />
                  פתח נעילת מנהל
                </button>
              </div>
              {passwordError && (
                <p className="text-xs font-extrabold text-red-600">
                  סיסמה שגויה. נסה שנית (ברירת מחדל: 1234).
                </p>
              )}
            </form>
          ) : (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-extrabold text-emerald-900">
                <Unlock className="w-4 h-4 text-emerald-600" />
                <span>מצב מנהל מערכת מאומת ופתוח לעריכת מתגי הרשאות</span>
              </div>
              <button
                type="button"
                onClick={() => setAdminUnlocked(false)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold"
              >
                נעל מסך מנהל
              </button>
            </div>
          )}

          {/* 1. מתגי הפעלה/נעילה לעובד רגיל (Toggle Switches) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h4 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  1. מתגי הפעלה / נעילה לעובד רגיל (Worker Permissions Toggles)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  קבע בלחיצה אילו פעולות פתוחות ואילו נעולות כאשר משתמש מחובר בתור עובד רגיל (user)
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleRoleQuick}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                  currentUser.role === 'admin'
                    ? 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-amber-100 text-amber-950 border-amber-300'
                }`}
              >
                תצוגה נוכחית: {currentUser.role === 'admin' ? 'מנהל (admin)' : 'עובד (user)'} — לחץ להחלפה
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {PERMISSION_ITEMS.map((item) => {
                const enabled = workerPermissions[item.key];
                return (
                  <div
                    key={item.key}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.description}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!adminUnlocked}
                      onClick={() => handleTogglePermission(item.key)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-2 transition shrink-0 ${
                        enabled
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      } ${!adminUnlocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {enabled ? (
                        <>
                          <Unlock className="w-3.5 h-3.5" />
                          <span>פתוח לעובד ✓</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>נעול לעובד 🔒</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. גיבוי מלא (JSON) ושחזור במיזוג בטוח */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#1E3A8A]" />
              <h4 className="text-sm font-extrabold text-slate-900">
                2. גיבוי ושחזור נתונים (Non-Destructive Data Safety)
              </h4>
            </div>

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

          {/* 3. משתמשים ותעריפי שכ"ט רשויות */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenUsersModal();
              }}
              className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-extrabold flex items-center justify-center gap-2 transition"
            >
              <Users className="w-4 h-4 text-[#1E3A8A]" />
              <span>ניהול משתמשים וסיסמאות</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMuniModal();
              }}
              className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-extrabold flex items-center justify-center gap-2 transition"
            >
              <Landmark className="w-4 h-4 text-[#1E3A8A]" />
              <span>הגדרות כללי שכ&quot;ט רשויות</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
