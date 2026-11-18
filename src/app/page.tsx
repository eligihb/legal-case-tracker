'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Scale,
  Plus,
  Search,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  LogOut,
  Clock,
  FileText,
  FileSpreadsheet,
  Briefcase,
  Gavel,
  Landmark,
  Printer,
  Home,
  Flame,
  ListChecks,
  Sparkles,
  BarChart3,
  Archive,
  RotateCcw,
  FolderKanban,
  Building2,
  MapPin,
  ShieldCheck,
  ArrowRight,
  Wallet,
  TrendingUp,
  ClipboardPaste,
  User,
} from 'lucide-react';
import {
  CASE_CATEGORIES,
  CASE_DISTRICTS,
  CASE_STATUSES,
  CATEGORY_LABELS,
  CaseCategory,
  CaseDistrict,
  CaseItem,
  CaseLog,
  CaseStatus,
  MunicipalitySetting,
  NEXT_ACTION_TYPES,
  SystemUserAccount,
  UserSession,
  WorkerPermissionsConfig,
} from '@/types/database';
import {
  DEFAULT_WORKER_PERMISSIONS,
  addCaseLog,
  fetchAllCases,
  fetchMunicipalitiesSettings,
  fetchSystemUsers,
  getCurrentUserSession,
  getWorkerPermissions,
  isDemoAuthenticated,
  isLocalDemoMode,
  setCurrentUserSession,
  signOutDemo,
  toggleArchiveCase,
  updateCaseItem,
} from '@/lib/dataService';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  calculateTotalDebt,
  formatCurrencyILS,
  formatDateHe,
  formatDateTimeHe,
  getDueCountdown,
  isDeliveryOver30DaysAlert,
} from '@/lib/dateUtils';
import CaseDrawer, { CasePrintZone, DrawerTab } from '@/components/CaseDrawer';
import NewCaseModal from '@/components/NewCaseModal';
import SmartPasteModal from '@/components/SmartPasteModal';
import CsvImportModal from '@/components/CsvImportModal';
import MunicipalitiesSettingsModal from '@/components/MunicipalitiesSettingsModal';
import ExcelExportModal, {
  quickExportFilteredCasesToXlsx,
} from '@/components/ExcelExportModal';
import UsersManagementModal from '@/components/UsersManagementModal';
import CopyButton from '@/components/CopyButton';
import {
  AddCustomFieldModal,
  InlineCustomFieldsList,
} from '@/components/CustomFieldsManager';
import {
  ExecutiveKpiType,
  ExecutiveSettingsModal,
  KpiDetailsModal,
  ReportsAndChartsModal,
  classifyDeliveryStatus,
  classifyWorkflowStage,
} from '@/components/ExecutiveModals';
import { APP_VERSION, APP_VERSION_NAME, APP_UPDATED_AT } from '@/lib/version';

type KpiCardType = 'all' | ExecutiveKpiType;
type ScreenMode = 'home' | 'cases';

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
  const [workerPermissions, setWorkerPermissions] =
    useState<WorkerPermissionsConfig>(DEFAULT_WORKER_PERMISSIONS);

  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [drawerInitialTab, setDrawerInitialTab] =
    useState<DrawerTab>('executive');

  // ניווט מסכים: מסך הבית (ללא טבלאות - Visual Dashboard Only) מול מסך תיקים/קטגוריה
  const [screenMode, setScreenMode] = useState<ScreenMode>('home');
  const [screenHistory, setScreenHistory] = useState<
    { mode: ScreenMode; category: CaseCategory | 'all' }[]
  >([]);
  const [casesViewCategory, setCasesViewCategory] = useState<
    CaseCategory | 'all'
  >('all');

  // חלונות מערכת (Modals)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSmartPasteOpen, setIsSmartPasteOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isMuniModalOpen, setIsMuniModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCustomFieldModalOpen, setIsCustomFieldModalOpen] = useState(false);
  const [customFieldTargetCase, setCustomFieldTargetCase] =
    useState<CaseItem | null>(null);
  const [activeKpiModal, setActiveKpiModal] =
    useState<ExecutiveKpiType | null>(null);

  const [customPrintList, setCustomPrintList] = useState<{
    cases: CaseItem[];
    title: string;
  } | null>(null);
  const [casePrintContext, setCasePrintContext] = useState<{
    caseData: CaseItem;
    logsData: CaseLog[];
    zone: CasePrintZone;
    activeTab: DrawerTab;
  } | null>(null);

  const [localMode, setLocalMode] = useState(true);

  const [activeCategory, setActiveCategory] = useState<CaseCategory>('גבייה');
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [kpiQuickFilter, setKpiQuickFilter] = useState<KpiCardType>('all');

  // חיפוש מרכזי במסך הבית (עם רשימת תוצאות קופצת) + חיפוש במסך התיקים
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // מסנני עמודות במסך התיקים
  const [colFilterDebtor, setColFilterDebtor] = useState('הכל');
  const [colFilterCaseOrGush, setColFilterCaseOrGush] = useState('הכל');
  const [colFilterDistrict, setColFilterDistrict] = useState<
    'הכל' | CaseDistrict
  >('הכל');
  const [colFilterStage, setColFilterStage] = useState('הכל');
  const [colFilterStatus, setColFilterStatus] = useState<'הכל' | CaseStatus>(
    'הכל'
  );
  const [colFilterMuniOrProject, setColFilterMuniOrProject] = useState('הכל');
  const [colFilterActionType, setColFilterActionType] = useState('הכל');
  const [colFilterUrgency, setColFilterUrgency] = useState('הכל');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

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
        setWorkerPermissions(getWorkerPermissions());
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

  const isWorker = currentUser.role === 'user';
  const canCustomFields = !isWorker || workerPermissions.allowCustomFields;
  const canEditStages = !isWorker || workerPermissions.allowEditStages;
  const canDeleteAndArchive =
    !isWorker || workerPermissions.allowDeleteAndArchive;
  const canExportAndBackup =
    !isWorker || workerPermissions.allowExportAndBackup;

  const resetColumnFilters = () => {
    setKpiQuickFilter('all');
    setColFilterDebtor('הכל');
    setColFilterCaseOrGush('הכל');
    setColFilterDistrict('הכל');
    setColFilterStage('הכל');
    setColFilterStatus('הכל');
    setColFilterMuniOrProject('הכל');
    setColFilterActionType('הכל');
    setColFilterUrgency('הכל');
  };

  // ניווט למסך הבית (Visual Dashboard Only)
  const handleGoHome = () => {
    resetColumnFilters();
    setSearchQuery('');
    setHomeSearchQuery('');
    setShowArchiveView(false);
    setSelectedCase(null);
    setActiveKpiModal(null);
    setIsReportsModalOpen(false);
    setIsSettingsModalOpen(false);
    setIsCustomFieldModalOpen(false);
    setCustomPrintList(null);
    setScreenMode('home');
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ניווט למסך תיקים של קטגוריה ספציפית או כלל התיקים
  const navigateToCasesScreen = (cat: CaseCategory | 'all') => {
    setScreenHistory((prev) => [
      ...prev,
      { mode: screenMode, category: casesViewCategory },
    ]);
    if (cat !== 'all') {
      setActiveCategory(cat);
    }
    setCasesViewCategory(cat);
    setShowArchiveView(false);
    resetColumnFilters();
    setScreenMode('cases');
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // כפתור חזרה למסך קודם
  const handleGoBack = () => {
    if (selectedCase) {
      setSelectedCase(null);
      return;
    }
    if (activeKpiModal) {
      setActiveKpiModal(null);
      return;
    }
    if (isReportsModalOpen) {
      setIsReportsModalOpen(false);
      return;
    }
    if (isSettingsModalOpen) {
      setIsSettingsModalOpen(false);
      return;
    }
    if (screenHistory.length > 0) {
      const last = screenHistory[screenHistory.length - 1];
      setScreenHistory((prev) => prev.slice(0, -1));
      setScreenMode(last.mode);
      setCasesViewCategory(last.category);
      if (last.category !== 'all') setActiveCategory(last.category);
    } else {
      handleGoHome();
    }
  };

  const activeCasesAllDomains = useMemo(
    () => cases.filter((c) => !c.is_archived),
    [cases]
  );
  const archivedCasesAllDomains = useMemo(
    () => cases.filter((c) => Boolean(c.is_archived)),
    [cases]
  );

  // תוצאות חיפוש מיידיות קופצות בראש מסך הבית (שם תיק / ת"ז חייב / מספר תיק / נושא — גם לתיקים ללא מספר תיק)
  const homeSearchResults = useMemo(() => {
    const q = homeSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return cases
      .filter((c) => {
        const hay = `${c.debtor_name} ${c.subject || ''} ${c.id_or_hp || ''} ${
          c.case_number || ''
        } ${c.gush_helka || ''} ${c.municipality || ''} ${
          c.notes || ''
        } ${c.next_action_description || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [cases, homeSearchQuery]);

  // פונקציות סיווג למדדים
  const isUpcomingHearingCase = (c: CaseItem) => {
    if (c.status === 'סגור' || c.is_archived) return false;
    const cd = getDueCountdown(c.next_due_date);
    return (
      c.next_action_type === 'דיון' ||
      c.status === 'דיון קבוע' ||
      (cd.daysDiff !== null && cd.daysDiff >= 0 && cd.daysDiff <= 14)
    );
  };

  const isPostponedHearingCase = (c: CaseItem) => {
    if (c.is_archived) return false;
    return (
      Boolean(c.is_hearing_postponed) ||
      c.status === 'דיון נדחה' ||
      c.next_action_type === 'דיון שנדחה' ||
      c.tags?.includes('דיון נדחה') ||
      (Number(c.extensions_count) || 0) > 0
    );
  };

  const isUrgentTaskCase = (c: CaseItem) => {
    if (c.status === 'סגור' || c.is_archived) return false;
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

  const isReminderTodayOrWeekCase = (c: CaseItem) => {
    if (c.status === 'סגור' || c.is_archived) return false;
    const cd = getDueCountdown(c.next_due_date);
    const hasCustomReminderDue = (c.custom_fields || []).some((cf) => {
      if (cf.is_done || !cf.due_date) return false;
      const rcd = getDueCountdown(cf.due_date);
      return rcd.daysDiff !== null && rcd.daysDiff <= 7;
    });
    return (
      (cd.daysDiff !== null && cd.daysDiff >= -1 && cd.daysDiff <= 7) ||
      hasCustomReminderDue
    );
  };

  const isCourtSubmissionPendingCase = (c: CaseItem) => {
    if (c.is_archived) return false;
    return (
      c.status === 'הגשה ממתינה לביהמ"ש' ||
      c.next_action_type === 'הגשה לביהמ"ש' ||
      c.next_action_type === 'תגובה' ||
      c.next_action_type === 'תשובה' ||
      c.next_action_type === 'בקשת צו הבאה' ||
      c.next_action_type === 'תביעת חוב' ||
      c.next_action_type === 'פתיחת תביעה בהוצל"פ' ||
      c.next_action_type === 'בקשה ממתינה' ||
      c.status === 'ממתין להחלטה'
    );
  };

  const isDelayedCase = (c: CaseItem) => {
    if (c.status === 'סגור' || c.is_archived) return false;
    const cd = getDueCountdown(c.next_due_date);
    const d30 = isDeliveryOver30DaysAlert(c);
    return (
      (cd.daysDiff !== null && cd.daysDiff < 0) ||
      d30.isAlert ||
      (Number(c.extensions_count) || 0) >= 2
    );
  };

  const isNetHaMishpatCase = (c: CaseItem) => {
    if (c.is_archived) return false;
    return (
      (c.net_hamishpat_status &&
        c.net_hamishpat_status !== 'ללא מעקב פעיל') ||
      c.status === 'ממתין להחלטה' ||
      c.status === 'הגשה ממתינה לביהמ"ש'
    );
  };

  // =========================================================================
  // חישוב מדדי מסך הבית (Visual Command Center Metrics)
  // =========================================================================
  const homeMetrics = useMemo(() => {
    const totalCasesCount = Math.max(1, activeCasesAllDomains.length);

    // 1. התקדמות כללית בכלל התיקים (שלבים ומשימות שהושלמו מול סה"כ)
    let totalMilestones = 0;
    let completedMilestones = 0;
    for (const c of cases) {
      const ms = c.milestones || [];
      totalMilestones += ms.length;
      completedMilestones += ms.filter((m) => m.status === 'done').length;
    }
    const overallProgressPct =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0;

    // 2. פילוח תיקים לפי 4 הקטגוריות
    const byCategory = CASE_CATEGORIES.map((cat) => {
      const catCases = activeCasesAllDomains.filter((c) => c.category === cat);
      return {
        category: cat,
        count: catCases.length,
        pct: Math.round((catCases.length / totalCasesCount) * 100),
      };
    });

    // 3. רשימות כרטיסי הבקרה
    const upcomingHearings = activeCasesAllDomains.filter(
      isUpcomingHearingCase
    );
    const postponedHearings = activeCasesAllDomains.filter(
      isPostponedHearingCase
    );
    const totalExtensionsSum = postponedHearings.reduce(
      (sum, c) => sum + (Number(c.extensions_count) || 1),
      0
    );
    const courtSubmissions = activeCasesAllDomains.filter(
      isCourtSubmissionPendingCase
    );
    const urgentTasks = activeCasesAllDomains.filter(isUrgentTaskCase);
    const delayedCases = activeCasesAllDomains.filter(isDelayedCase);
    const remindersWeek = activeCasesAllDomains.filter(
      isReminderTodayOrWeekCase
    );
    const netHaMishpatCases = activeCasesAllDomains.filter(isNetHaMishpatCase);

    // פילוח שלבי עבודה (Workflow Stages) לתרשים העומס בתחתית מסך הבית
    const stageBuckets: ('התראה' | 'מסירה' | 'הגשה' | 'דיון' | 'הסדר/סגירה')[] =
      ['התראה', 'מסירה', 'הגשה', 'דיון', 'הסדר/סגירה'];
    const byStage = stageBuckets.map((st) => {
      const cnt = activeCasesAllDomains.filter(
        (c) => classifyWorkflowStage(c) === st
      ).length;
      return {
        stage: st,
        count: cnt,
        pct: Math.round((cnt / totalCasesCount) * 100),
      };
    });

    // חישוב זמן היערכות לתגובות והגשות לביהמ"ש
    const avgPrepDays =
      courtSubmissions.length > 0
        ? Math.round(
            courtSubmissions.reduce(
              (s, c) => s + (Number(c.prep_days_needed) || 7),
              0
            ) / courtSubmissions.length
          )
        : 7;

    // 4. שכ"ט (שולם מול לא שולם)
    let paidCasesCount = 0;
    let unpaidCasesCount = 0;
    let paidAmountSum = 0;
    let unpaidAmountSum = 0;

    for (const c of activeCasesAllDomains) {
      const fee = Number(c.legal_fee_amount) || 4500;
      if (c.legal_fee_paid) {
        paidCasesCount++;
        paidAmountSum += fee;
      } else {
        unpaidCasesCount++;
        unpaidAmountSum += fee;
      }
    }
    const totalFeeSum = Math.max(1, paidAmountSum + unpaidAmountSum);
    const feePaidPct = Math.round((paidAmountSum / totalFeeSum) * 100);

    return {
      totalActiveCases: activeCasesAllDomains.length,
      totalArchivedCases: archivedCasesAllDomains.length,
      totalMilestones,
      completedMilestones,
      overallProgressPct,
      byCategory,
      upcomingHearings,
       upcomingPct: Math.round(
        (upcomingHearings.length / totalCasesCount) * 100
      ),
      postponedHearings,
      postponedPct: Math.round(
        (postponedHearings.length / totalCasesCount) * 100
      ),
      totalExtensionsSum,
      courtSubmissions,
      courtSubmissionsPct: Math.round(
        (courtSubmissions.length / totalCasesCount) * 100
      ),
      avgPrepDays,
      urgentTasks,
      urgentPct: Math.round((urgentTasks.length / totalCasesCount) * 100),
      netHaMishpatCases,
      netHaMishpatPct: Math.round(
        (netHaMishpatCases.length / totalCasesCount) * 100
      ),
      byStage,
      delayedCases,
      remindersWeek,
      paidCasesCount,
      unpaidCasesCount,
      paidAmountSum,
      unpaidAmountSum,
      feePaidPct,
    };
  }, [cases, activeCasesAllDomains, archivedCasesAllDomains]);

  // רשימות עבור KpiDetailsModal
  const kpiLists: Record<ExecutiveKpiType, CaseItem[]> = useMemo(
    () => ({
      overall_progress: activeCasesAllDomains,
      upcoming_hearings: homeMetrics.upcomingHearings,
      postponed_hearings: homeMetrics.postponedHearings,
      urgent_tasks: homeMetrics.urgentTasks,
      reminders_week: homeMetrics.remindersWeek,
      court_submissions: homeMetrics.courtSubmissions,
      net_hamishpat: homeMetrics.netHaMishpatCases,
      delayed_cases: homeMetrics.delayedCases,
      legal_fees: activeCasesAllDomains,
    }),
    [activeCasesAllDomains, homeMetrics]
  );

  // התיקים של מסך התיקים (כאשר screenMode === 'cases')
  const domainCases = useMemo(() => {
    if (showArchiveView) {
      return archivedCasesAllDomains;
    }
    if (casesViewCategory === 'all') {
      return activeCasesAllDomains;
    }
    return activeCasesAllDomains.filter(
      (c) => c.category === casesViewCategory
    );
  }, [
    showArchiveView,
    casesViewCategory,
    activeCasesAllDomains,
    archivedCasesAllDomains,
  ]);

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

  const filteredCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sourceCases = q
      ? showArchiveView
        ? archivedCasesAllDomains
        : activeCasesAllDomains
      : domainCases;

    return sourceCases
      .filter((c) => {
        if (
          kpiQuickFilter === 'upcoming_hearings' &&
          !isUpcomingHearingCase(c)
        )
          return false;
        if (
          kpiQuickFilter === 'postponed_hearings' &&
          !isPostponedHearingCase(c)
        )
          return false;
        if (kpiQuickFilter === 'urgent_tasks' && !isUrgentTaskCase(c))
          return false;
        if (
          kpiQuickFilter === 'reminders_week' &&
          !isReminderTodayOrWeekCase(c)
        )
          return false;
        if (
          kpiQuickFilter === 'court_submissions' &&
          !isCourtSubmissionPendingCase(c)
        )
          return false;
        if (kpiQuickFilter === 'net_hamishpat' && !isNetHaMishpatCase(c))
          return false;
        if (kpiQuickFilter === 'delayed_cases' && !isDelayedCase(c))
          return false;

        if (colFilterDebtor !== 'הכל' && c.debtor_name !== colFilterDebtor)
          return false;
        if (
          colFilterCaseOrGush !== 'הכל' &&
          c.case_number !== colFilterCaseOrGush &&
          c.gush_helka !== colFilterCaseOrGush
        )
          return false;
        if (
          colFilterDistrict !== 'הכל' &&
          (c.district || 'מרכז') !== colFilterDistrict
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
            c.category,
            c.district || 'מרכז',
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
            ...(c.custom_fields || []).map(
              (cf) => `${cf.label} ${String(cf.value || '')}`
            ),
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
    activeCasesAllDomains,
    archivedCasesAllDomains,
    showArchiveView,
    kpiQuickFilter,
    colFilterDebtor,
    colFilterCaseOrGush,
    colFilterDistrict,
    colFilterStage,
    colFilterStatus,
    colFilterMuniOrProject,
    colFilterActionType,
    colFilterUrgency,
    searchQuery,
  ]);

  const openCaseDrawer = (caseItem: CaseItem, preferredTab?: DrawerTab) => {
    const tab: DrawerTab = preferredTab || 'executive';
    setDrawerInitialTab(tab);
    setSelectedCase(caseItem);
  };

  const handleKpiCardClick = (type: ExecutiveKpiType) => {
    setActiveKpiModal(type);
  };

  const handleQuickStatusChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
    caseItem: CaseItem
  ) => {
    e.stopPropagation();
    if (!canEditStages) {
      alert('עריכת שלבי תיק וסטטוס נעולה לעובד רגיל (נקבע במסך תפעול למנהל).');
      return;
    }
    const newStatus = e.target.value as CaseStatus;
    try {
      const updated = await updateCaseItem(caseItem.id, {
        status: newStatus,
        is_hearing_postponed:
          newStatus === 'דיון נדחה' ? true : caseItem.is_hearing_postponed,
      });
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (selectedCase?.id === updated.id) {
        setSelectedCase(updated);
      }
    } catch (err) {
      console.error('Failed quick status change:', err);
    }
  };

  const handleQuickDistrictChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
    caseItem: CaseItem
  ) => {
    e.stopPropagation();
    const newDistrict = e.target.value as CaseDistrict;
    try {
      const updated = await updateCaseItem(caseItem.id, {
        district: newDistrict,
      });
      setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      if (selectedCase?.id === updated.id) {
        setSelectedCase(updated);
      }
    } catch (err) {
      console.error('Failed quick district change:', err);
    }
  };

  const handleToggleArchive = async (
    e: React.MouseEvent | null,
    caseItem: CaseItem
  ) => {
    if (e) e.stopPropagation();
    if (!canDeleteAndArchive) {
      alert('ארכוב ומחיקת תיקים נעולים לעובד רגיל (נקבע במסך תפעול למנהל).');
      return;
    }
    const nextArchived = !caseItem.is_archived;
    try {
      const updatedList = await toggleArchiveCase(caseItem.id, nextArchived);
      setCases(updatedList);
      const refreshed = updatedList.find((c) => c.id === caseItem.id);
      if (selectedCase?.id === caseItem.id && refreshed) {
        setSelectedCase(refreshed);
      }
    } catch (err) {
      console.error('Archive toggle error:', err);
    }
  };

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

  const handleOpenCustomFieldModal = (target?: CaseItem | null) => {
    if (!canCustomFields) {
      alert(
        'הוספת שדות מותאמים נעולה לעובד רגיל (ניתן לפתוח במסך תפעול והרשאות למנהל).'
      );
      return;
    }
    setCustomFieldTargetCase(target || null);
    setIsCustomFieldModalOpen(true);
  };

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

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    signOutDemo();
    router.push('/login');
  };

  const triggerPrintWithList = (list: CaseItem[], title: string) => {
    setCustomPrintList({ cases: list, title });
    setTimeout(() => {
      window.print();
      setTimeout(() => setCustomPrintList(null), 500);
    }, 100);
  };

  const kpiModalMeta: Record<
    ExecutiveKpiType,
    { title: string; subtitle: string }
  > = {
    overall_progress: {
      title: 'התקדמות כללית בכלל התיקים הפעילים',
      subtitle: `סה"כ ${homeMetrics.completedMilestones} מתוך ${homeMetrics.totalMilestones} משימות ושלבים הושלמו (${homeMetrics.overallProgressPct}%)`,
    },
    upcoming_hearings: {
      title: 'דיונים קרובים ומועדים קבועים',
      subtitle: 'כל התיקים עם מועד דיון קרוב או יעד ב-14 הימים הקרובים',
    },
    postponed_hearings: {
      title: 'דיונים שנדחו / בוטלו ומעקב ארכות',
      subtitle: `תיקים שבהם נדחה דיון או נרשמה בקשת ארכה (סה"כ ${homeMetrics.totalExtensionsSum} דחיות/ארכות)`,
    },
    urgent_tasks: {
      title: 'משימות דחופות לטיפול מיידי',
      subtitle: 'תיקים עם משימה בדחיפות גבוהה מאוד, יעד ל-48 שעות הקרובות או התראת 30 יום',
    },
    reminders_week: {
      title: 'תזכורות להיום והשבוע הקרוב',
      subtitle: 'כל התזכורות, המועדים ודוחות הנאמן ל-7 הימים הקרובים',
    },
    court_submissions: {
      title: 'הגשות ותגובות לביהמ"ש / נט המשפט (כולל ימי היערכות מראש)',
      subtitle: `תביעות חוב, תגובות, בקשות צו הבאה והגשות ממתינות • זמן היערכות ממוצע: ${homeMetrics.avgPrepDays} ימים`,
    },
    net_hamishpat: {
      title: 'מעקב נט המשפט והחלטות ממתינות',
      subtitle:
        'תיקים הממתינים להחלטת שופט/רשם, הוגשה בקשה בנט המשפט, נדרשת תגובת צד שכנגד או התקבלה החלטה',
    },
    delayed_cases: {
      title: 'תיקים באיחור / חריגת מועד',
      subtitle: 'תיקים שחרגו מתאריך היעד, חלפו 30 יום מאישור מסירה או צברו דחיות חוזרות',
    },
    legal_fees: {
      title: 'מעקב גביית שכר טרחה (שולם מול לא שולם)',
      subtitle: `שולם: ${formatCurrencyILS(
        homeMetrics.paidAmountSum
      )} (${homeMetrics.paidCasesCount} תיקים) • טרם שולם: ${formatCurrencyILS(
        homeMetrics.unpaidAmountSum
      )} (${homeMetrics.unpaidCasesCount} תיקים) — לחץ על שורה או סמן שולם`,
    },
  };

  const printCasesToRender = customPrintList
    ? customPrintList.cases
    : screenMode === 'home'
    ? activeCasesAllDomains
    : filteredCases;
  const printTitleToRender = customPrintList
    ? customPrintList.title
    : screenMode === 'home'
    ? 'דוח ריכוז מנהלים — כלל התיקים הפעילים'
    : showArchiveView
    ? 'דוח תיקים שהושלמו / ארכיון'
    : casesViewCategory === 'all'
    ? 'דוח כלל התיקים במערכת'
    : `דוח ${CATEGORY_LABELS[casesViewCategory].title}`;

  const currentScreenTitle =
    screenMode === 'home'
      ? 'מבט-על ניהולי (Executive Command Center)'
      : showArchiveView
      ? 'ארכיון תיקים שהושלמו'
      : casesViewCategory === 'all'
      ? 'כל התיקים במערכת'
      : CATEGORY_LABELS[casesViewCategory].title;

  return (
    <>
      <div
        id="app-shell"
        dir="rtl"
        className="h-dvh flex flex-col overflow-hidden bg-[#F8FAFC] text-slate-900 transition-all duration-200"
      >
        {/* ================================================================== */}
        {/* רצועה 1 — סרגל פעולה וחיפוש חכם (למעלה):                            */}
        {/* שורת חיפוש רחבה עם זכוכית מגדלת בלבד | + הזנה מהירה / תיק חדש |    */}
        {/* קליטה ממייל / נט המשפט | דוחות וגרפים | שלום + משתמש | ניהול | מדפסת */}
        {/* ================================================================== */}
        <header className="shrink-0 z-30 bg-[#0F172A] text-white border-b border-slate-800 shadow-md">
          <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            {/* צד ימין: מסך הבית + חזרה + שורת חיפוש חכם רחבה עם זכוכית מגדלת בלבד */}
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <button
                type="button"
                onClick={handleGoHome}
                title="מסך הבית — מבט-על ניהולי"
                className={`px-3 py-2 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-1.5 border shrink-0 transition ${
                  screenMode === 'home'
                    ? 'bg-blue-600 text-white border-blue-400 shadow-xs'
                    : 'bg-slate-800 hover:bg-blue-600 text-white border-slate-700'
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">מסך הבית</span>
              </button>

              {screenMode !== 'home' && (
                <button
                  type="button"
                  onClick={handleGoBack}
                  title="חזרה למסך קודם"
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-extrabold flex items-center gap-1 shrink-0 transition"
                >
                  <ArrowRight className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="hidden md:inline">חזרה</span>
                </button>
              )}

              {/* שורת חיפוש חכמה רחבה עם אייקון זכוכית מגדלת בלבד */}
              <div className="relative flex-1 max-w-xl">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  aria-label="חיפוש לפי שם, ת״ז, מספר תיק או נושא"
                  value={homeSearchQuery}
                  onChange={(e) => setHomeSearchQuery(e.target.value)}
                  placeholder="חיפוש לפי שם, ת״ז, מספר תיק או נושא..."
                  className="w-full pr-10 pl-8 py-2 text-xs sm:text-sm rounded-xl bg-white text-slate-900 placeholder-slate-400 font-bold shadow-inner border border-slate-200 focus:border-blue-400 outline-none"
                />
                {homeSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setHomeSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400 hover:text-slate-700"
                  >
                    ✕
                  </button>
                )}

                {/* רשימת תוצאות קופצת שלחיצה עליה פותחת מיד את כרטיס התיק */}
                {homeSearchQuery.trim() !== '' && (
                  <div className="absolute right-0 left-0 top-full mt-1.5 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {homeSearchResults.length === 0 ? (
                      <div className="p-4 text-center text-xs font-bold text-slate-500">
                        לא נמצאו תיקים התואמים ל-&quot;{homeSearchQuery}&quot;
                      </div>
                    ) : (
                      homeSearchResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setHomeSearchQuery('');
                            openCaseDrawer(c);
                          }}
                          className="w-full p-3 hover:bg-blue-50 text-right flex items-center justify-between gap-2 transition"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-100 text-blue-900">
                                {c.category}
                              </span>
                              <span className="font-extrabold text-slate-900 text-sm">
                                {c.debtor_name}
                              </span>
                              {c.subject && (
                                <span className="text-xs text-slate-600 font-bold">
                                  • {c.subject}
                                </span>
                              )}
                              {c.case_number ? (
                                <span className="text-xs font-mono font-bold text-slate-700">
                                  ({c.case_number})
                                </span>
                              ) : (
                                <span className="text-[11px] text-amber-700 font-bold">
                                  (ללא מס׳ תיק)
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-[#0F172A] text-white text-xs font-extrabold shrink-0">
                            פתח תיק ➔
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* מרכז ושמאל: + הזנה מהירה / תיק חדש | קליטה ממייל / נט המשפט | דוחות וגרפים | שלום + משתמש | ניהול | מדפסת */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* כפתור ראשי בולט: + הזנה מהירה / תיק חדש */}
              <button
                type="button"
                onClick={() => setIsNewModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>+ הזנה מהירה / תיק חדש</span>
              </button>

              {/* כפתור קליטה ממייל / נט המשפט */}
              <button
                type="button"
                onClick={() => setIsSmartPasteOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white border border-blue-400/40 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition"
              >
                <ClipboardPaste className="w-4 h-4 shrink-0" />
                <span>קליטה ממייל / נט המשפט</span>
              </button>

              {/* כפתור דוחות וגרפים */}
              <button
                type="button"
                onClick={() => setIsReportsModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-xs transition"
              >
                <BarChart3 className="w-4 h-4 text-sky-200 shrink-0" />
                <span>דוחות וגרפים</span>
              </button>

              <div className="h-6 w-px bg-slate-700 hidden lg:block" />

              {/* ברכת שלום + שם משתמש (לחיצה להחלפת תפקיד מהירה + ניתוק) */}
              <div className="inline-flex items-center rounded-xl bg-slate-800 border border-slate-700 overflow-hidden">
                <button
                  type="button"
                  onClick={handleToggleRoleQuick}
                  title="לחץ להחלפה מהירה בין תצוגת מנהל לעובד"
                  className="px-2.5 py-1.5 text-xs font-extrabold text-slate-200 hover:text-white flex items-center gap-1.5 transition"
                >
                  <User className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>שלום, {currentUser.displayName}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="התנתקות"
                  className="px-2 py-1.5 bg-slate-900/60 hover:bg-red-950/70 text-slate-400 hover:text-red-300 border-r border-slate-700 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* כפתור ניהול */}
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition"
                title="ניהול מערכת, הרשאות, גיבוי ושחזור"
              >
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>ניהול</span>
              </button>

              {/* אייקון מדפסת (Printer) */}
              <button
                type="button"
                onClick={() => window.print()}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-600 transition"
                title="הדפס / שמור כ-PDF את המסך הנוכחי"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ================================================================== */}
        {/* גוף האפליקציה (Zero-Scroll במסך הבית — 3 רצועות נקיות בגובה מסך אחד) */}
        {/* ================================================================== */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 pb-20 md:pb-4 max-w-[1600px] w-full mx-auto flex flex-col justify-between transition-all duration-200"
        >
          {screenMode === 'home' ? (
            <div className="flex-1 flex flex-col justify-between gap-3 min-h-0">
              {/* ============================================================ */}
              {/* רצועה 2 — הדופק היומי (השורה החשובה ביותר, מיד מתחת לחיפוש): */}
              {/* 5 כרטיסי פעולה חיים עם אייקונים וגרפים קטנים (Sparklines / מד אחוזים) */}
              {/* ============================================================ */}
              <section className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      הדופק היומי — מוקדי פעולה ומועדים חיים
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <span>
                      סה&quot;כ תיקים פעילים:{' '}
                      <strong className="text-slate-900">
                        {homeMetrics.totalActiveCases}
                      </strong>
                    </span>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => navigateToCasesScreen('all')}
                      className="text-blue-700 hover:underline font-extrabold"
                    >
                      הצג את כל התיקים ➔
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* 1. דיונים קרובים (השבוע / 14 יום הקרובים) */}
                  <button
                    type="button"
                    onClick={() => handleKpiCardClick('upcoming_hearings')}
                    className="p-4 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-amber-500 hover:shadow-md text-right transition flex flex-col justify-between space-y-2.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900 group-hover:text-amber-700">
                        דיונים קרובים
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                        <CalendarClock className="w-4 h-4 text-amber-600" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-extrabold text-amber-600">
                          {homeMetrics.upcomingHearings.length}
                        </span>
                        <span className="text-[11px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          14 יום הקרובים
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{
                            width: `${Math.max(homeMetrics.upcomingPct, 8)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>{homeMetrics.upcomingPct}% מהתיקים</span>
                      <span className="text-amber-700 font-extrabold">
                        פתח מסך ➔
                      </span>
                    </div>
                  </button>

                  {/* 2. דיונים שנדחו / בוטלו (כולל מעקב היסטוריה) */}
                  <button
                    type="button"
                    onClick={() => handleKpiCardClick('postponed_hearings')}
                    className="p-4 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-rose-500 hover:shadow-md text-right transition flex flex-col justify-between space-y-2.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900 group-hover:text-rose-700">
                        דיונים שנדחו / בוטלו
                      </span>
                      <span className="px-2 py-0.5 text-[11px] font-extrabold rounded-lg bg-rose-100 text-rose-800 border border-rose-300">
                        נדחה
                      </span>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-extrabold text-rose-600">
                          {homeMetrics.postponedHearings.length}
                        </span>
                        <span className="text-[11px] font-extrabold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          {homeMetrics.totalExtensionsSum} דחיות בהיסטוריה
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{
                            width: `${Math.max(homeMetrics.postponedPct, 8)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>מעקב היסטוריה וסיבות</span>
                      <span className="text-rose-700 font-extrabold">
                        פתח מסך ➔
                      </span>
                    </div>
                  </button>

                  {/* 3. הגשות ותגובות לביהמ"ש / נט המשפט (כולל ימי היערכות מראש) */}
                  <button
                    type="button"
                    onClick={() => handleKpiCardClick('court_submissions')}
                    className="p-4 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-purple-600 hover:shadow-md text-right transition flex flex-col justify-between space-y-2.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900 group-hover:text-purple-700">
                        הגשות ותגובות לביהמ&quot;ש
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-purple-600" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-extrabold text-purple-700">
                          {homeMetrics.courtSubmissions.length}
                        </span>
                        <span className="text-[11px] font-extrabold text-purple-900 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-300">
                          היערכות: {homeMetrics.avgPrepDays} ימים מראש
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-purple-600 rounded-full"
                          style={{
                            width: `${Math.max(
                              homeMetrics.courtSubmissionsPct,
                              8
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>תגובות, תביעות חוב ובקשות</span>
                      <span className="text-purple-700 font-extrabold">
                        פתח מסך ➔
                      </span>
                    </div>
                  </button>

                  {/* 4. משימות דחופות ואיחורים */}
                  <button
                    type="button"
                    onClick={() => handleKpiCardClick('urgent_tasks')}
                    className="p-4 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-red-600 hover:shadow-md text-right transition flex flex-col justify-between space-y-2.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900 group-hover:text-red-600">
                        משימות דחופות ואיחורים
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                        <Flame className="w-4 h-4 text-red-600" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-extrabold text-red-600">
                          {homeMetrics.urgentTasks.length}
                        </span>
                        <span className="text-[11px] font-extrabold text-red-800 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                          {homeMetrics.delayedCases.length} בחריגת מועד
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-red-600 rounded-full"
                          style={{
                            width: `${Math.max(homeMetrics.urgentPct, 8)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>דחוף מאוד / +30 יום ממסירה</span>
                      <span className="text-red-700 font-extrabold">
                        פתח מסך ➔
                      </span>
                    </div>
                  </button>

                  {/* 5. מעקב נט המשפט והחלטות ממתינות */}
                  <button
                    type="button"
                    onClick={() => handleKpiCardClick('net_hamishpat')}
                    className="p-4 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-indigo-600 hover:shadow-md text-right transition flex flex-col justify-between space-y-2.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-slate-900 group-hover:text-indigo-700">
                        מעקב נט המשפט והחלטות
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                        <Gavel className="w-4 h-4 text-indigo-600" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-extrabold text-indigo-700">
                          {homeMetrics.netHaMishpatCases.length}
                        </span>
                        <span className="text-[11px] font-extrabold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                          {homeMetrics.netHaMishpatPct}% במעקב
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{
                            width: `${Math.max(
                              homeMetrics.netHaMishpatPct,
                              8
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>החלטות שופט/רשם ותגובות</span>
                      <span className="text-indigo-700 font-extrabold">
                        פתח מסך ➔
                      </span>
                    </div>
                  </button>
                </div>
              </section>

              {/* ============================================================ */}
              {/* רצועה 3 — מבט-על ויזואלי וגרפים (בתחתית המסך):               */}
              {/* פילוח ויזואלי נקי של 4 הקטגוריות + גרף עומס/סטטוסים צבעוני וברור */}
              {/* ============================================================ */}
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* 1. פילוח ויזואלי נקי של 4 הקטגוריות (רשויות, חדל"פ, חברות, חברה משכנת) */}
                <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-blue-600 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      4 עולמות התוכן (לחץ על קטגוריה לפתיחה)
                    </h3>
                    <button
                      type="button"
                      onClick={() => navigateToCasesScreen('all')}
                      className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-blue-700 text-white text-xs font-extrabold flex items-center gap-1 transition"
                    >
                      <span>כל התיקים ({homeMetrics.totalActiveCases})</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {homeMetrics.byCategory.map((item) => {
                      const cat = item.category;
                      const colorCfg =
                        cat === 'גבייה'
                          ? {
                              bar: 'bg-blue-600',
                              badge: 'bg-blue-100 text-blue-900 border-blue-300',
                              border: 'hover:border-blue-400',
                              icon: Landmark,
                              iconColor: 'text-blue-600 bg-blue-50',
                            }
                          : cat === 'חדל"פ'
                          ? {
                              bar: 'bg-purple-600',
                              badge:
                                'bg-purple-100 text-purple-900 border-purple-300',
                              border: 'hover:border-purple-400',
                              icon: Gavel,
                              iconColor: 'text-purple-600 bg-purple-50',
                            }
                          : cat === 'חברות'
                          ? {
                              bar: 'bg-emerald-600',
                              badge:
                                'bg-emerald-100 text-emerald-900 border-emerald-300',
                              border: 'hover:border-emerald-400',
                              icon: Briefcase,
                              iconColor: 'text-emerald-600 bg-emerald-50',
                            }
                          : {
                              bar: 'bg-amber-500',
                              badge:
                                'bg-amber-100 text-amber-900 border-amber-300',
                              border: 'hover:border-amber-400',
                              icon: Building2,
                              iconColor: 'text-amber-600 bg-amber-50',
                            };
                      const IconComp = colorCfg.icon;

                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => navigateToCasesScreen(cat)}
                          className={`p-3 rounded-xl border border-slate-200 ${colorCfg.border} bg-slate-50/60 hover:bg-white text-right transition shadow-2xs space-y-2 group`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorCfg.iconColor}`}
                              >
                                <IconComp className="w-4 h-4" />
                              </div>
                              <span className="font-extrabold text-slate-900 text-sm truncate group-hover:text-blue-700">
                                {CATEGORY_LABELS[cat].shortTitle}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-extrabold border shrink-0 ${colorCfg.badge}`}
                            >
                              {item.count} ({item.pct}%)
                            </span>
                          </div>

                          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${colorCfg.bar} transition-all duration-300`}
                              style={{
                                width: `${Math.max(
                                  item.pct,
                                  item.count > 0 ? 8 : 0
                                )}%`,
                              }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. גרף עומס / סטטוסים וביצוע משימות צבעוני וברור (בלי טקסטים מסבירים מיותרים) */}
                <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200 border-t-4 border-t-emerald-600 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      <span>גרף עומס, שלבים וביצוע משימות</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleKpiCardClick('legal_fees')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-extrabold transition"
                    >
                      שכ&quot;ט: {homeMetrics.feePaidPct}% שולם ➔
                    </button>
                  </div>

                  {/* מד השלמת משימות כללי */}
                  <div
                    onClick={() => handleKpiCardClick('overall_progress')}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:border-blue-300 transition"
                  >
                    <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                      <span className="text-slate-800">
                        השלמת משימות ({homeMetrics.completedMilestones}/
                        {homeMetrics.totalMilestones} בוצעו ✓)
                      </span>
                      <span className="text-blue-700 font-mono text-sm">
                        {homeMetrics.overallProgressPct}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-l from-emerald-500 to-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${homeMetrics.overallProgressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* גרף עמודות אופקי של 5 שלבי העבודה (התראה, מסירה, הגשה, דיון, הסדר/סגירה) */}
                  <div className="space-y-1.5">
                    {homeMetrics.byStage.map((st) => {
                      const barColor =
                        st.stage === 'התראה'
                          ? 'bg-sky-500'
                          : st.stage === 'מסירה'
                          ? 'bg-blue-600'
                          : st.stage === 'הגשה'
                          ? 'bg-purple-600'
                          : st.stage === 'דיון'
                          ? 'bg-amber-500'
                          : 'bg-emerald-600';
                      return (
                        <div key={st.stage} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs font-extrabold">
                            <span className="text-slate-800">{st.stage}</span>
                            <span className="font-mono text-slate-700">
                              {st.count} ({st.pct}%)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{
                                width: `${Math.max(
                                  st.pct,
                                  st.count > 0 ? 6 : 0
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            </div>
          ) : (
            /* ============================================================== */
            /* מסך התיקים (screenMode === 'cases'): מוצג בלחיצה על קטגוריה או "כל התיקים" */
            /* ============================================================== */
            <div className="space-y-4">
              {/* לשוניות קטגוריות למעבר מהיר בתוך מסך התיקים */}
              <section className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigateToCasesScreen('all')}
                    className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-extrabold transition ${
                      casesViewCategory === 'all' && !showArchiveView
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    כל התחומים ({activeCasesAllDomains.length})
                  </button>

                  {CASE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => navigateToCasesScreen(cat)}
                      className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-extrabold transition ${
                        casesViewCategory === cat && !showArchiveView
                          ? 'bg-blue-600 text-white border-blue-700 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {CATEGORY_LABELS[cat].shortTitle}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowArchiveView(!showArchiveView);
                    resetColumnFilters();
                  }}
                  className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition ${
                    showArchiveView
                      ? 'bg-emerald-700 text-white border-emerald-800'
                      : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  <Archive className="w-4 h-4" />
                  <span>הושלם / ארכיון ({archivedCasesAllDomains.length})</span>
                </button>
              </section>

              {/* טבלת התיקים של המסך הפעיל */}
              <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[240px]">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="סינון מהיר ברשימה זו (שם, ת״ז, מס׳ תיק, מחוז)..."
                        className="w-full pr-9 pl-3 py-1.5 text-sm rounded-xl border border-slate-300 bg-white outline-none focus:border-blue-600 font-medium"
                      />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-200">
                      {filteredCases.length} תיקים
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {canCustomFields && (
                      <button
                        type="button"
                        onClick={() => handleOpenCustomFieldModal(null)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        + הוסף שדה מעקב / תזכורת
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
                    >
                      <Printer className="w-3.5 h-3.5 text-sky-300" />
                      <span>הדפסה</span>
                    </button>

                    {canExportAndBackup && (
                      <button
                        type="button"
                        onClick={() =>
                          quickExportFilteredCasesToXlsx(
                            filteredCases,
                            currentScreenTitle
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>אקסל ({filteredCases.length})</span>
                      </button>
                    )}
                  </div>
                </div>

                {filteredCases.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <div className="text-base font-extrabold text-slate-700">
                      לא נמצאו תיקים להצגה בתצוגה זו
                    </div>
                    <button
                      type="button"
                      onClick={resetColumnFilters}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-extrabold"
                    >
                      אפס מסנני עמודות
                    </button>
                  </div>
                ) : (
                  <>
                    {/* כרטיסיות מובייל (< md) */}
                    <div className="md:hidden p-3 space-y-2.5 bg-[#F8FAFC]">
                      {filteredCases.map((c) => {
                        const countdown = getDueCountdown(c.next_due_date);
                        const totalDebt = calculateTotalDebt(c);
                        const d30 = isDeliveryOver30DaysAlert(c);
                        const postponed = isPostponedHearingCase(c);

                        return (
                          <div
                            key={c.id}
                            onClick={() => openCaseDrawer(c)}
                            className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2.5 cursor-pointer transition"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-50 text-blue-900 border border-blue-200">
                                    {c.category}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 inline-flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    מחוז {c.district || 'מרכז'}
                                  </span>
                                  {postponed && (
                                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 text-[11px] font-extrabold">
                                      נדחה ({c.extensions_count || 1})
                                    </span>
                                  )}
                                  {d30.isAlert && (
                                    <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[11px] font-extrabold">
                                      +30 יום ממסירה!
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-extrabold text-slate-900 text-base">
                                    {c.debtor_name}
                                  </span>
                                  <CopyButton value={c.debtor_name} />
                                </div>

                                <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs text-slate-600 font-mono">
                                  {c.id_or_hp && (
                                    <span>ח&quot;פ/ת&quot;ז: {c.id_or_hp}</span>
                                  )}
                                  {c.case_number && (
                                    <span className="font-bold text-slate-800">
                                      • תיק: {c.case_number}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0"
                              >
                                <select
                                  value={c.status}
                                  onChange={(e) =>
                                    handleQuickStatusChange(e, c)
                                  }
                                  className="px-2 py-1 rounded-lg text-xs font-extrabold bg-slate-100 text-slate-800 border border-slate-300 outline-none"
                                >
                                  {CASE_STATUSES.map((st) => (
                                    <option key={st} value={st}>
                                      {st}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="text-xs sm:text-sm text-slate-800 bg-[#F8FAFC] p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="font-extrabold text-[#0F172A]">
                                  [{c.next_action_type}]
                                </span>
                                {c.next_due_date && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-900 border border-blue-200">
                                    <Clock className="w-3 h-3" />
                                    {countdown.label} (
                                    {formatDateHe(c.next_due_date)})
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-700 font-medium">
                                {c.next_action_description || 'ללא פירוט'}
                              </div>
                              {totalDebt > 0 && c.category === 'גבייה' && (
                                <div className="text-xs font-extrabold text-blue-900">
                                  סה&quot;כ חוב: {formatCurrencyILS(totalDebt)}
                                </div>
                              )}
                            </div>

                            <InlineCustomFieldsList
                              caseItem={c}
                              compact
                              onCasesUpdated={(updatedList) =>
                                setCases(updatedList)
                              }
                              onOpenAddModal={(target) =>
                                handleOpenCustomFieldModal(target)
                              }
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* טבלת דסקטופ (md+) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="border-b-2 border-slate-200 bg-slate-100/90 text-sm font-extrabold text-slate-800">
                            <th className="py-3 px-4 align-top min-w-[220px]">
                              <div className="mb-1">שם חייב / חברה / פרויקט</div>
                              <select
                                value={colFilterDebtor}
                                onChange={(e) =>
                                  setColFilterDebtor(e.target.value)
                                }
                                className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                              >
                                <option value="הכל">
                                  כל השמות ({columnFilterOptions.debtors.length})
                                </option>
                                {columnFilterOptions.debtors.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                            </th>

                            <th className="py-3 px-3 align-top min-w-[185px]">
                              <div className="mb-1">מספר תיק, מחוז וגוש</div>
                              <div className="flex gap-1">
                                <select
                                  value={colFilterDistrict}
                                  onChange={(e) =>
                                    setColFilterDistrict(
                                      e.target.value as 'הכל' | CaseDistrict
                                    )
                                  }
                                  className="w-1/2 p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                                >
                                  <option value="הכל">כל המחוזות</option>
                                  {CASE_DISTRICTS.map((dist) => (
                                    <option key={dist} value={dist}>
                                      {dist}
                                    </option>
                                  ))}
                                </select>
                                <select
                                  value={colFilterCaseOrGush}
                                  onChange={(e) =>
                                    setColFilterCaseOrGush(e.target.value)
                                  }
                                  className="w-1/2 p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                                >
                                  <option value="הכל">כל התיקים</option>
                                  {columnFilterOptions.caseNumsAndGush.map(
                                    (val) => (
                                      <option key={val} value={val}>
                                        {val}
                                      </option>
                                    )
                                  )}
                                </select>
                              </div>
                            </th>

                            <th className="py-3 px-3 align-top min-w-[210px]">
                              <div className="mb-1">שלב נוכחי וסטטוס</div>
                              <div className="flex gap-1">
                                <select
                                  value={colFilterStage}
                                  onChange={(e) =>
                                    setColFilterStage(e.target.value)
                                  }
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

                            <th className="py-3 px-3 align-top min-w-[195px]">
                              <div className="mb-1">נתוני תחום ושכ&quot;ט</div>
                              <select
                                value={colFilterMuniOrProject}
                                onChange={(e) =>
                                  setColFilterMuniOrProject(e.target.value)
                                }
                                className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                              >
                                <option value="הכל">הכל</option>
                                {columnFilterOptions.munisOrProjects.map(
                                  (val) => (
                                    <option key={val} value={val}>
                                      {val}
                                    </option>
                                  )
                                )}
                              </select>
                            </th>

                            <th className="py-3 px-4 align-top min-w-[270px]">
                              <div className="mb-1">הפעולה הבאה ושדות מעקב</div>
                              <select
                                value={colFilterActionType}
                                onChange={(e) =>
                                  setColFilterActionType(e.target.value)
                                }
                                className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                              >
                                <option value="הכל">כל סוגי הפעולות</option>
                                {NEXT_ACTION_TYPES.map((act) => (
                                  <option key={act} value={act}>
                                    {act}
                                  </option>
                                ))}
                              </select>
                            </th>

                            <th className="py-3 px-3 align-top min-w-[155px]">
                              <div className="mb-1">מועד יעד</div>
                              <select
                                value={colFilterUrgency}
                                onChange={(e) =>
                                  setColFilterUrgency(e.target.value)
                                }
                                className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                              >
                                <option value="הכל">כל המועדים</option>
                                <option value="באיחור/היום">
                                  באיחור / היום
                                </option>
                                <option value="השבוע">השבוע הקרוב</option>
                                <option value="נדחה">דיונים שנדחו</option>
                              </select>
                            </th>

                            <th className="py-3 px-3 align-top text-left">
                              תפעול וארכיון
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200 text-[15px] leading-relaxed">
                          {filteredCases.map((c) => {
                            const countdown = getDueCountdown(c.next_due_date);
                            const totalDebt = calculateTotalDebt(c);
                            const d30 = isDeliveryOver30DaysAlert(c);
                            const postponed = isPostponedHearingCase(c);

                            return (
                              <tr
                                key={c.id}
                                onClick={() => openCaseDrawer(c)}
                                className="cursor-pointer bg-white hover:bg-blue-50/40 transition group"
                              >
                                <td className="py-3.5 px-4 align-top">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-extrabold text-slate-900 group-hover:text-blue-700">
                                      {c.debtor_name}
                                    </span>
                                    <CopyButton value={c.debtor_name} />
                                  </div>
                                  {c.id_or_hp && (
                                    <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-600 font-mono">
                                      <span>ת&quot;ז/ח&quot;פ: {c.id_or_hp}</span>
                                      <CopyButton value={c.id_or_hp} />
                                    </div>
                                  )}
                                </td>

                                <td className="py-3.5 px-3 align-top">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-extrabold text-slate-900 text-sm">
                                      {c.case_number || '—'}
                                    </span>
                                    <CopyButton value={c.case_number} />
                                  </div>

                                  <div
                                    className="mt-1 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <select
                                      value={c.district || 'מרכז'}
                                      onChange={(e) =>
                                        handleQuickDistrictChange(e, c)
                                      }
                                      className="px-1.5 py-0.5 rounded text-xs font-extrabold bg-indigo-50 text-indigo-950 border border-indigo-200 cursor-pointer outline-none"
                                    >
                                      {CASE_DISTRICTS.map((dist) => (
                                        <option key={dist} value={dist}>
                                          מחוז {dist}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </td>

                                <td className="py-3.5 px-3 align-top">
                                  <div className="font-bold text-slate-900 text-sm">
                                    {c.current_stage || c.status}
                                  </div>
                                  <div
                                    className="flex flex-wrap items-center gap-1.5 mt-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <select
                                      value={c.status}
                                      onChange={(e) =>
                                        handleQuickStatusChange(e, c)
                                      }
                                      className="px-2 py-0.5 rounded-lg text-xs font-extrabold bg-slate-100 hover:bg-blue-50 text-slate-800 border border-slate-300 cursor-pointer outline-none"
                                    >
                                      {CASE_STATUSES.map((st) => (
                                        <option key={st} value={st}>
                                          {st}
                                        </option>
                                      ))}
                                    </select>
                                    {postponed && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openCaseDrawer(c, 'logs');
                                        }}
                                        className="px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300"
                                      >
                                        נדחה ({c.extensions_count || 1})
                                      </button>
                                    )}
                                  </div>
                                </td>

                                <td className="py-3.5 px-3 align-top text-sm">
                                  <div className="font-extrabold text-slate-900">
                                    {c.municipality ||
                                      c.housing_project_name ||
                                      c.category}
                                  </div>
                                  {totalDebt > 0 && (
                                    <div className="text-xs font-extrabold text-blue-800">
                                      חוב: {formatCurrencyILS(totalDebt)}
                                    </div>
                                  )}
                                  <div className="mt-1">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${
                                        c.legal_fee_paid
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : 'bg-amber-50 text-amber-800 border-amber-200'
                                      }`}
                                    >
                                      שכ&quot;ט: {c.legal_fee_paid ? 'שולם ✓' : 'טרם שולם'}
                                    </span>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 align-top max-w-md">
                                  {d30.isAlert && (
                                    <span className="mb-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-600 text-white text-[11px] font-extrabold">
                                      <AlertTriangle className="w-3 h-3" />
                                      חלפו 30 יום מאישור מסירה
                                    </span>
                                  )}
                                  <div className="font-bold text-slate-900 text-sm">
                                    <span className="inline-block ml-1.5 px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-extrabold">
                                      {c.next_action_type}
                                    </span>
                                    {c.next_action_description || 'ללא פירוט'}
                                  </div>
                                  <InlineCustomFieldsList
                                    caseItem={c}
                                    compact
                                    onCasesUpdated={(updatedList) =>
                                      setCases(updatedList)
                                    }
                                    onOpenAddModal={(target) =>
                                      handleOpenCustomFieldModal(target)
                                    }
                                  />
                                </td>

                                <td className="py-3.5 px-3 align-top whitespace-nowrap">
                                  {c.next_due_date ? (
                                    <div>
                                      <span
                                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                                          countdown.urgency === 'overdue'
                                            ? 'bg-red-100 text-red-900 border border-red-300'
                                            : countdown.urgency === 'today'
                                            ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                            : 'bg-blue-50 text-blue-900 border border-blue-200'
                                        }`}
                                      >
                                        <Clock className="w-3 h-3" />
                                        {countdown.label}
                                      </span>
                                      <div className="text-xs text-slate-600 mt-0.5 pr-1 font-bold">
                                        {formatDateHe(c.next_due_date)}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-xs">
                                      —
                                    </span>
                                  )}
                                </td>

                                <td className="py-3.5 px-3 align-top text-left whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5">
                                    {c.next_due_date && !c.is_archived && (
                                      <button
                                        type="button"
                                        onClick={(e) =>
                                          handleMarkActionDone(e, c)
                                        }
                                        title="סמן פעולה כבוצעה"
                                        className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                    )}

                                    {canDeleteAndArchive && (
                                      <button
                                        type="button"
                                        onClick={(e) =>
                                          handleToggleArchive(e, c)
                                        }
                                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold inline-flex items-center gap-1 transition"
                                      >
                                        <Archive className="w-3.5 h-3.5" />
                                        <span>
                                          {c.is_archived ? 'שחזר' : 'ארכיון'}
                                        </span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openCaseDrawer(c);
                                      }}
                                      className="px-3 py-1.5 rounded-xl bg-[#0F172A] hover:bg-blue-700 text-white font-extrabold text-xs transition inline-flex items-center gap-1"
                                    >
                                      <span>תפעול</span>
                                      <ChevronLeft className="w-3.5 h-3.5" />
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
            </div>
          )}
        </div>

        {/* סרגל ניווט תחתון למובייל (< md): מסך הבית | כל התיקים | דוחות | + חדש */}
        <nav
          aria-label="סרגל ניווט תחתון למובייל"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0F172A] text-white border-t border-slate-800 px-2 py-1.5 shadow-2xl"
        >
          <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
            <button
              type="button"
              onClick={handleGoHome}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] font-extrabold transition ${
                screenMode === 'home'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Home className="w-4 h-4 mb-0.5 text-white" />
              <span>מסך הבית</span>
            </button>

            <button
              type="button"
              onClick={() => navigateToCasesScreen('all')}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] font-extrabold transition ${
                screenMode === 'cases'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FolderKanban className="w-4 h-4 mb-0.5 text-sky-400" />
              <span>כל התיקים</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReportsModalOpen(true)}
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] font-extrabold text-slate-300 hover:bg-slate-800 transition"
            >
              <BarChart3 className="w-4 h-4 mb-0.5 text-indigo-400" />
              <span>דוחות BI</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] font-extrabold bg-emerald-600 text-white shadow-xs transition"
            >
              <Plus className="w-4 h-4 mb-0.5" />
              <span>+ חדש</span>
            </button>
          </div>
        </nav>

        {/* ================================================================== */}
        {/* חלונות נפתחים (Modals)                                             */}
        {/* ================================================================== */}
        <KpiDetailsModal
          isOpen={Boolean(activeKpiModal)}
          onClose={() => setActiveKpiModal(null)}
          kpiType={activeKpiModal}
          title={activeKpiModal ? kpiModalMeta[activeKpiModal].title : ''}
          subtitle={activeKpiModal ? kpiModalMeta[activeKpiModal].subtitle : ''}
          casesList={activeKpiModal ? kpiLists[activeKpiModal] : []}
          onSelectCase={(c, tab) => openCaseDrawer(c, tab)}
          onApplyTableFilter={(kType) => {
            setKpiQuickFilter(kType);
            setScreenMode('cases');
          }}
          onPrintList={(list, title) => triggerPrintWithList(list, title)}
          onCasesUpdated={(updatedList) => setCases(updatedList)}
        />

        <ReportsAndChartsModal
          isOpen={isReportsModalOpen}
          onClose={() => setIsReportsModalOpen(false)}
          allCases={cases}
          filteredCases={filteredCases}
          onOpenCustomColumnsExport={() => setIsExcelModalOpen(true)}
          onSelectCase={(c, tab) => openCaseDrawer(c, tab)}
          onCasesUpdated={(updatedList) => setCases(updatedList)}
          onPrintBiReport={(list, title) => triggerPrintWithList(list, title)}
        />

        <ExecutiveSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          currentUser={currentUser}
          workerPermissions={workerPermissions}
          onWorkerPermissionsChange={(nextPerms) =>
            setWorkerPermissions(nextPerms)
          }
          onToggleRoleQuick={handleToggleRoleQuick}
          onOpenUsersModal={() => setIsUsersModalOpen(true)}
          onOpenMuniModal={() => setIsMuniModalOpen(true)}
          onOpenCsvModal={() => setIsCsvModalOpen(true)}
          onDataRestored={({
            cases: nextCases,
            muniSettings: nextMunis,
            users: nextUsers,
          }) => {
            setCases(nextCases);
            setMuniSettings(nextMunis);
            setSystemUsers(nextUsers);
          }}
        />

        <CaseDrawer
          caseItem={selectedCase}
          initialTab={drawerInitialTab}
          onClose={() => setSelectedCase(null)}
          onCaseUpdated={(updated) => {
            setCases((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            );
            setSelectedCase(updated);
          }}
          onAllCasesUpdated={(updatedList) => {
            setCases(updatedList);
          }}
          onOpenAddCustomField={(target) => handleOpenCustomFieldModal(target)}
          onToggleArchive={(targetCase) => handleToggleArchive(null, targetCase)}
          onPrintCaseZone={(caseData, logsData, zone, activeTab) => {
            setCasePrintContext({ caseData, logsData, zone, activeTab });
            setTimeout(() => {
              window.print();
              setTimeout(() => setCasePrintContext(null), 500);
            }, 100);
          }}
          onCaseDeleted={(deletedId) => {
            setCases((prev) => prev.filter((c) => c.id !== deletedId));
            setSelectedCase(null);
          }}
          municipalitiesSettings={muniSettings}
          currentUser={currentUser}
          onOpenMuniSettingsModal={() => setIsMuniModalOpen(true)}
        />

        <AddCustomFieldModal
          isOpen={isCustomFieldModalOpen}
          onClose={() => setIsCustomFieldModalOpen(false)}
          defaultCategory={activeCategory}
          targetCase={customFieldTargetCase}
          allCases={cases}
          onCasesUpdated={(updatedList) => {
            setCases(updatedList);
            if (selectedCase) {
              const refreshed = updatedList.find(
                (c) => c.id === selectedCase.id
              );
              if (refreshed) setSelectedCase(refreshed);
            }
          }}
        />

        <UsersManagementModal
          isOpen={isUsersModalOpen}
          onClose={() => setIsUsersModalOpen(false)}
          users={systemUsers}
          onUsersChanged={(nextUsers) => setSystemUsers(nextUsers)}
          isAdmin={currentUser.role === 'admin'}
        />

        <MunicipalitiesSettingsModal
          isOpen={isMuniModalOpen}
          onClose={() => setIsMuniModalOpen(false)}
          settings={muniSettings}
          onSettingsChanged={(updatedList) => setMuniSettings(updatedList)}
          isAdmin={currentUser.role === 'admin'}
        />

        <ExcelExportModal
          isOpen={isExcelModalOpen}
          onClose={() => setIsExcelModalOpen(false)}
          allCases={cases}
          filteredCases={filteredCases}
        />

        <NewCaseModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onCreated={(newCase) => {
            setCases((prev) => [newCase, ...prev]);
            setActiveCategory(newCase.category);
            openCaseDrawer(newCase, 'executive');
          }}
          municipalitiesSettings={muniSettings}
          defaultCategory={activeCategory}
        />

        <SmartPasteModal
          isOpen={isSmartPasteOpen}
          onClose={() => setIsSmartPasteOpen(false)}
          cases={cases}
          onCaseUpdatedOrCreated={(updatedOrNew, isNew) => {
            if (isNew) {
              setCases((prev) => [updatedOrNew, ...prev]);
            } else {
              setCases((prev) =>
                prev.map((c) => (c.id === updatedOrNew.id ? updatedOrNew : c))
              );
            }
            setActiveCategory(updatedOrNew.category);
            openCaseDrawer(updatedOrNew, 'executive');
          }}
        />

        <CsvImportModal
          isOpen={isCsvModalOpen}
          onClose={() => setIsCsvModalOpen(false)}
          onImported={(newCases) => {
            setCases((prev) => [...newCases, ...prev]);
          }}
        />
      </div>

      {/* ==================================================================== */}
      {/* #print-root: יושב מחוץ ל-#app-shell ומדפיס את האזור הספציפי בתיק או את המסך הנוכחי! */}
      {/* ==================================================================== */}
      <div id="print-root" dir="rtl">
        {(() => {
          const targetCase = casePrintContext?.caseData || selectedCase;
          const targetLogs = casePrintContext?.logsData || [];
          const rawZone: CasePrintZone = casePrintContext?.zone || 'full';
          const effectiveZone =
            rawZone === 'active_tab'
              ? casePrintContext?.activeTab || drawerInitialTab
              : rawZone;

          const zoneLabelMap: Record<string, string> = {
            executive: 'כרטיס תיק מרכזי — תמצית, משימות ויומן כרונולוגי',
            summary: 'תמצית תיק — נתונים עיקריים בלבד',
            overview: 'מסך כללי ושדות התחום',
            tasks: 'צ׳ק-ליסט משימות ומדידת זמנים',
            logs: 'יומן תרשומות שיחה, החלטות וארכות',
            full: 'דוח תיק מלא (כל האזורים)',
          };

          const showCoreSummary =
            effectiveZone === 'executive' ||
            effectiveZone === 'summary' ||
            effectiveZone === 'overview' ||
            effectiveZone === 'full';
          const showDetailedDomainFields =
            effectiveZone === 'overview' || effectiveZone === 'full';
          const showTasksZone =
            effectiveZone === 'executive' ||
            effectiveZone === 'tasks' ||
            effectiveZone === 'full';
          const showLogsZone =
            effectiveZone === 'executive' ||
            effectiveZone === 'logs' ||
            effectiveZone === 'full';

          return (
            <>
              <div
                style={{
                  borderBottom: '2px solid #000',
                  paddingBottom: '10px',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>
                    מערכת ניהול תיקים משפטיים (גרסה {APP_VERSION}) —{' '}
                    {targetCase && !customPrintList
                      ? `תיק: ${targetCase.debtor_name} (${
                          zoneLabelMap[effectiveZone] || 'דוח תיק'
                        })`
                      : printTitleToRender}
                  </h1>
                  <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
                    הופק ע&quot;י: {currentUser.displayName} ({currentUser.role})
                    •{' '}
                    {targetCase && !customPrintList
                      ? `[קטגוריה: ${targetCase.category}] [מחוז: ${
                          targetCase.district || 'מרכז'
                        }] [שלב: ${classifyWorkflowStage(
                          targetCase
                        )}] [סטטוס: ${targetCase.status}]`
                      : `סה"כ תיקים בדוח: ${printCasesToRender.length}`}
                  </p>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    textAlign: 'left',
                  }}
                >
                  תאריך הפקה: {new Date().toLocaleDateString('he-IL')}{' '}
                  {new Date().toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              {/* ========================================================== */}
              {/* א. הדפסת אזור נבחר מתוך תיק פתוח                           */}
              {/* ========================================================== */}
              {targetCase && !customPrintList ? (
                <div>
                  {/* כותרת זיהוי התיק (מוצגת בכל אזור הדפסה של התיק) */}
                  <table style={{ marginBottom: '12px' }}>
                    <thead>
                      <tr>
                        <th>שם חייב / תיק</th>
                        <th>ת&quot;ז / ח&quot;פ</th>
                        <th>מספר תיק וגוש/חלקה</th>
                        <th>קטגוריה ומחוז</th>
                        <th>שלב וסטטוס</th>
                        <th>פעולה הבאה ומועד יעד</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <strong>{targetCase.debtor_name}</strong>
                        </td>
                        <td>{targetCase.id_or_hp || '—'}</td>
                        <td>
                          <div>תיק: {targetCase.case_number || '—'}</div>
                          {targetCase.gush_helka && (
                            <div>גוש/חלקה: {targetCase.gush_helka}</div>
                          )}
                        </td>
                        <td>
                          [{targetCase.category}] [מחוז:{' '}
                          {targetCase.district || 'מרכז'}]
                        </td>
                        <td>
                          [שלב:{' '}
                          {targetCase.current_stage ||
                            classifyWorkflowStage(targetCase)}
                          ] [סטטוס: {targetCase.status}]
                        </td>
                        <td>
                          [{targetCase.next_action_type}]{' '}
                          {targetCase.next_action_description || ''} (
                          {targetCase.next_due_date
                            ? formatDateHe(targetCase.next_due_date)
                            : 'ללא יעד'}
                          )
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* אזור 1: נתונים עיקריים ושדות התחום */}
                  {showCoreSummary && (
                    <div style={{ marginBottom: '14px' }}>
                      <h3
                        style={{
                          fontSize: '14px',
                          fontWeight: 800,
                          margin: '8px 0',
                        }}
                      >
                        נתונים עיקריים בתיק ({targetCase.category}):
                      </h3>
                      <table>
                        <tbody>
                          {targetCase.category === 'גבייה' && (
                            <tr>
                              <td>
                                <strong>רשות מקומית:</strong>{' '}
                                {targetCase.municipality || '—'}
                              </td>
                              <td>
                                <strong>שנות חוב:</strong>{' '}
                                {targetCase.debt_years || '—'}
                              </td>
                              <td>
                                <strong>קרן + ריבית + הוצאות + שכ&quot;ט:</strong>{' '}
                                {formatCurrencyILS(
                                  calculateTotalDebt(targetCase)
                                )}
                              </td>
                              <td>
                                <strong>גח&quot;לת / מסירה:</strong>{' '}
                                {targetCase.gachlat_status || '—'} |{' '}
                                {classifyDeliveryStatus(targetCase)}
                              </td>
                            </tr>
                          )}

                          {targetCase.category === 'חדל"פ' && (
                            <tr>
                              <td>
                                <strong>נושה מהותי:</strong>{' '}
                                {targetCase.is_material_creditor ? 'כן ★' : 'לא'}
                              </td>
                              <td>
                                <strong>סוג חייב:</strong>{' '}
                                {targetCase.insolvency_debtor_type ||
                                  'חייב יחיד'}
                              </td>
                              <td>
                                <strong>נאמן / מפרק:</strong>{' '}
                                {targetCase.trustee_name_and_contact || '—'}
                              </td>
                              <td>
                                <strong>תביעת חוב:</strong>{' '}
                                {formatCurrencyILS(
                                  targetCase.debt_claim_amount || 0
                                )}{' '}
                                (
                                {targetCase.debt_claim_submitted
                                  ? 'הוגשה ✓'
                                  : 'טרם הוגשה'}
                                )
                              </td>
                            </tr>
                          )}

                          {targetCase.category === 'חברות' && (
                            <tr>
                              <td>
                                <strong>התחייבות עצמית 100א׳:</strong>{' '}
                                {targetCase.self_undertaking_deposited
                                  ? 'הופקדה ✓'
                                  : 'טרם הופקדה'}
                              </td>
                              <td>
                                <strong>תוצאות חקירה:</strong>{' '}
                                {targetCase.investigation_outcome || 'טרם נחקר'}
                              </td>
                              <td>
                                <strong>הכרעה בתיק:</strong>{' '}
                                {targetCase.company_resolution_decision ||
                                  'טרם הוכרע'}
                              </td>
                              <td>
                                <strong>ממצאי נאמן:</strong>{' '}
                                {targetCase.trustee_findings_summary || '—'}
                              </td>
                            </tr>
                          )}

                          {targetCase.category === 'חברה משכנת' && (
                            <tr>
                              <td>
                                <strong>שם פרויקט:</strong>{' '}
                                {targetCase.housing_project_name || '—'}
                              </td>
                              <td>
                                <strong>התאמה לבית משותף:</strong>{' '}
                                {targetCase.condominium_registration_fit ||
                                  'בבדיקה'}
                              </td>
                              <td>
                                <strong>העברת זכויות:</strong>{' '}
                                {targetCase.seller_buyer_names || '—'}
                              </td>
                              <td>
                                <strong>אישור זכויות לקונה:</strong>{' '}
                                {targetCase.new_buyer_certificate_issued
                                  ? 'הופק ✓'
                                  : 'טרם הופק'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      {targetCase.notes && (
                        <div
                          style={{
                            border: '1px solid #000',
                            padding: '8px',
                            marginTop: '8px',
                          }}
                        >
                          <strong>הערות ליבה ותקציר התיק: </strong>
                          {targetCase.notes}
                        </div>
                      )}

                      {showDetailedDomainFields &&
                        (targetCase.custom_fields || []).length > 0 && (
                          <div style={{ marginTop: '10px' }}>
                            <strong>שדות מעקב ותזכורות מותאמים אישית:</strong>
                            <table>
                              <thead>
                                <tr>
                                  <th>שם השדה / התזכורת</th>
                                  <th>ערך / סטטוס</th>
                                  <th>מועד יעד</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(targetCase.custom_fields || []).map((cf) => (
                                  <tr key={cf.id}>
                                    <td>{cf.label}</td>
                                    <td>
                                      {cf.field_type === 'boolean'
                                        ? cf.value
                                          ? 'כן ✓'
                                          : 'לא'
                                        : String(cf.value || '—')}
                                    </td>
                                    <td>
                                      {cf.due_date
                                        ? formatDateHe(cf.due_date)
                                        : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                    </div>
                  )}

                  {/* אזור 2: צ'ק-ליסט משימות ומדידת זמנים */}
                  {showTasksZone && (
                    <div style={{ marginBottom: '14px' }}>
                      <h3
                        style={{
                          fontSize: '14px',
                          fontWeight: 800,
                          margin: '8px 0',
                        }}
                      >
                        צ&apos;ק-ליסט משימות ומדידת זמנים בתיק (
                        {(targetCase.milestones || []).length} משימות):
                      </h3>
                      {(targetCase.milestones || []).length === 0 ? (
                        <p>אין משימות מוגדרות בתיק זה.</p>
                      ) : (
                        <table>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>תיאור המשימה / השלב</th>
                              <th>סטטוס</th>
                              <th>דחיפות</th>
                              <th>תאריכי ביצוע</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(targetCase.milestones || []).map((m, idx) => (
                              <tr key={m.id}>
                                <td>{idx + 1}</td>
                                <td>{m.title}</td>
                                <td>
                                  {m.status === 'done'
                                    ? 'מה נעשה ✓'
                                    : m.status === 'in_progress'
                                    ? 'בתהליך כעת ⏳'
                                    : 'יבוצע בהמשך ➔'}
                                </td>
                                <td>{m.urgency || 'רגילה'}</td>
                                <td>
                                  {formatDateHe(m.started_at)}{' '}
                                  {m.completed_at
                                    ? `➔ ${formatDateHe(m.completed_at)}`
                                    : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* אזור 3: יומן תרשומות שיחה, הערות וארכות */}
                  {showLogsZone && (
                    <div>
                      <h3
                        style={{
                          fontSize: '14px',
                          fontWeight: 800,
                          margin: '8px 0',
                        }}
                      >
                        יומן תרשומות שיחה, החלטות וארכות ({targetLogs.length}{' '}
                        רישומים • מונה דחיות: {targetCase.extensions_count || 0}
                        ):
                      </h3>
                      {targetLogs.length === 0 ? (
                        <p>טרם הוזנו תרשומות ביומן התיק.</p>
                      ) : (
                        <table>
                          <thead>
                            <tr>
                              <th>תאריך ושעה</th>
                              <th>סוג רישום</th>
                              <th>תוכן התרשומת / ההחלטה</th>
                              <th>נחתם ע&quot;י</th>
                            </tr>
                          </thead>
                          <tbody>
                            {targetLogs.map((l) => (
                              <tr key={l.id}>
                                <td>{formatDateTimeHe(l.log_date)}</td>
                                <td>[{l.log_type}]</td>
                                <td>{l.content}</td>
                                <td>{l.created_by || 'מערכת'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ) : screenMode === 'home' && !customPrintList ? (
                /* ========================================================== */
                /* ב. הדפסת מסך הבית עצמו (תמונת מצב ניהולית ומדדים)         */
                /* ========================================================== */
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 800,
                      margin: '0 0 8px 0',
                    }}
                  >
                    1. ריכוז מדדי ביצוע ובקרה — מסך הבית (Executive Command
                    Center):
                  </h3>
                  <table style={{ marginBottom: '16px' }}>
                    <thead>
                      <tr>
                        <th>התקדמות כללית בתיקים</th>
                        <th>דיונים קרובים</th>
                        <th>דיונים שנדחו / ארכות</th>
                        <th>תגובות והגשות לביהמ&quot;ש</th>
                        <th>משימות דחופות ואיחורים</th>
                        <th>גביית שכר טרחה</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <strong>{homeMetrics.overallProgressPct}%</strong> (
                          {homeMetrics.completedMilestones}/
                          {homeMetrics.totalMilestones} שלבים)
                        </td>
                        <td>
                          <strong>{homeMetrics.upcomingHearings.length}</strong>{' '}
                          תיקים ({homeMetrics.upcomingPct}%)
                        </td>
                        <td>
                          <strong>
                            {homeMetrics.postponedHearings.length}
                          </strong>{' '}
                          תיקים ({homeMetrics.totalExtensionsSum} ארכות)
                        </td>
                        <td>
                          <strong>{homeMetrics.courtSubmissions.length}</strong>{' '}
                          תיקים (היערכות: {homeMetrics.avgPrepDays} ימים)
                        </td>
                        <td>
                          <strong>{homeMetrics.urgentTasks.length}</strong>{' '}
                          דחופים / {homeMetrics.delayedCases.length} בחריגה
                        </td>
                        <td>
                          שולם:{' '}
                          {formatCurrencyILS(homeMetrics.paidAmountSum)} (
                          {homeMetrics.paidCasesCount}) | פתוח:{' '}
                          {formatCurrencyILS(homeMetrics.unpaidAmountSum)} (
                          {homeMetrics.unpaidCasesCount})
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 800,
                      margin: '0 0 8px 0',
                    }}
                  >
                    2. פילוח תיקים לפי 4 תחומי הפעילות:
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th>קטגוריה / תחום פעילות</th>
                        <th>כמות תיקים פעילים</th>
                        <th>שיעור מסך הפעילות (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {homeMetrics.byCategory.map((item) => (
                        <tr key={item.category}>
                          <td>
                            <strong>
                              {CATEGORY_LABELS[item.category].title}
                            </strong>
                          </td>
                          <td>{item.count} תיקים</td>
                          <td>{item.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ========================================================== */
                /* ג. הדפסת מסך התיקים / רשימה מסוננת                        */
                /* ========================================================== */
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>שם חייב / חברה / פרויקט</th>
                      <th>מספר תיק ות&quot;ז</th>
                      <th>קטגוריה ומחוז</th>
                      <th>שלב וסטטוס</th>
                      <th>פרטי תחום / חוב / שכ&quot;ט</th>
                      <th>הפעולה הבאה ושדות מעקב</th>
                      <th>מועד יעד</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printCasesToRender.map((c, idx) => {
                      const totalDebt = calculateTotalDebt(c);
                      return (
                        <tr key={c.id}>
                          <td>{idx + 1}</td>
                          <td>
                            <strong>{c.debtor_name}</strong>
                          </td>
                          <td>
                            <div>תיק: {c.case_number || '—'}</div>
                            {c.id_or_hp && (
                              <div>ח&quot;פ/ת&quot;ז: {c.id_or_hp}</div>
                            )}
                          </td>
                          <td>
                            <div>[{c.category}]</div>
                            <div>[מחוז: {c.district || 'מרכז'}]</div>
                          </td>
                          <td>
                            <div>[שלב: {classifyWorkflowStage(c)}]</div>
                            <div>[סטטוס: {c.status}]</div>
                          </td>
                          <td>
                            {c.municipality && (
                              <div>רשות: {c.municipality}</div>
                            )}
                            {totalDebt > 0 && (
                              <div>חוב: {formatCurrencyILS(totalDebt)}</div>
                            )}
                            <div>
                              [שכ&quot;ט:{' '}
                              {c.legal_fee_paid ? 'שולם' : 'לא שולם'}]
                            </div>
                          </td>
                          <td>
                            <div>
                              <strong>[{c.next_action_type}]</strong>{' '}
                              {c.next_action_description || ''}
                            </div>
                          </td>
                          <td>
                            {c.next_due_date
                              ? formatDateHe(c.next_due_date)
                              : 'ללא מועד'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          );
        })()}
      </div>
    </>
  );
}
