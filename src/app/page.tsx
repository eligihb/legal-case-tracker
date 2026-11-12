'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Scale,
  Plus,
  Upload,
  Search,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  RotateCcw,
  LogOut,
  Clock,
  FileText,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  UserCheck,
  Briefcase,
  Gavel,
  Landmark,
  Timer,
  Users,
  Printer,
  Home,
  Flame,
  ListChecks,
} from 'lucide-react';
import {
  CASE_STATUSES,
  CATEGORY_LABELS,
  CaseCategory,
  CaseItem,
  CaseStatus,
  MunicipalitySetting,
  NEXT_ACTION_TYPES,
  SystemUserAccount,
  UserSession,
} from '@/types/database';
import {
  addCaseLog,
  fetchAllCases,
  fetchMunicipalitiesSettings,
  fetchSystemUsers,
  getCurrentUserSession,
  isDemoAuthenticated,
  isLocalDemoMode,
  resetLocalSampleData,
  setCurrentUserSession,
  signOutDemo,
  updateCaseItem,
} from '@/lib/dataService';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  calculateTotalDebt,
  formatCurrencyILS,
  formatDateHe,
  getDueCountdown,
  isDeliveryOver30DaysAlert,
} from '@/lib/dateUtils';
import CaseDrawer from '@/components/CaseDrawer';
import NewCaseModal from '@/components/NewCaseModal';
import CsvImportModal from '@/components/CsvImportModal';
import MunicipalitiesSettingsModal from '@/components/MunicipalitiesSettingsModal';
import ExcelExportModal, {
  quickExportFilteredCasesToXlsx,
} from '@/components/ExcelExportModal';
import UsersManagementModal from '@/components/UsersManagementModal';
import CopyButton from '@/components/CopyButton';
import { APP_VERSION, APP_UPDATED_AT } from '@/lib/version';

type KpiCardType =
  | 'all'
  | 'upcoming_hearings'
  | 'postponed_hearings'
  | 'court_submissions'
  | 'trustee_report'
  | 'pending_requests'
  | 'urgent_tasks';

export default function DashboardPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [muniSettings, setMuniSettings] = useState<MunicipalitySetting[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUserAccount[]>([]);
  const [currentUser, setCurrentUser] = useState<UserSession>({
    username: 'admin',
    displayName: 'עו"ד מנהל מערכת',
    role: 'admin',
    loggedInAt: new Date().toISOString(),
  });
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isMuniModalOpen, setIsMuniModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [localMode, setLocalMode] = useState(true);

  // הפרדה אמיתית בין 4 עולמות התוכן — הלשונית הפעילה מסננת באמת את כל המסך!
  const [activeCategory, setActiveCategory] = useState<CaseCategory>('גבייה');
  const [kpiQuickFilter, setKpiQuickFilter] = useState<KpiCardType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // מסנני עמודות (Column Filters בראש כל עמודה בטבלה)
  const [colFilterDebtor, setColFilterDebtor] = useState('הכל');
  const [colFilterCaseOrGush, setColFilterCaseOrGush] = useState('הכל');
  const [colFilterStage, setColFilterStage] = useState('הכל');
  const [colFilterStatus, setColFilterStatus] = useState<'הכל' | CaseStatus>(
    'הכל'
  );
  const [colFilterMuniOrProject, setColFilterMuniOrProject] = useState('הכל');
  const [colFilterActionType, setColFilterActionType] = useState('הכל');
  const [colFilterUrgency, setColFilterUrgency] = useState('הכל');

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      setLoading(true);
      try {
        if (isSupabaseConfigured && supabase && !isLocalDemoMode()) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session && !isDemoAuthenticated()) {
            router.push('/login');
            return;
          }
        } else if (!isDemoAuthenticated()) {
          router.push('/login');
          return;
        }

        setLocalMode(isLocalDemoMode());
        setCurrentUser(getCurrentUserSession());
        const [loadedCases, loadedMunis, loadedUsers] = await Promise.all([
          fetchAllCases(),
          fetchMunicipalitiesSettings(),
          fetchSystemUsers(),
        ]);
        setCases(loadedCases);
        setMuniSettings(loadedMunis);
        setSystemUsers(loadedUsers);
      } catch (err) {
        console.error('Error loading cases:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoad();
  }, [router]);

  // איפוס מסנני עמודות בעת מעבר בין 4 הלשוניות הראשיות
  const handleSelectCategoryTab = (cat: CaseCategory) => {
    setActiveCategory(cat);
    setKpiQuickFilter('all');
    setColFilterDebtor('הכל');
    setColFilterCaseOrGush('הכל');
    setColFilterStage('הכל');
    setColFilterStatus('הכל');
    setColFilterMuniOrProject('הכל');
    setColFilterActionType('הכל');
    setColFilterUrgency('הכל');
  };

  // ספירת תיקים לכל אחת מ-4 הלשוניות הראשיות
  const categoryCounts = useMemo(() => {
    const counts: Record<CaseCategory, number> = {
      גבייה: 0,
      'חדל"פ': 0,
      חברות: 0,
      'חברה משכנת': 0,
    };
    for (const c of cases) {
      if (counts[c.category] !== undefined) {
        counts[c.category]++;
      }
    }
    return counts;
  }, [cases]);

  // התיקים השייכים אך ורק לעולם התוכן של הלשונית הפעילה כרגע
  const domainCases = useMemo(() => {
    return cases.filter((c) => c.category === activeCategory);
  }, [cases, activeCategory]);

  // פונקציות עזר לבדיקת התאמת תיק לכל אחד מ-6 כרטיסי הבקרה העליונים
  const isUpcomingHearingCase = (c: CaseItem) => {
    if (c.status === 'סגור') return false;
    const cd = getDueCountdown(c.next_due_date);
    return (
      c.next_action_type === 'דיון' ||
      c.status === 'דיון קבוע' ||
      (cd.daysDiff !== null && cd.daysDiff >= 0 && cd.daysDiff <= 14)
    );
  };

  const isPostponedHearingCase = (c: CaseItem) => {
    return (
      Boolean(c.is_hearing_postponed) ||
      c.status === 'דיון נדחה' ||
      c.next_action_type === 'דיון שנדחה' ||
      c.tags?.includes('דיון נדחה') ||
      (Number(c.extensions_count) || 0) > 0
    );
  };

  const isCourtSubmissionPendingCase = (c: CaseItem) => {
    return (
      c.status === 'הגשה ממתינה לביהמ"ש' ||
      c.next_action_type === 'הגשה לביהמ"ש' ||
      c.next_action_type === 'בקשת צו הבאה' ||
      c.next_action_type === 'תביעת חוב' ||
      c.next_action_type === 'פתיחת תביעה בהוצל"פ'
    );
  };

  const isTrusteeReportDueCase = (c: CaseItem) => {
    return (
      Boolean(c.trustee_report_due_date) ||
      c.next_action_type === 'דו"ח עדכון נאמן'
    );
  };

  const isPendingRequestCase = (c: CaseItem) => {
    return (
      c.next_action_type === 'בקשה ממתינה' ||
      c.status === 'ממתין להחלטה' ||
      c.next_action_type === 'העברת זכויות והנפקת אישור' ||
      c.next_action_type === 'שחרור עיקולים וסגירה'
    );
  };

  const isUrgentTaskCase = (c: CaseItem) => {
    if (c.status === 'סגור') return false;
    const cd = getDueCountdown(c.next_due_date);
    const d30 = isDeliveryOver30DaysAlert(c);
    const hasVeryUrgentMilestone = (c.milestones || []).some(
      (m) => m.status !== 'done' && m.urgency === 'דחוף מאוד'
    );
    return (
      (cd.daysDiff !== null && cd.daysDiff <= 2) ||
      d30.isAlert ||
      hasVeryUrgentMilestone
    );
  };

  // חישוב 6 כרטיסי הבקרה הלחיצים — מסוננים באמת ללשונית הפעילה!
  const kpiStats = useMemo(() => {
    let upcomingHearings = 0;
    let postponedHearings = 0;
    let totalExtensionsSum = 0;
    let courtSubmissions = 0;
    let trusteeReports = 0;
    let nearestTrusteeDays: number | null = null;
    let pendingRequests = 0;
    let urgentTasks = 0;

    for (const c of domainCases) {
      if (isUpcomingHearingCase(c)) upcomingHearings++;
      if (isPostponedHearingCase(c)) {
        postponedHearings++;
        totalExtensionsSum += Number(c.extensions_count) || 1;
      }
      if (isCourtSubmissionPendingCase(c)) courtSubmissions++;
      if (isTrusteeReportDueCase(c)) {
        trusteeReports++;
        if (c.trustee_report_due_date) {
          const cd = getDueCountdown(c.trustee_report_due_date);
          if (
            cd.daysDiff !== null &&
            (nearestTrusteeDays === null || cd.daysDiff < nearestTrusteeDays)
          ) {
            nearestTrusteeDays = cd.daysDiff;
          }
        }
      }
      if (isPendingRequestCase(c)) pendingRequests++;
      if (isUrgentTaskCase(c)) urgentTasks++;
    }

    return {
      upcomingHearings,
      postponedHearings,
      totalExtensionsSum,
      courtSubmissions,
      trusteeReports,
      nearestTrusteeDays,
      pendingRequests,
      urgentTasks,
    };
  }, [domainCases]);

  // רשימת משימות פעילות של אותו תחום בלבד (מסוננת ללשונית הפעילה)
  const domainActiveTasks = useMemo(() => {
    const list: {
      caseItem: CaseItem;
      milestoneTitle: string;
      urgency: string;
      daysSpent: number;
      plannedDays: number;
    }[] = [];

    for (const c of domainCases) {
      for (const m of c.milestones || []) {
        if (m.status === 'in_progress') {
          list.push({
            caseItem: c,
            milestoneTitle: m.title,
            urgency: m.urgency || 'רגילה',
            daysSpent: Number(m.days_spent) || 0,
            plannedDays: Number(m.planned_days) || 0,
          });
        }
      }
    }
    return list;
  }, [domainCases]);

  // ערכים ייחודיים עבור מסנני העמודות (Column Filters) של הלשונית הפעילה
  const columnFilterOptions = useMemo(() => {
    const debtors = Array.from(
      new Set(domainCases.map((c) => c.debtor_name))
    ).sort((a, b) => a.localeCompare(b, 'he'));
    const caseNumsAndGush = Array.from(
      new Set(
        domainCases
          .map((c) => c.case_number || c.gush_helka || '')
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'he'));
    const stages = Array.from(
      new Set(domainCases.map((c) => c.current_stage || c.status))
    ).sort((a, b) => a.localeCompare(b, 'he'));
    const munisOrProjects = Array.from(
      new Set(
        domainCases
          .map(
            (c) =>
              c.municipality ||
              c.housing_project_name ||
              c.insolvency_debtor_type ||
              c.company_resolution_decision ||
              ''
          )
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'he'));

    return { debtors, caseNumsAndGush, stages, munisOrProjects };
  }, [domainCases]);

  // סינון סופי של הטבלה לפי הלשונית הפעילה + כרטיס הבקרה + מסנני העמודות + חיפוש חופשי
  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return domainCases
      .filter((c) => {
        if (kpiQuickFilter === 'upcoming_hearings' && !isUpcomingHearingCase(c))
          return false;
        if (
          kpiQuickFilter === 'postponed_hearings' &&
          !isPostponedHearingCase(c)
        )
          return false;
        if (
          kpiQuickFilter === 'court_submissions' &&
          !isCourtSubmissionPendingCase(c)
        )
          return false;
        if (kpiQuickFilter === 'trustee_report' && !isTrusteeReportDueCase(c))
          return false;
        if (kpiQuickFilter === 'pending_requests' && !isPendingRequestCase(c))
          return false;
        if (kpiQuickFilter === 'urgent_tasks' && !isUrgentTaskCase(c))
          return false;

        // מסנני עמודות (Column Filters)
        if (colFilterDebtor !== 'הכל' && c.debtor_name !== colFilterDebtor)
          return false;
        if (
          colFilterCaseOrGush !== 'הכל' &&
          c.case_number !== colFilterCaseOrGush &&
          c.gush_helka !== colFilterCaseOrGush
        )
          return false;
        if (
          colFilterStage !== 'הכל' &&
          (c.current_stage || c.status) !== colFilterStage
        )
          return false;
        if (colFilterStatus !== 'הכל' && c.status !== colFilterStatus)
          return false;

        const muniOrProjVal =
          c.municipality ||
          c.housing_project_name ||
          c.insolvency_debtor_type ||
          c.company_resolution_decision ||
          '';
        if (
          colFilterMuniOrProject !== 'הכל' &&
          muniOrProjVal !== colFilterMuniOrProject
        )
          return false;

        if (
          colFilterActionType !== 'הכל' &&
          c.next_action_type !== colFilterActionType
        )
          return false;

        if (colFilterUrgency !== 'הכל') {
          const cd = getDueCountdown(c.next_due_date);
          if (
            colFilterUrgency === 'באיחור/היום' &&
            (cd.daysDiff === null || cd.daysDiff > 0)
          )
            return false;
          if (
            colFilterUrgency === 'השבוע' &&
            (cd.daysDiff === null || cd.daysDiff < 0 || cd.daysDiff > 7)
          )
            return false;
          if (colFilterUrgency === 'נדחה' && !isPostponedHearingCase(c))
            return false;
        }

        if (q) {
          const haystack = [
            c.debtor_name,
            c.id_or_hp,
            c.case_number,
            c.gush_helka || '',
            c.municipality || '',
            c.housing_project_name || '',
            c.current_stage || '',
            c.notes || '',
            c.next_action_description || '',
            c.next_action_type || '',
            c.trustee_name_and_contact || '',
            c.seller_buyer_names || '',
            ...(c.tags || []),
          ]
            .join(' ')
            .toLowerCase();

          if (!haystack.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.next_due_date && b.next_due_date) {
          return a.next_due_date.localeCompare(b.next_due_date);
        }
        if (a.next_due_date) return -1;
        if (b.next_due_date) return 1;
        return (b.updated_at || '').localeCompare(a.updated_at || '');
      });
  }, [
    domainCases,
    kpiQuickFilter,
    colFilterDebtor,
    colFilterCaseOrGush,
    colFilterStage,
    colFilterStatus,
    colFilterMuniOrProject,
    colFilterActionType,
    colFilterUrgency,
    searchQuery,
  ]);

  const handleMarkActionDone = async (
    e: React.MouseEvent,
    caseItem: CaseItem
  ) => {
    e.stopPropagation();
    try {
      const doneDesc =
        caseItem.next_action_description ||
        caseItem.next_action_type ||
        'משימת יעד';

      await addCaseLog({
        case_id: caseItem.id,
        log_type: 'פעולה שבוצעה',
        content: `סומן כבוצע: [${caseItem.next_action_type}] ${doneDesc}`,
        due_date: null,
        created_by: currentUser.displayName,
      });

      const updated = await updateCaseItem(caseItem.id, {
        next_due_date: null,
        next_action_description: '',
      });

      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (selectedCase?.id === updated.id) {
        setSelectedCase(updated);
      }
    } catch (err) {
      console.error('Failed to mark action done:', err);
    }
  };

  // החלפה מהירה בין הרשאת מנהל (admin) לעובד (user)
  const handleToggleRoleQuick = () => {
    const nextRole = currentUser.role === 'admin' ? 'user' : 'admin';
    const nextSession: UserSession = {
      username: nextRole === 'admin' ? 'admin' : 'daniel',
      displayName:
        nextRole === 'admin' ? 'עו"ד מנהל מערכת' : 'עו"ד דניאל כהן (עובד)',
      role: nextRole,
      loggedInAt: new Date().toISOString(),
    };
    setCurrentUserSession(nextSession);
    setCurrentUser(nextSession);
  };

  const handleResetDemo = () => {
    if (currentUser.role !== 'admin') {
      alert('רק מנהל מערכת (admin) רשאי לאפס נתונים');
      return;
    }
    if (
      !window.confirm('לאפס את הנתונים המקומיים לתיקי הדוגמה של 4 התחומים?')
    ) {
      return;
    }
    const {
      cases: resetCases,
      muniSettings: resetMunis,
      users: resetUsers,
    } = resetLocalSampleData();
    setCases(resetCases);
    setMuniSettings(resetMunis);
    setSystemUsers(resetUsers);
    setSelectedCase(null);
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    signOutDemo();
    router.push('/login');
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col bg-slate-50 dashboard-main-print-area"
    >
      {/* כותרת מיוחדת להדפסה ישירה (מוצגת רק בהדפסה) */}
      <div className="print-only border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold">
              דוח מערכת ניהול תיקים משפטיים — {CATEGORY_LABELS[activeCategory].title}
            </h1>
            <p className="text-sm text-slate-600">
              סה&quot;כ תיקים מוצגים לפי הסינון הנוכחי: {filteredCases.length} • הופק ע&quot;י:{' '}
              {currentUser.displayName} ({currentUser.role})
            </p>
          </div>
          <div className="text-sm font-bold">
            תאריך הדפסה: {new Date().toLocaleDateString('he-IL')}
          </div>
        </div>
      </div>

      {/* סרגל ניווט עליון (מוסתר בהדפסה) */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-sm no-print">
        <div className="max-w-[1540px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-inner">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  מערכת ניהול תיקים משפטיים — רשויות, חדל&quot;פ, חברות וחברה משכנת
                </h1>
                <span
                  title={`עודכן לאחרונה: ${APP_UPDATED_AT}`}
                  className="text-xs px-2.5 py-0.5 rounded-full font-extrabold font-mono bg-amber-400/20 text-amber-300 border border-amber-400/40"
                >
                  גרסה {APP_VERSION}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
                  {localMode
                    ? 'שמירה מיידית ב-LocalStorage ✓'
                    : 'מחובר ל-Supabase ✓'}
                </span>
              </div>
              <p className="text-xs text-slate-300 hidden sm:block">
                הפרדה מלאה בין 4 עולמות התוכן • חתימה אוטומטית: {currentUser.displayName} ({currentUser.role})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* מתג החלפת משתמש / הרשאה מהירה */}
            <button
              type="button"
              onClick={handleToggleRoleQuick}
              title="לחץ להחלפה מהירה בין תצוגת מנהל (admin) לתצוגת עובד (user)"
              className={`px-3 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 transition ${
                currentUser.role === 'admin'
                  ? 'bg-indigo-950 text-indigo-200 border-indigo-500/50 hover:bg-indigo-900'
                  : 'bg-slate-800 text-amber-200 border-amber-500/50 hover:bg-slate-700'
              }`}
            >
              {currentUser.role === 'admin' ? (
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
              ) : (
                <UserCheck className="w-4 h-4 text-amber-400" />
              )}
              <span>
                {currentUser.displayName} ({currentUser.role})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsUsersModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <Users className="w-4 h-4 text-indigo-400" />
              משתמשים וסיסמאות
            </button>

            <button
              type="button"
              onClick={() => setIsMuniModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
            >
              <Settings className="w-4 h-4" />
              הגדרות שכ&quot;ט רשויות
            </button>

            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              + תיק חדש
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 font-extrabold text-xs flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              הדפסה ישירה
            </button>

            <button
              type="button"
              onClick={() =>
                quickExportFilteredCasesToXlsx(
                  filteredCases,
                  CATEGORY_LABELS[activeCategory]?.shortTitle || activeCategory
                )
              }
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition"
              title="מייצא מיד את הנתונים המסוננים כרגע לקובץ אקסל (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              ייצוא לאקסל (.xlsx)
            </button>

            <button
              type="button"
              onClick={() => setIsCsvModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              ייבוא
            </button>

            {localMode && currentUser.role === 'admin' && (
              <button
                type="button"
                onClick={handleResetDemo}
                title="איפוס לנתוני הדוגמה של 4 התחומים (מנהל בלבד)"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              title="החלפת משתמש / התנתקות"
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-700 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1540px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* ==================================================================== */}
        {/* 1. ארבע לשוניות ראשיות פעילות (מסננות באמת את כל המסך לתחום הנבחר!) */}
        {/* ==================================================================== */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 no-print">
          {/* 1. תיקי רשויות (גבייה והוצל"פ) — כחול/אינדיגו */}
          <button
            type="button"
            onClick={() => handleSelectCategoryTab('גבייה')}
            className={`p-3 sm:p-4 rounded-2xl border-2 text-right transition flex items-center justify-between gap-2 ${
              activeCategory === 'גבייה'
                ? 'bg-gradient-to-l from-blue-700 to-indigo-700 text-white border-indigo-900 ring-4 ring-blue-200 shadow-lg'
                : 'bg-white text-blue-950 border-blue-300 hover:bg-blue-50/60'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-extrabold">
                <Landmark className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="truncate">1. רשויות (גבייה)</span>
              </div>
              <div
                className={`text-[11px] sm:text-xs mt-0.5 sm:mt-1 truncate ${
                  activeCategory === 'גבייה'
                    ? 'text-blue-100'
                    : 'text-slate-600'
                }`}
              >
                שכ&quot;ט, גח&quot;לת, +30 יום והסדרים
              </div>
            </div>
            <span
              className={`text-base sm:text-xl font-extrabold px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-xl shrink-0 ${
                activeCategory === 'גבייה'
                  ? 'bg-white/20 text-white'
                  : 'bg-blue-100 text-blue-900'
              }`}
            >
              {categoryCounts['גבייה']}
            </span>
          </button>

          {/* 2. תיקי חדל"פ (ייצוג נושה / פירוק) — סגול */}
          <button
            type="button"
            onClick={() => handleSelectCategoryTab('חדל"פ')}
            className={`p-3 sm:p-4 rounded-2xl border-2 text-right transition flex items-center justify-between gap-2 ${
              activeCategory === 'חדל"פ'
                ? 'bg-gradient-to-l from-purple-700 to-fuchsia-700 text-white border-purple-900 ring-4 ring-purple-200 shadow-lg'
                : 'bg-white text-purple-950 border-purple-300 hover:bg-purple-50/60'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-extrabold">
                <Gavel className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="truncate">2. תיקי חדל&quot;פ</span>
              </div>
              <div
                className={`text-[11px] sm:text-xs mt-0.5 sm:mt-1 truncate ${
                  activeCategory === 'חדל"פ'
                    ? 'text-purple-100'
                    : 'text-slate-600'
                }`}
              >
                נושה מהותי, תביעות חוב וחובות חדשים
              </div>
            </div>
            <span
              className={`text-base sm:text-xl font-extrabold px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-xl shrink-0 ${
                activeCategory === 'חדל"פ'
                  ? 'bg-white/20 text-white'
                  : 'bg-purple-100 text-purple-900'
              }`}
            >
              {categoryCounts['חדל"פ']}
            </span>
          </button>

          {/* 3. תיקי חברות (נאמן / מפרק) — טורקיז/אמרלד */}
          <button
            type="button"
            onClick={() => handleSelectCategoryTab('חברות')}
            className={`p-3 sm:p-4 rounded-2xl border-2 text-right transition flex items-center justify-between gap-2 ${
              activeCategory === 'חברות'
                ? 'bg-gradient-to-l from-emerald-700 to-teal-700 text-white border-emerald-900 ring-4 ring-emerald-200 shadow-lg'
                : 'bg-white text-emerald-950 border-emerald-300 hover:bg-emerald-50/60'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-extrabold">
                <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="truncate">3. תיקי חברות</span>
              </div>
              <div
                className={`text-[11px] sm:text-xs mt-0.5 sm:mt-1 truncate ${
                  activeCategory === 'חברות'
                    ? 'text-emerald-100'
                    : 'text-slate-600'
                }`}
              >
                התחייבות 100א׳, חקירות ודו&quot;ח נאמן
              </div>
            </div>
            <span
              className={`text-base sm:text-xl font-extrabold px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-xl shrink-0 ${
                activeCategory === 'חברות'
                  ? 'bg-white/20 text-white'
                  : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {categoryCounts['חברות']}
            </span>
          </button>

          {/* 4. חברה משכנת (רישום וזכויות) — ענבר/כתום */}
          <button
            type="button"
            onClick={() => handleSelectCategoryTab('חברה משכנת')}
            className={`p-3 sm:p-4 rounded-2xl border-2 text-right transition flex items-center justify-between gap-2 ${
              activeCategory === 'חברה משכנת'
                ? 'bg-gradient-to-l from-amber-600 to-orange-600 text-white border-amber-800 ring-4 ring-amber-200 shadow-lg'
                : 'bg-white text-amber-950 border-amber-300 hover:bg-amber-50/60'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-extrabold">
                <Home className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="truncate">4. חברה משכנת</span>
              </div>
              <div
                className={`text-[11px] sm:text-xs mt-0.5 sm:mt-1 truncate ${
                  activeCategory === 'חברה משכנת'
                    ? 'text-amber-100'
                    : 'text-slate-600'
                }`}
              >
                תצ&quot;רים, בית משותף והעברת זכויות
              </div>
            </div>
            <span
              className={`text-base sm:text-xl font-extrabold px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-xl shrink-0 ${
                activeCategory === 'חברה משכנת'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {categoryCounts['חברה משכנת']}
            </span>
          </button>
        </section>

        {/* ==================================================================== */}
        {/* 2. ששת כרטיסי המעקב הלחיצים בראש המסך (מסוננים לתחום הפעיל!)          */}
        {/* ==================================================================== */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 no-print">
          {/* כרטיס 1: דיונים קרובים */}
          <button
            type="button"
            onClick={() =>
              setKpiQuickFilter(
                kpiQuickFilter === 'upcoming_hearings'
                  ? 'all'
                  : 'upcoming_hearings'
              )
            }
            className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between ${
              kpiQuickFilter === 'upcoming_hearings'
                ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-200'
                : 'bg-white border-slate-200 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-slate-800">
                דיונים קרובים
              </span>
              <CalendarClock className="w-5 h-5 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-blue-700">
                {kpiStats.upcomingHearings}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                ומועדים קרובים
              </span>
            </div>
          </button>

          {/* כרטיס 2: דיונים שנדחו (עם סימון נדחה ומונה דחיות/ארכות) */}
          <button
            type="button"
            onClick={() =>
              setKpiQuickFilter(
                kpiQuickFilter === 'postponed_hearings'
                  ? 'all'
                  : 'postponed_hearings'
              )
            }
            className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between ${
              kpiQuickFilter === 'postponed_hearings'
                ? 'bg-rose-50 border-rose-600 ring-2 ring-rose-200'
                : 'bg-white border-slate-200 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-rose-900">
                דיונים שנדחו
              </span>
              <span className="px-2 py-0.5 text-xs font-extrabold rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                נדחה
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-rose-600">
                {kpiStats.postponedHearings}
              </span>
              <span className="text-xs font-bold text-rose-800">
                סה&quot;כ {kpiStats.totalExtensionsSum} דחיות/ארכות
              </span>
            </div>
          </button>

          {/* כרטיס 3: הגשות ממתינות לביהמ"ש */}
          <button
            type="button"
            onClick={() =>
              setKpiQuickFilter(
                kpiQuickFilter === 'court_submissions'
                  ? 'all'
                  : 'court_submissions'
              )
            }
            className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between ${
              kpiQuickFilter === 'court_submissions'
                ? 'bg-purple-50 border-purple-600 ring-2 ring-purple-200'
                : 'bg-white border-slate-200 hover:border-purple-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-purple-950">
                הגשות ממתינות לביהמ&quot;ש
              </span>
              <Gavel className="w-5 h-5 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-purple-700">
                {kpiStats.courtSubmissions}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                תביעות / בקשות
              </span>
            </div>
          </button>

          {/* כרטיס 4: עדכון דו"ח נאמן (עוד X ימים) */}
          <button
            type="button"
            onClick={() =>
              setKpiQuickFilter(
                kpiQuickFilter === 'trustee_report' ? 'all' : 'trustee_report'
              )
            }
            className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between ${
              kpiQuickFilter === 'trustee_report'
                ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-200'
                : 'bg-white border-slate-200 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-emerald-950">
                עדכון דו&quot;ח נאמן
              </span>
              <Timer className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-emerald-700">
                {kpiStats.trusteeReports}
              </span>
              <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                {kpiStats.nearestTrusteeDays !== null
                  ? `עוד ${kpiStats.nearestTrusteeDays} ימים`
                  : 'ללא מועד קרוב'}
              </span>
            </div>
          </button>

          {/* כרטיס 5: בקשות ממתינות */}
          <button
            type="button"
            onClick={() =>
              setKpiQuickFilter(
                kpiQuickFilter === 'pending_requests'
                  ? 'all'
                  : 'pending_requests'
              )
            }
            className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between ${
              kpiQuickFilter === 'pending_requests'
                ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-200'
                : 'bg-white border-slate-200 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-amber-950">
                בקשות ממתינות
              </span>
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-amber-600">
                {kpiStats.pendingRequests}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                ממתין לטיפול/אישור
              </span>
            </div>
          </button>

          {/* כרטיס 6: משימות דחופות */}
          <button
            type="button"
            onClick={() =>
              setKpiQuickFilter(
                kpiQuickFilter === 'urgent_tasks' ? 'all' : 'urgent_tasks'
              )
            }
            className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between ${
              kpiQuickFilter === 'urgent_tasks'
                ? 'bg-red-50 border-red-600 ring-2 ring-red-200'
                : 'bg-white border-red-200 hover:border-red-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-extrabold text-red-800">
                משימות דחופות
              </span>
              <Flame className="w-5 h-5 text-red-600" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-red-600">
                {kpiStats.urgentTasks}
              </span>
              <span className="text-xs font-bold text-red-700">
                דחוף מאוד / באיחור
              </span>
            </div>
          </button>
        </section>

        {/* סרגל משימות פעילות של התחום הנבחר בלבד (מסונן לפי הלשונית הפעילה) */}
        {domainActiveTasks.length > 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-2xs no-print">
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-extrabold text-slate-800">
                משימות בתהליך כעת ב-{CATEGORY_LABELS[activeCategory].shortTitle} (
                {domainActiveTasks.length}):
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {domainActiveTasks.map((t, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedCase(t.caseItem)}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-right text-sm flex items-center gap-2 transition"
                >
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-extrabold ${
                      t.urgency === 'דחוף מאוד'
                        ? 'bg-red-600 text-white'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {t.urgency}
                  </span>
                  <span className="font-extrabold text-slate-900">
                    {t.caseItem.debtor_name}:
                  </span>
                  <span className="text-slate-700 font-medium">
                    {t.milestoneTitle}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ==================================================================== */}
        {/* 3. סרגל חיפוש + כפתורי הדפסה ישירה וייצוא לאקסל מעל הטבלה            */}
        {/* ==================================================================== */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              <div className="relative flex-1 max-w-xl no-print">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`חיפוש מהיר ב${CATEGORY_LABELS[activeCategory].title} (שם, ת"ז/ח"פ, מספר תיק, גוש/חלקה)...`}
                  className="w-full pr-10 pl-4 py-2 text-[15px] rounded-xl border border-slate-300 bg-white focus:border-blue-600 outline-none font-medium"
                />
              </div>

              <div className="text-[15px] font-extrabold text-slate-800">
                {CATEGORY_LABELS[activeCategory].title} — מוצגים{' '}
                <span className="text-blue-700">{filteredCases.length}</span>{' '}
                מתוך {domainCases.length} תיקים בתחום זה
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap no-print">
              {(kpiQuickFilter !== 'all' ||
                colFilterDebtor !== 'הכל' ||
                colFilterCaseOrGush !== 'הכל' ||
                colFilterStage !== 'הכל' ||
                colFilterStatus !== 'הכל' ||
                colFilterMuniOrProject !== 'הכל' ||
                colFilterActionType !== 'הכל' ||
                colFilterUrgency !== 'הכל' ||
                searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setKpiQuickFilter('all');
                    setColFilterDebtor('הכל');
                    setColFilterCaseOrGush('הכל');
                    setColFilterStage('הכל');
                    setColFilterStatus('הכל');
                    setColFilterMuniOrProject('הכל');
                    setColFilterActionType('הכל');
                    setColFilterUrgency('הכל');
                    setSearchQuery('');
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-extrabold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition"
                >
                  נקה מסנני עמודות
                </button>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4 text-sky-300" />
                הדפסה ישירה
              </button>

              <button
                type="button"
                onClick={() =>
                  quickExportFilteredCasesToXlsx(
                    filteredCases,
                    CATEGORY_LABELS[activeCategory].shortTitle
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                ייצוא לאקסל (.xlsx) ({filteredCases.length})
              </button>

              <button
                type="button"
                onClick={() => setIsExcelModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition"
              >
                בחירת עמודות
              </button>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* 4. טבלה עם פונט מוגדל (15px-16px), סינון בכל עמודה והעתקה מהירה!   */}
          {/* ==================================================================== */}
          {loading ? (
            <div className="p-12 text-center text-base font-bold text-slate-500">
              טוען נתוני תיקים...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="text-base font-extrabold text-slate-700">
                לא נמצאו תיקים התואמים לסינון ב-{CATEGORY_LABELS[activeCategory].title}
              </div>
              <p className="text-sm text-slate-500">
                אפס את מסנני העמודות בראש הטבלה או הוסף תיק חדש לתחום זה.
              </p>
            </div>
          ) : (
            <>
              {/* תצוגת כרטיסים מותאמת ונוחה למובייל (ללא צורך בגלילה אופקית) */}
              <div className="md:hidden divide-y divide-slate-200">
                {filteredCases.map((c) => {
                  const countdown = getDueCountdown(c.next_due_date);
                  const totalDebt = calculateTotalDebt(c);
                  const d30 = isDeliveryOver30DaysAlert(c);
                  const postponed = isPostponedHearingCase(c);

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCase(c)}
                      className={`p-4 space-y-2.5 cursor-pointer transition ${
                        (countdown.urgency === 'overdue' && c.status !== 'סגור') ||
                        d30.isAlert
                          ? 'bg-red-50/40 active:bg-red-50'
                          : 'bg-white active:bg-blue-50/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-base">
                              {c.debtor_name}
                            </span>
                            <CopyButton
                              value={c.debtor_name}
                              label="העתק שם חייב"
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-slate-600 font-mono">
                            {c.id_or_hp && (
                              <span className="inline-flex items-center gap-1">
                                ת&quot;ז/ח&quot;פ: {c.id_or_hp}
                                <CopyButton
                                  value={c.id_or_hp}
                                  label="העתק ת״ז/ח״פ"
                                />
                              </span>
                            )}
                            {c.case_number && (
                              <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                                • תיק: {c.case_number}
                                <CopyButton
                                  value={c.case_number}
                                  label="העתק מספר תיק"
                                />
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-slate-100 text-slate-800 border border-slate-300 shrink-0">
                          {c.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          שלב: {c.current_stage || c.status}
                        </span>
                        {postponed && (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-extrabold">
                            נדחה ({c.extensions_count || 1})
                          </span>
                        )}
                        {c.category === 'גבייה' && c.municipality && (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-bold">
                            {c.municipality}
                          </span>
                        )}
                        {c.category === 'גבייה' && totalDebt > 0 && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-extrabold">
                            {formatCurrencyILS(totalDebt)}
                          </span>
                        )}
                        {c.category === 'חדל"פ' && c.is_material_creditor && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-700 text-white font-extrabold">
                            ★ נושה מהותי
                          </span>
                        )}
                      </div>

                      {d30.isAlert && (
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-extrabold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          חלפו 30 יום מאישור מסירה — לפתוח הוצל&quot;פ!
                        </div>
                      )}

                      <div className="text-sm font-bold text-slate-900 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <span className="inline-block ml-1.5 px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-extrabold">
                          {c.next_action_type}
                        </span>
                        {c.next_action_description || 'ללא פירוט'}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div>
                          {c.next_due_date ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                                countdown.urgency === 'overdue'
                                  ? 'bg-red-100 text-red-900 border border-red-300'
                                  : countdown.urgency === 'today'
                                  ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                  : 'bg-blue-50 text-blue-900 border border-blue-200'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              {countdown.label} ({formatDateHe(c.next_due_date)})
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">ללא מועד יעד</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {c.next_due_date && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkActionDone(e, c)}
                              className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title="סמן כבוצע"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCase(c);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-extrabold text-xs inline-flex items-center gap-1"
                          >
                            פתח תיק
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* תצוגת טבלה מלאה למסכי מחשב וטאבלט */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-100/90 text-[15px] font-extrabold text-slate-800">
                    {/* עמודה 1: שם חייב/תיק + ת"ז/ח"פ + סינון עמודה */}
                    <th className="py-3.5 px-4 align-top min-w-[240px]">
                      <div className="mb-1.5">שם חייב / חברה / פרויקט ות&quot;ז</div>
                      <select
                        value={colFilterDebtor}
                        onChange={(e) => setColFilterDebtor(e.target.value)}
                        className="no-print w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                      >
                        <option value="הכל">
                          סינון: כל השמות ({columnFilterOptions.debtors.length})
                        </option>
                        {columnFilterOptions.debtors.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </th>

                    {/* עמודה 2: מספר תיק וגוש/חלקה + סינון עמודה */}
                    <th className="py-3.5 px-3 align-top min-w-[210px]">
                      <div className="mb-1.5">מספר תיק וגוש/חלקה</div>
                      <select
                        value={colFilterCaseOrGush}
                        onChange={(e) => setColFilterCaseOrGush(e.target.value)}
                        className="no-print w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                      >
                        <option value="הכל">סינון: כל מספרי התיקים/גושים</option>
                        {columnFilterOptions.caseNumsAndGush.map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </th>

                    {/* עמודה 3: השלב הנוכחי בתיק וסטטוס + סינון עמודה */}
                    <th className="py-3.5 px-3 align-top min-w-[230px]">
                      <div className="mb-1.5">שלב נוכחי בתיק וסטטוס</div>
                      <div className="flex gap-1 no-print">
                        <select
                          value={colFilterStage}
                          onChange={(e) => setColFilterStage(e.target.value)}
                          className="w-1/2 p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                        >
                          <option value="הכל">כל השלבים</option>
                          {columnFilterOptions.stages.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <select
                          value={colFilterStatus}
                          onChange={(e) =>
                            setColFilterStatus(
                              e.target.value as 'הכל' | CaseStatus
                            )
                          }
                          className="w-1/2 p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                        >
                          <option value="הכל">כל הסטטוסים</option>
                          {CASE_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </th>

                    {/* עמודה 4: נתונים ייעודיים לתחום + סינון עמודה */}
                    <th className="py-3.5 px-3 align-top min-w-[220px]">
                      <div className="mb-1.5">
                        {activeCategory === 'גבייה'
                          ? 'רשות מקומית, גח"לת וחוב'
                          : activeCategory === 'חדל"פ'
                          ? 'נושה מהותי, נאמן ותביעת חוב'
                          : activeCategory === 'חברות'
                          ? 'התחייבות 100א׳, חקירה והכרעה'
                          : 'פרויקט, תצ"ר והעברת זכויות'}
                      </div>
                      <select
                        value={colFilterMuniOrProject}
                        onChange={(e) =>
                          setColFilterMuniOrProject(e.target.value)
                        }
                        className="no-print w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                      >
                        <option value="הכל">סינון: הכל</option>
                        {columnFilterOptions.munisOrProjects.map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </th>

                    {/* עמודה 5: הפעולה הבאה / משימות דחופות + סינון עמודה */}
                    <th className="py-3.5 px-4 align-top min-w-[260px]">
                      <div className="mb-1.5">הפעולה הבאה ומשימות בצ&apos;ק-ליסט</div>
                      <select
                        value={colFilterActionType}
                        onChange={(e) => setColFilterActionType(e.target.value)}
                        className="no-print w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                      >
                        <option value="הכל">סינון: כל סוגי הפעולות</option>
                        {NEXT_ACTION_TYPES.map((act) => (
                          <option key={act} value={act}>
                            {act}
                          </option>
                        ))}
                      </select>
                    </th>

                    {/* עמודה 6: מועד יעד, דחיות ודו"ח נאמן + סינון עמודה */}
                    <th className="py-3.5 px-3 align-top min-w-[175px]">
                      <div className="mb-1.5">מועד יעד ודחיפות</div>
                      <select
                        value={colFilterUrgency}
                        onChange={(e) => setColFilterUrgency(e.target.value)}
                        className="no-print w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                      >
                        <option value="הכל">סינון: כל המועדים</option>
                        <option value="באיחור/היום">באיחור או להיום</option>
                        <option value="השבוע">ב-7 הימים הקרובים</option>
                        <option value="נדחה">דיונים שנדחו / ארכות</option>
                      </select>
                    </th>

                    <th className="py-3.5 px-3 align-top text-left no-print">
                      תפעול
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-[15px] sm:text-[16px] leading-relaxed">
                  {filteredCases.map((c) => {
                    const countdown = getDueCountdown(c.next_due_date);
                    const totalDebt = calculateTotalDebt(c);
                    const d30 = isDeliveryOver30DaysAlert(c);
                    const postponed = isPostponedHearingCase(c);

                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCase(c)}
                        className={`cursor-pointer transition group ${
                          (countdown.urgency === 'overdue' &&
                            c.status !== 'סגור') ||
                          d30.isAlert
                            ? 'bg-red-50/35 hover:bg-red-50/70'
                            : 'hover:bg-blue-50/40'
                        }`}
                      >
                        {/* 1. שם חייב ות"ז/ח"פ עם כפתורי העתקה מהירה */}
                        <td className="py-4 px-4 align-top">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 text-base group-hover:text-blue-700">
                              {c.debtor_name}
                            </span>
                            <CopyButton
                              value={c.debtor_name}
                              label="העתק שם חייב"
                            />
                          </div>

                          {c.id_or_hp && (
                            <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-600 font-mono">
                              <span>ת&quot;ז/ח&quot;פ: {c.id_or_hp}</span>
                              <CopyButton
                                value={c.id_or_hp}
                                label="העתק ת״ז/ח״פ"
                              />
                            </div>
                          )}
                        </td>

                        {/* 2. מספר תיק וגוש/חלקה עם כפתורי העתקה מהירה */}
                        <td className="py-4 px-3 align-top">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-extrabold text-slate-900 text-[15px]">
                              {c.case_number || '—'}
                            </span>
                            <CopyButton
                              value={c.case_number}
                              label="העתק מספר תיק"
                            />
                          </div>

                          {(c.gush_helka || c.property_details) && (
                            <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-600">
                              <span className="truncate max-w-[180px]">
                                {c.gush_helka || c.property_details}
                              </span>
                              <CopyButton
                                value={c.gush_helka || c.property_details}
                                label="העתק גוש/חלקה"
                              />
                            </div>
                          )}
                        </td>

                        {/* 3. שלב נוכחי, סטטוס וסימון נדחה / מונה ארכות */}
                        <td className="py-4 px-3 align-top">
                          <div className="font-bold text-slate-900 text-[15px]">
                            {c.current_stage || c.status}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-slate-100 text-slate-800 border border-slate-300">
                              {c.status}
                            </span>
                            {postponed && (
                              <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-rose-100 text-rose-900 border border-rose-300">
                                נדחה ({c.extensions_count || 1} דחיות/ארכות)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. עמודה ייעודית לתחום התיק */}
                        <td className="py-4 px-3 align-top">
                          {c.category === 'גבייה' && (
                            <div className="space-y-1">
                              <div className="font-extrabold text-slate-900">
                                {c.municipality || '—'}
                              </div>
                              {totalDebt > 0 && (
                                <div className="text-sm font-extrabold text-blue-800">
                                  סה&quot;כ חוב: {formatCurrencyILS(totalDebt)}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {c.gachlat_status && (
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200">
                                    גח&quot;לת: {c.gachlat_status}
                                  </span>
                                )}
                                {c.has_property && (
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                                    נכס/משכון ✓
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {c.category === 'חדל"פ' && (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {c.is_material_creditor && (
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-700 text-white">
                                    ★ נושה מהותי
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200">
                                  {c.insolvency_debtor_type || 'חייב יחיד'}
                                </span>
                              </div>
                              {c.debt_claim_amount ? (
                                <div className="text-sm font-extrabold text-purple-900">
                                  תביעת חוב: {formatCurrencyILS(c.debt_claim_amount)}{' '}
                                  ({c.debt_claim_submitted ? 'הוגשה ✓' : 'טרם הוגשה!'})
                                </div>
                              ) : null}
                            </div>
                          )}

                          {c.category === 'חברות' && (
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1">
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-extrabold border ${
                                    c.self_undertaking_deposited
                                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                      : 'bg-red-100 text-red-900 border-red-300'
                                  }`}
                                >
                                  התחייבות 100א׳:{' '}
                                  {c.self_undertaking_deposited ? 'הופקדה ✓' : 'טרם!'}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-teal-50 text-teal-900 border border-teal-200">
                                  {c.company_resolution_decision || 'טרם הוכרע'}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-slate-700">
                                חקירה: {c.investigation_outcome || 'טרם נחקר'}
                              </div>
                            </div>
                          )}

                          {c.category === 'חברה משכנת' && (
                            <div className="space-y-1">
                              <div className="font-extrabold text-amber-950 text-sm">
                                {c.housing_project_name || 'פרויקט חברה משכנת'}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
                                  בית משותף: {c.condominium_registration_fit || 'בבדיקה'}
                                </span>
                                {c.parking_tazar_handled && (
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                                    תצ&quot;ר חניות ✓
                                  </span>
                                )}
                              </div>
                              {c.seller_buyer_names && (
                                <div className="text-xs text-slate-600 font-semibold truncate max-w-[220px]">
                                  {c.seller_buyer_names}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 5. הפעולה הבאה ומשימות */}
                        <td className="py-4 px-4 align-top max-w-md">
                          {d30.isAlert && (
                            <div className="mb-1.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-red-600 text-white text-xs font-extrabold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              חלפו 30 יום מאישור מסירה — לפתוח הוצל&quot;פ!
                            </div>
                          )}
                          <div className="font-bold text-slate-900 text-[15px]">
                            <span className="inline-block ml-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-extrabold">
                              {c.next_action_type}
                            </span>
                            {c.next_action_description || 'ללא פירוט'}
                          </div>
                          {c.notes && (
                            <div className="text-xs text-slate-500 truncate mt-1">
                              {c.notes}
                            </div>
                          )}
                        </td>

                        {/* 6. מועד יעד ודו"ח נאמן */}
                        <td className="py-4 px-3 align-top whitespace-nowrap">
                          {c.next_due_date ? (
                            <div>
                              <span
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold ${
                                  countdown.urgency === 'overdue'
                                    ? 'bg-red-100 text-red-900 border border-red-300'
                                    : countdown.urgency === 'today'
                                    ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                    : 'bg-blue-50 text-blue-900 border border-blue-200'
                                }`}
                              >
                                <Clock className="w-3.5 h-3.5" />
                                {countdown.label}
                              </span>
                              <div className="text-xs font-bold text-slate-600 mt-1 pr-1">
                                {formatDateHe(c.next_due_date)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">—</span>
                          )}

                          {c.trustee_report_due_date && (
                            <div className="mt-1 text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              דו&quot;ח נאמן: {getDueCountdown(c.trustee_report_due_date).label}
                            </div>
                          )}
                        </td>

                        {/* 7. כפתורי תפעול */}
                        <td className="py-4 px-3 align-top text-left whitespace-nowrap no-print">
                          <div className="inline-flex items-center gap-1.5">
                            {c.next_due_date && (
                              <button
                                type="button"
                                onClick={(e) => handleMarkActionDone(e, c)}
                                title="סמן פעולה כבוצעה בחתימתך"
                                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCase(c);
                              }}
                              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-extrabold text-xs transition inline-flex items-center gap-1"
                            >
                              תפעול תיק
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </section>
      </main>

      {/* חלון תפעול תיק (Zero-Scroll Tabs) */}
      <CaseDrawer
        caseItem={selectedCase}
        onClose={() => setSelectedCase(null)}
        onCaseUpdated={(updated) => {
          setCases((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
          );
        }}
        onCaseDeleted={(deletedId) => {
          setCases((prev) => prev.filter((c) => c.id !== deletedId));
          setSelectedCase(null);
        }}
        municipalitiesSettings={muniSettings}
        currentUser={currentUser}
        onOpenMuniSettingsModal={() => setIsMuniModalOpen(true)}
      />

      {/* ניהול משתמשים, הרשאות וסיסמאות */}
      <UsersManagementModal
        isOpen={isUsersModalOpen}
        onClose={() => setIsUsersModalOpen(false)}
        users={systemUsers}
        onUsersChanged={(nextUsers) => setSystemUsers(nextUsers)}
        isAdmin={currentUser.role === 'admin'}
      />

      {/* הגדרות שכר טרחה וכללים לפי רשות */}
      <MunicipalitiesSettingsModal
        isOpen={isMuniModalOpen}
        onClose={() => setIsMuniModalOpen(false)}
        settings={muniSettings}
        onSettingsChanged={(updatedList) => setMuniSettings(updatedList)}
        isAdmin={currentUser.role === 'admin'}
      />

      {/* חלונית ייצוא לאקסל (.xlsx) */}
      <ExcelExportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        allCases={cases}
        filteredCases={filteredCases}
      />

      {/* חלונית הוספת תיק חדש */}
      <NewCaseModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreated={(newCase) => {
          setCases((prev) => [newCase, ...prev]);
          setActiveCategory(newCase.category);
          setSelectedCase(newCase);
        }}
        municipalitiesSettings={muniSettings}
        defaultCategory={activeCategory}
      />

      {/* חלונית ייבוא CSV */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onImported={(newCases) => {
          setCases((prev) => [...newCases, ...prev]);
        }}
      />
    </div>
  );
}
