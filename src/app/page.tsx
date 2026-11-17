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
  Settings,
  Briefcase,
  Gavel,
  Landmark,
  Printer,
  Home,
  Flame,
  ListChecks,
  Sparkles,
  Sun,
  BarChart3,
  Archive,
  RotateCcw,
  Bell,
  Hourglass,
  FolderKanban,
  Building2,
  MapPin,
  Truck,
} from 'lucide-react';
import {
  CASE_DISTRICTS,
  CASE_STATUSES,
  CATEGORY_LABELS,
  CaseCategory,
  CaseDistrict,
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
  getDueCountdown,
  isDeliveryOver30DaysAlert,
} from '@/lib/dateUtils';
import CaseDrawer, { DrawerTab } from '@/components/CaseDrawer';
import NewCaseModal from '@/components/NewCaseModal';
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
  const [drawerInitialTab, setDrawerInitialTab] =
    useState<DrawerTab>('overview');

  // חלונות מערכת (Modals)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
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

  // מצב הדפסה מותאם עבור #print-root (דוח BI / רשימת KPI / טבלה ראשית / תיק בודד)
  const [customPrintList, setCustomPrintList] = useState<{
    cases: CaseItem[];
    title: string;
  } | null>(null);

  const [localMode, setLocalMode] = useState(true);

  // ניווט תצוגה: 4 התחומים | היום שלי (Daily Focus) | ארכיון חכם (הושלם / ארכיון)
  const [activeCategory, setActiveCategory] = useState<CaseCategory>('גבייה');
  const [dailyFocusMode, setDailyFocusMode] = useState(false);
  const [showArchiveView, setShowArchiveView] = useState(false);
  const [kpiQuickFilter, setKpiQuickFilter] = useState<KpiCardType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // מסנני עמודות
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
  const casesSectionRef = useRef<HTMLElement | null>(null);

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

  // כפתור "מסך הבית" — מאפס מיד כל סינון, סוגר חלונות פתוחים ומחזיר למבט-העל הראשי
  const handleGoHome = () => {
    resetColumnFilters();
    setSearchQuery('');
    setDailyFocusMode(false);
    setShowArchiveView(false);
    setSelectedCase(null);
    setActiveKpiModal(null);
    setIsReportsModalOpen(false);
    setIsSettingsModalOpen(false);
    setIsCustomFieldModalOpen(false);
    setCustomPrintList(null);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCategoryTab = (cat: CaseCategory) => {
    setActiveCategory(cat);
    setDailyFocusMode(false);
    setShowArchiveView(false);
    resetColumnFilters();
  };

  const activeCasesAllDomains = useMemo(
    () => cases.filter((c) => !c.is_archived),
    [cases]
  );
  const archivedCasesAllDomains = useMemo(
    () => cases.filter((c) => Boolean(c.is_archived)),
    [cases]
  );

  // פונקציות בדיקה עבור כרטיסי הבקרה והיום שלי
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
    const hasTrusteeReportSoon = (() => {
      if (!c.trustee_report_due_date) return false;
      const tcd = getDueCountdown(c.trustee_report_due_date);
      return tcd.daysDiff !== null && tcd.daysDiff <= 7;
    })();
    return (
      (cd.daysDiff !== null && cd.daysDiff >= -1 && cd.daysDiff <= 7) ||
      hasCustomReminderDue ||
      hasTrusteeReportSoon
    );
  };

  const isCourtSubmissionPendingCase = (c: CaseItem) => {
    if (c.is_archived) return false;
    return (
      c.status === 'הגשה ממתינה לביהמ"ש' ||
      c.next_action_type === 'הגשה לביהמ"ש' ||
      c.next_action_type === 'בקשת צו הבאה' ||
      c.next_action_type === 'תביעת חוב' ||
      c.next_action_type === 'פתיחת תביעה בהוצל"פ' ||
      c.next_action_type === 'בקשה ממתינה' ||
      c.status === 'ממתין להחלטה' ||
      Boolean(c.delivery_confirmation_date)
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

  const isDailyFocusCase = (c: CaseItem) => {
    return (
      isUrgentTaskCase(c) ||
      isDelayedCase(c) ||
      isReminderTodayOrWeekCase(c)
    );
  };

  const domainCases = useMemo(() => {
    if (showArchiveView) {
      return archivedCasesAllDomains;
    }
    if (dailyFocusMode) {
      return activeCasesAllDomains.filter((c) => isDailyFocusCase(c));
    }
    return activeCasesAllDomains.filter((c) => c.category === activeCategory);
  }, [
    showArchiveView,
    dailyFocusMode,
    activeCasesAllDomains,
    archivedCasesAllDomains,
    activeCategory,
  ]);

  const kpiLists = useMemo(() => {
    const baseList = showArchiveView ? activeCasesAllDomains : domainCases;
    return {
      upcoming_hearings: baseList.filter(isUpcomingHearingCase),
      postponed_hearings: baseList.filter(isPostponedHearingCase),
      urgent_tasks: baseList.filter(isUrgentTaskCase),
      reminders_week: baseList.filter(isReminderTodayOrWeekCase),
      court_submissions: baseList.filter(isCourtSubmissionPendingCase),
      delayed_cases: baseList.filter(isDelayedCase),
    };
  }, [domainCases, activeCasesAllDomains, showArchiveView]);

  const totalExtensionsSum = useMemo(() => {
    return kpiLists.postponed_hearings.reduce(
      (sum, c) => sum + (Number(c.extensions_count) || 1),
      0
    );
  }, [kpiLists.postponed_hearings]);

  const domainActiveTasks = useMemo(() => {
    const list: {
      caseItem: CaseItem;
      milestoneTitle: string;
      urgency: string;
    }[] = [];

    for (const c of domainCases) {
      for (const m of c.milestones || []) {
        if (m.status === 'in_progress') {
          list.push({
            caseItem: c,
            milestoneTitle: m.title,
            urgency: m.urgency || 'רגילה',
          });
        }
      }
    }
    return list;
  }, [domainCases]);

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
    let tab: DrawerTab = preferredTab || 'overview';
    if (!preferredTab) {
      if (kpiQuickFilter === 'urgent_tasks') tab = 'tasks';
      else if (kpiQuickFilter === 'postponed_hearings') tab = 'logs';
      else tab = 'overview';
    }
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

  // הדפסה מובטחת דרך #print-root (מחוץ ל-#app-shell)
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
    upcoming_hearings: {
      title: 'דיונים קרובים ומועדים קבועים',
      subtitle: 'כל התיקים עם מועד דיון קרוב או יעד ב-14 הימים הקרובים',
    },
    postponed_hearings: {
      title: 'דיונים שנדחו ומעקב ארכות',
      subtitle: `תיקים שבהם נדחה דיון או נרשמה בקשת ארכה (סה"כ ${totalExtensionsSum} דחיות/ארכות)`,
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
      title: 'מסירות והגשות ממתינות לביהמ"ש / הוצל"פ',
      subtitle: 'מעקב אישורי מסירה, תביעות חוב, בקשות צו הבאה והגשות ממתינות',
    },
    delayed_cases: {
      title: 'תיקים באיחור / חריגת מועד',
      subtitle: 'תיקים שחרגו מתאריך היעד, חלפו 30 יום מאישור מסירה או צברו דחיות חוזרות',
    },
  };

  // הנתונים שיוצגו ב-#print-root בעת לחיצה על הדפסה
  const printCasesToRender = customPrintList
    ? customPrintList.cases
    : filteredCases;
  const printTitleToRender = customPrintList
    ? customPrintList.title
    : dailyFocusMode
    ? 'דוח היום שלי (Daily Focus)'
    : showArchiveView
    ? 'דוח תיקים שהושלמו / ארכיון'
    : `דוח ${CATEGORY_LABELS[activeCategory].title}`;

  return (
    <>
      {/* ==================================================================== */}
      {/* #app-shell: מעטפת האפליקציה הראשית (מוסתרת אוטומטית ב-@media print) */}
      {/* ==================================================================== */}
      <div
        id="app-shell"
        dir="rtl"
        className="h-dvh flex flex-col overflow-hidden bg-[#F8FAFC] text-slate-900 transition-all duration-200"
      >
        {/* ================================================================== */}
        {/* סרגל עליון (Navbar) כהה ומכובד בגוון כחול נייבי עמוק (#0F172A)     */}
        {/* כולל כפתור "מסך הבית" בולט בצד ימין עם אייקון Home                 */}
        {/* ================================================================== */}
        <header className="shrink-0 z-30 bg-[#0F172A] text-white border-b border-slate-800 shadow-md">
          <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            {/* צד ימין: כפתור מסך הבית בולט + לוגו וכותרת */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleGoHome}
                title="חזרה למסך הבית — איפוס סינונים וסגירת חלונות"
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm border border-blue-400/40 transition"
              >
                <Home className="w-4 h-4 text-white shrink-0" />
                <span>מסך הבית</span>
              </button>

              <div className="h-6 w-px bg-slate-700 hidden sm:block" />

              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-sm sm:text-lg font-extrabold tracking-tight text-white">
                      מערכת ניהול תיקים משפטיים
                    </h1>
                    <span
                      title={`${APP_VERSION_NAME} • עודכן: ${APP_UPDATED_AT}`}
                      className="text-[11px] px-2 py-0.5 rounded-md font-extrabold font-mono bg-amber-400/20 text-amber-300 border border-amber-400/40"
                    >
                      גרסה {APP_VERSION}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* אמצע: חיפוש גלובלי מיידי */}
            <div className="relative flex-1 min-w-[200px] max-w-md order-3 lg:order-2 w-full lg:w-auto">
              <Search className="w-4 h-4 text-slate-300 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש גלובלי מיידי (שם חייב, ת״ז/ח״פ, מס׳ תיק, מחוז, גוש/חלקה)..."
                className="w-full pr-9 pl-7 py-1.5 text-sm rounded-xl bg-slate-800 text-white placeholder-slate-400 border border-slate-600 focus:border-blue-400 focus:bg-slate-900 outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-2 text-xs text-slate-300 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* צד שמאל: כפתורי פעולה בולטים עם אייקונים */}
            <div className="flex items-center gap-1.5 sm:gap-2 order-2 lg:order-3 flex-wrap">
              {/* היום שלי (Daily Focus) */}
              <button
                type="button"
                onClick={() => {
                  setDailyFocusMode(!dailyFocusMode);
                  setShowArchiveView(false);
                  resetColumnFilters();
                }}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition ${
                  dailyFocusMode
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                }`}
              >
                <Sun
                  className={`w-4 h-4 shrink-0 ${
                    dailyFocusMode ? 'text-slate-950' : 'text-amber-400'
                  }`}
                />
                <span>היום שלי</span>
              </button>

              {/* דוחות ותרשימים (Smart BI Dashboard) */}
              <button
                type="button"
                onClick={() => setIsReportsModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40 text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition"
              >
                <BarChart3 className="w-4 h-4 text-sky-200 shrink-0" />
                <span>דוחות ותרשימים</span>
              </button>

              {/* + תיק חדש */}
              <button
                type="button"
                onClick={() => setIsNewModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ תיק חדש</span>
              </button>

              {/* הדפסה ישירה */}
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 text-xs font-extrabold flex items-center gap-1.5 transition"
                title="הדפסת הרשימה הנוכחית"
              >
                <Printer className="w-4 h-4 text-sky-400" />
                <span className="hidden xl:inline">הדפסה</span>
              </button>

              {/* תפריט הגדרות */}
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-extrabold flex items-center gap-1.5 transition"
                title="הגדרות מערכת, הרשאות, גיבוי מלא (JSON) ושחזור בטוח"
              >
                <Settings className="w-4 h-4 text-slate-300" />
                <span>הגדרות</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                title="התנתקות"
                className="p-2 rounded-xl bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-700 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ================================================================== */}
        {/* אזור התוכן הראשי (גלילה פנימית חלקה)                               */}
        {/* ================================================================== */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 pb-20 md:pb-5 space-y-4 max-w-[1600px] w-full mx-auto transition-all duration-200"
        >
          {/* ================================================================ */}
          {/* 1. לשוניות הקטגוריות: נקיות ללא מספרים כפולים, עם אייקון וקו תחתון צבעוני מובחן! */}
          {/* ================================================================ */}
          <section className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 flex-1">
              {/* רשויות (גבייה והוצל"פ) — כחול */}
              <button
                type="button"
                onClick={() => handleSelectCategoryTab('גבייה')}
                className={`px-4 py-3 rounded-xl border text-right transition-all duration-200 flex items-center gap-3 ${
                  activeCategory === 'גבייה' &&
                  !dailyFocusMode &&
                  !showArchiveView
                    ? 'bg-blue-50/90 text-blue-950 border-blue-300 border-b-4 border-b-blue-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50/30 hover:border-blue-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    activeCategory === 'גבייה' &&
                    !dailyFocusMode &&
                    !showArchiveView
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  <Landmark className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-extrabold truncate">
                    תיקי רשויות (גבייה והוצל&quot;פ)
                  </div>
                  <div className="text-[11px] text-slate-500 truncate hidden sm:block">
                    שכ&quot;ט, גח&quot;לת, משכון, +30 יום והפחתות
                  </div>
                </div>
              </button>

              {/* תיקי חדל"פ — סגול */}
              <button
                type="button"
                onClick={() => handleSelectCategoryTab('חדל"פ')}
                className={`px-4 py-3 rounded-xl border text-right transition-all duration-200 flex items-center gap-3 ${
                  activeCategory === 'חדל"פ' &&
                  !dailyFocusMode &&
                  !showArchiveView
                    ? 'bg-purple-50/90 text-purple-950 border-purple-300 border-b-4 border-b-purple-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-50/30 hover:border-purple-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    activeCategory === 'חדל"פ' &&
                    !dailyFocusMode &&
                    !showArchiveView
                      ? 'bg-purple-600 text-white'
                      : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  <Gavel className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-extrabold truncate">
                    תיקי חדל&quot;פ (ייצוג נושה)
                  </div>
                  <div className="text-[11px] text-slate-500 truncate hidden sm:block">
                    נושה מהותי, תביעות חוב וחובות חדשים
                  </div>
                </div>
              </button>

              {/* תיקי חברות — אמרלד */}
              <button
                type="button"
                onClick={() => handleSelectCategoryTab('חברות')}
                className={`px-4 py-3 rounded-xl border text-right transition-all duration-200 flex items-center gap-3 ${
                  activeCategory === 'חברות' &&
                  !dailyFocusMode &&
                  !showArchiveView
                    ? 'bg-emerald-50/90 text-emerald-950 border-emerald-300 border-b-4 border-b-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50/30 hover:border-emerald-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    activeCategory === 'חברות' &&
                    !dailyFocusMode &&
                    !showArchiveView
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-extrabold truncate">
                    תיקי חברות (נאמן / מפרק)
                  </div>
                  <div className="text-[11px] text-slate-500 truncate hidden sm:block">
                    התחייבות 100א׳, חקירות ודו&quot;ח נאמן
                  </div>
                </div>
              </button>

              {/* חברה משכנת — ענבר */}
              <button
                type="button"
                onClick={() => handleSelectCategoryTab('חברה משכנת')}
                className={`px-4 py-3 rounded-xl border text-right transition-all duration-200 flex items-center gap-3 ${
                  activeCategory === 'חברה משכנת' &&
                  !dailyFocusMode &&
                  !showArchiveView
                    ? 'bg-amber-50/90 text-amber-950 border-amber-300 border-b-4 border-b-amber-500 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50/30 hover:border-amber-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    activeCategory === 'חברה משכנת' &&
                    !dailyFocusMode &&
                    !showArchiveView
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-extrabold truncate">
                    חברה משכנת (רישום וזכויות)
                  </div>
                  <div className="text-[11px] text-slate-500 truncate hidden sm:block">
                    תצ&quot;רים, בית משותף והעברת זכויות
                  </div>
                </div>
              </button>
            </div>

            {/* כפתור ארכיון חכם (ירוק להושלם/ארכיון) */}
            <button
              type="button"
              onClick={() => {
                setShowArchiveView(!showArchiveView);
                setDailyFocusMode(false);
                resetColumnFilters();
              }}
              className={`px-4 py-3 rounded-xl border text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-all duration-200 shrink-0 ${
                showArchiveView
                  ? 'bg-emerald-700 text-white border-emerald-800 border-b-4 border-b-emerald-950 shadow-sm'
                  : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>הושלם / ארכיון ({archivedCasesAllDomains.length})</span>
            </button>
          </section>

          {/* ================================================================ */}
          {/* 2. כרטיסי בקרה עשירים עם פס צבע עליון ברור, אייקון בולט ומספר גדול */}
          {/* ================================================================ */}
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* 1. תיקים באיחור / חריגת מועד — אדום */}
            <button
              type="button"
              onClick={() => handleKpiCardClick('delayed_cases')}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-red-600 hover:shadow-md text-right transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-red-700">
                  תיקים באיחור / עיכוב
                </span>
                <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                  <Hourglass className="w-4 h-4 text-red-600" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-red-600">
                  {kpiLists.delayed_cases.length}
                </span>
                <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                  חריגת יעד ➔
                </span>
              </div>
            </button>

            {/* 2. משימות דחופות — אדום/להבה */}
            <button
              type="button"
              onClick={() => handleKpiCardClick('urgent_tasks')}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-red-500 hover:shadow-md text-right transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-red-600">
                  משימות דחופות
                </span>
                <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 text-red-600" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-red-600">
                  {kpiLists.urgent_tasks.length}
                </span>
                <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                  דחוף מאוד ➔
                </span>
              </div>
            </button>

            {/* 3. דיונים קרובים — כתום/ענבר */}
            <button
              type="button"
              onClick={() => handleKpiCardClick('upcoming_hearings')}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-amber-500 hover:shadow-md text-right transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-amber-700">
                  דיונים קרובים
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <CalendarClock className="w-4 h-4 text-amber-600" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-600">
                  {kpiLists.upcoming_hearings.length}
                </span>
                <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full">
                  מועדים קרובים ➔
                </span>
              </div>
            </button>

            {/* 4. דיונים שנדחו — ורוד/אדום */}
            <button
              type="button"
              onClick={() => handleKpiCardClick('postponed_hearings')}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-rose-500 hover:shadow-md text-right transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-rose-700">
                  דיונים שנדחו
                </span>
                <span className="px-2 py-0.5 text-[11px] font-extrabold rounded-lg bg-rose-100 text-rose-800 border border-rose-300">
                  נדחה
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-rose-600">
                  {kpiLists.postponed_hearings.length}
                </span>
                <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full">
                  {totalExtensionsSum} ארכות ➔
                </span>
              </div>
            </button>

            {/* 5. מסירות והגשות ממתינות — כחול */}
            <button
              type="button"
              onClick={() => handleKpiCardClick('court_submissions')}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-blue-600 hover:shadow-md text-right transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-blue-700">
                  מסירות והגשות
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-blue-700">
                  {kpiLists.court_submissions.length}
                </span>
                <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full">
                  מסירה / הגשה ➔
                </span>
              </div>
            </button>

            {/* 6. תזכורות להיום/השבוע — ירוק/אמרלד */}
            <button
              type="button"
              onClick={() => handleKpiCardClick('reminders_week')}
              className="p-3.5 rounded-2xl bg-white border border-slate-200 border-t-4 border-t-emerald-600 hover:shadow-md text-right transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 group-hover:text-emerald-700">
                  תזכורות השבוע
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
                  {kpiLists.reminders_week.length}
                </span>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                  7 ימים קרובים ➔
                </span>
              </div>
            </button>
          </section>

          {/* רצועת משימות בתהליך (לחיצה פותחת את התיק בלשונית משימות) */}
          {!showArchiveView && domainActiveTasks.length > 0 && (
            <section className="bg-white rounded-xl border border-slate-200 px-3.5 py-2 flex items-center gap-2 overflow-x-auto shadow-2xs">
              <span className="text-xs font-extrabold text-slate-800 shrink-0 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-blue-600" />
                משימות בביצוע כעת:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                {domainActiveTasks.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => openCaseDrawer(t.caseItem, 'tasks')}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs flex items-center gap-1.5 shrink-0 transition"
                  >
                    {t.urgency === 'דחוף מאוד' && (
                      <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                    )}
                    <span className="font-extrabold text-slate-900">
                      {t.caseItem.debtor_name}:
                    </span>
                    <span className="text-slate-700 truncate max-w-[180px]">
                      {t.milestoneTitle}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* ================================================================ */}
          {/* 3. טבלת התיקים / כרטיסיות המובייל                                */}
          {/* ================================================================ */}
          <section
            ref={casesSectionRef}
            className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
          >
            {/* סרגל כלים פנימי של הטבלה */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-sm sm:text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  {searchQuery
                    ? `תוצאות חיפוש גלובלי עבור "${searchQuery}"`
                    : dailyFocusMode
                    ? 'היום שלי (Daily Focus — תיקים דחופים, תזכורות ותיקים בעיכוב)'
                    : showArchiveView
                    ? 'ארכיון תיקים שהושלמו / נסגרו'
                    : CATEGORY_LABELS[activeCategory].title}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-200">
                  {filteredCases.length} תיקים מוצגים
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleOpenCustomFieldModal(null)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  + הוסף שדה מעקב / תזכורת
                </button>

                {(kpiQuickFilter !== 'all' ||
                  colFilterDebtor !== 'הכל' ||
                  colFilterCaseOrGush !== 'הכל' ||
                  colFilterDistrict !== 'הכל' ||
                  colFilterStage !== 'הכל' ||
                  colFilterStatus !== 'הכל' ||
                  colFilterMuniOrProject !== 'הכל' ||
                  colFilterActionType !== 'הכל' ||
                  colFilterUrgency !== 'הכל' ||
                  searchQuery ||
                  dailyFocusMode ||
                  showArchiveView) && (
                  <button
                    type="button"
                    onClick={handleGoHome}
                    className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    נקה סינון
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-sky-300" />
                  <span>הדפסת דוח</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    quickExportFilteredCasesToXlsx(
                      filteredCases,
                      CATEGORY_LABELS[activeCategory].shortTitle
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>ייצוא לאקסל ({filteredCases.length})</span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-sm font-bold text-slate-500">
                טוען נתוני תיקים...
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <div className="text-base font-extrabold text-slate-700">
                  לא נמצאו תיקים להצגה בתצוגה זו
                </div>
                <p className="text-xs text-slate-500">
                  לחץ על &quot;מסך הבית&quot; לאיפוס הסינון או הוסף תיק חדש.
                </p>
              </div>
            ) : (
              <>
                {/* ========================================================== */}
                {/* תצוגת מובייל (< md): כרטיסיות תיק מרווחות ונוחות למגע       */}
                {/* ========================================================== */}
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
                              {c.municipality && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                                  {c.municipality}
                                </span>
                              )}
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
                              <CopyButton
                                value={c.debtor_name}
                                label="העתק שם תיק"
                              />
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs text-slate-600 font-mono">
                              {c.id_or_hp && (
                                <span className="inline-flex items-center gap-1">
                                  ח&quot;פ/ת&quot;ז: {c.id_or_hp}
                                  <CopyButton value={c.id_or_hp} />
                                </span>
                              )}
                              {c.case_number && (
                                <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                                  • תיק: {c.case_number}
                                  <CopyButton value={c.case_number} />
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
                              onChange={(e) => handleQuickStatusChange(e, c)}
                              aria-label="שינוי סטטוס"
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
                            {c.next_due_date ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                                  countdown.urgency === 'overdue'
                                    ? 'bg-red-100 text-red-900 border border-red-300'
                                    : countdown.urgency === 'today'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-blue-50 text-blue-900 border border-blue-200'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                {countdown.label} ({formatDateHe(c.next_due_date)})
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                ללא תאריך יעד
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
                          onCasesUpdated={(updatedList) => {
                            setCases(updatedList);
                          }}
                          onOpenAddModal={(target) =>
                            handleOpenCustomFieldModal(target)
                          }
                        />

                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleToggleArchive(e, c)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>
                                {c.is_archived ? 'שחזר' : 'הושלם / ארכיון'}
                              </span>
                            </button>

                            {c.next_due_date && !c.is_archived && (
                              <button
                                type="button"
                                onClick={(e) => handleMarkActionDone(e, c)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                בוצע
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCaseDrawer(c);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#0F172A] text-white font-extrabold text-xs inline-flex items-center gap-1"
                          >
                            פתח תיק
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ========================================================== */}
                {/* תצוגת דסקטופ (md+): טבלה משפטית עשירה וברורה                */}
                {/* ========================================================== */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-200 bg-slate-100/90 text-sm font-extrabold text-slate-800">
                        <th className="py-3 px-4 align-top min-w-[220px]">
                          <div className="mb-1">שם חייב / חברה / פרויקט</div>
                          <select
                            value={colFilterDebtor}
                            onChange={(e) => setColFilterDebtor(e.target.value)}
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
                              {columnFilterOptions.caseNumsAndGush.map((val) => (
                                <option key={val} value={val}>
                                  {val}
                                </option>
                              ))}
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
                          <div className="mb-1">נתוני תחום ומסירות</div>
                          <select
                            value={colFilterMuniOrProject}
                            onChange={(e) =>
                              setColFilterMuniOrProject(e.target.value)
                            }
                            className="w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold text-slate-700"
                          >
                            <option value="הכל">הכל</option>
                            {columnFilterOptions.munisOrProjects.map((val) => (
                              <option key={val} value={val}>
                                {val}
                              </option>
                            ))}
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
                            <option value="באיחור/היום">באיחור / היום</option>
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
                            {/* 1. שם חייב */}
                            <td className="py-3.5 px-4 align-top">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-slate-900 group-hover:text-blue-700">
                                  {c.debtor_name}
                                </span>
                                <CopyButton
                                  value={c.debtor_name}
                                  label="העתק שם"
                                />
                              </div>
                              {c.id_or_hp && (
                                <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-600 font-mono">
                                  <span>ת&quot;ז/ח&quot;פ: {c.id_or_hp}</span>
                                  <CopyButton value={c.id_or_hp} />
                                </div>
                              )}
                            </td>

                            {/* 2. מספר תיק, מחוז וגוש/חלקה */}
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
                                  title="שינוי מחוז מהיר"
                                  className="px-1.5 py-0.5 rounded text-xs font-extrabold bg-indigo-50 text-indigo-950 border border-indigo-200 cursor-pointer outline-none"
                                >
                                  {CASE_DISTRICTS.map((dist) => (
                                    <option key={dist} value={dist}>
                                      מחוז {dist}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {(c.gush_helka || c.property_details) && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-slate-600 font-semibold">
                                  <span className="truncate max-w-[160px]">
                                    {c.gush_helka || c.property_details}
                                  </span>
                                  <CopyButton
                                    value={c.gush_helka || c.property_details}
                                  />
                                </div>
                              )}
                            </td>

                            {/* 3. שלב וסטטוס */}
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

                            {/* 4. נתוני תחום */}
                            <td className="py-3.5 px-3 align-top text-sm">
                              {c.category === 'גבייה' && (
                                <div className="space-y-0.5">
                                  <div className="font-extrabold text-slate-900">
                                    {c.municipality || '—'}
                                  </div>
                                  {totalDebt > 0 && (
                                    <div className="text-xs font-extrabold text-blue-800">
                                      חוב: {formatCurrencyILS(totalDebt)}
                                    </div>
                                  )}
                                  <div className="text-[11px] font-bold text-slate-600">
                                    {classifyDeliveryStatus(c)}
                                  </div>
                                </div>
                              )}
                              {c.category === 'חדל"פ' && (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {c.is_material_creditor && (
                                      <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-purple-700 text-white">
                                        ★ נושה מהותי
                                      </span>
                                    )}
                                    <span className="text-xs font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                      {c.insolvency_debtor_type || 'חייב יחיד'}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {c.category === 'חברות' && (
                                <div className="space-y-0.5 text-xs">
                                  <span
                                    className={`px-2 py-0.5 rounded font-extrabold border ${
                                      c.self_undertaking_deposited
                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                        : 'bg-red-100 text-red-900 border-red-300'
                                    }`}
                                  >
                                    התחייבות 100א׳:{' '}
                                    {c.self_undertaking_deposited
                                      ? 'הופקדה ✓'
                                      : 'טרם!'}
                                  </span>
                                  <div className="font-bold text-slate-700 mt-1">
                                    חקירה: {c.investigation_outcome || 'טרם נחקר'}
                                  </div>
                                </div>
                              )}
                              {c.category === 'חברה משכנת' && (
                                <div className="space-y-0.5 text-xs">
                                  <div className="font-extrabold text-amber-950">
                                    {c.housing_project_name || 'פרויקט חברה משכנת'}
                                  </div>
                                  <div className="text-slate-700 font-bold">
                                    בית משותף:{' '}
                                    {c.condominium_registration_fit || 'בבדיקה'}
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* 5. הפעולה הבאה ושדות מעקב מותאמים */}
                            <td className="py-3.5 px-4 align-top max-w-md">
                              {d30.isAlert && (
                                <span className="mb-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-600 text-white text-[11px] font-extrabold">
                                  <AlertTriangle className="w-3 h-3" />
                                  חלפו 30 יום מאישור מסירה — להוצל&quot;פ!
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
                                onCasesUpdated={(updatedList) => {
                                  setCases(updatedList);
                                }}
                                onOpenAddModal={(target) =>
                                  handleOpenCustomFieldModal(target)
                                }
                              />
                            </td>

                            {/* 6. מועד יעד */}
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
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>

                            {/* 7. כפתורי תפעול וארכיון חכם */}
                            <td className="py-3.5 px-3 align-top text-left whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {c.next_due_date && !c.is_archived && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleMarkActionDone(e, c)}
                                    title="סמן פעולה כבוצעה"
                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => handleToggleArchive(e, c)}
                                  title={
                                    c.is_archived
                                      ? 'שחזר תיק מהארכיון לפעילים'
                                      : 'העבר לארכיון (הושלם / ארכיון)'
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold inline-flex items-center gap-1 transition"
                                >
                                  {c.is_archived ? (
                                    <>
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>שחזר</span>
                                    </>
                                  ) : (
                                    <>
                                      <Archive className="w-3.5 h-3.5" />
                                      <span>ארכיון</span>
                                    </>
                                  )}
                                </button>

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

        {/* ================================================================== */}
        {/* סרגל ניווט תחתון למובייל (< md): מסך הבית | היום | דוחות | + חדש     */}
        {/* ================================================================== */}
        <nav
          aria-label="סרגל ניווט תחתון למובייל"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0F172A] text-white border-t border-slate-800 px-2 py-1.5 shadow-2xl"
        >
          <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
            <button
              type="button"
              onClick={handleGoHome}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] font-extrabold transition ${
                !dailyFocusMode && !showArchiveView
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Home className="w-4 h-4 mb-0.5 text-white" />
              <span>מסך הבית</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDailyFocusMode(true);
                setShowArchiveView(false);
                resetColumnFilters();
              }}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] font-extrabold transition ${
                dailyFocusMode
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Sun className="w-4 h-4 mb-0.5 text-amber-400" />
              <span>היום</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReportsModalOpen(true)}
              className="flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[11px] font-extrabold text-slate-300 hover:bg-slate-800 transition"
            >
              <BarChart3 className="w-4 h-4 mb-0.5 text-sky-400" />
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
          onApplyTableFilter={(kType) => setKpiQuickFilter(kType)}
          onPrintList={(list, title) => triggerPrintWithList(list, title)}
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
            setDailyFocusMode(false);
            setShowArchiveView(false);
            openCaseDrawer(newCase, 'overview');
          }}
          municipalitiesSettings={muniSettings}
          defaultCategory={activeCategory}
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
      {/* #print-root: יושב מחוץ ל-#app-shell ומבטיח הדפסה מלאה ב-100% מהדפדפנים! */}
      {/* ==================================================================== */}
      <div id="print-root" dir="rtl">
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
              {selectedCase && !customPrintList
                ? `כרטיס תיק: ${selectedCase.debtor_name}`
                : printTitleToRender}
            </h1>
            <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>
              הופק ע&quot;י: {currentUser.displayName} ({currentUser.role}) •{' '}
              {selectedCase && !customPrintList
                ? `[מחוז: ${selectedCase.district || 'מרכז'}] [שלב: ${classifyWorkflowStage(
                    selectedCase
                  )}] [סטטוס: ${selectedCase.status}]`
                : `סה"כ תיקים בדוח: ${printCasesToRender.length}`}
            </p>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, textAlign: 'left' }}>
            תאריך הפקה: {new Date().toLocaleDateString('he-IL')}{' '}
            {new Date().toLocaleTimeString('he-IL', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        {/* אם כרטיס תיק בודד פתוח — הדפס דוח כרטיס תיק מפורט בשחור-לבן חד */}
        {selectedCase && !customPrintList ? (
          <div>
            <table style={{ marginBottom: '14px' }}>
              <thead>
                <tr>
                  <th>שם חייב / תיק</th>
                  <th>ת&quot;ז / ח&quot;פ</th>
                  <th>מספר תיק</th>
                  <th>קטגוריה ומחוז</th>
                  <th>שלב וסטטוס</th>
                  <th>פעולה הבאה ומועד יעד</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>{selectedCase.debtor_name}</strong>
                  </td>
                  <td>{selectedCase.id_or_hp || '—'}</td>
                  <td>{selectedCase.case_number || '—'}</td>
                  <td>
                    [{selectedCase.category}] [מחוז:{' '}
                    {selectedCase.district || 'מרכז'}]
                  </td>
                  <td>
                    [שלב: {selectedCase.current_stage || classifyWorkflowStage(selectedCase)}]{' '}
                    [סטטוס: {selectedCase.status}]
                  </td>
                  <td>
                    [{selectedCase.next_action_type}]{' '}
                    {selectedCase.next_action_description || ''} (
                    {selectedCase.next_due_date
                      ? formatDateHe(selectedCase.next_due_date)
                      : 'ללא יעד'}
                    )
                  </td>
                </tr>
              </tbody>
            </table>

            {selectedCase.notes && (
              <div
                style={{
                  border: '1px solid #000',
                  padding: '8px',
                  marginBottom: '12px',
                }}
              >
                <strong>הערות ליבה ותקציר התיק: </strong>
                {selectedCase.notes}
              </div>
            )}

            {(selectedCase.milestones || []).length > 0 && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 800, margin: '8px 0' }}>
                  משימות ושלבי ביצוע בתיק ({selectedCase.milestones?.length}):
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>תיאור המשימה</th>
                      <th>סטטוס</th>
                      <th>דחיפות</th>
                      <th>התחלה / סיום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedCase.milestones || []).map((m, idx) => (
                      <tr key={m.id}>
                        <td>{idx + 1}</td>
                        <td>{m.title}</td>
                        <td>
                          {m.status === 'done'
                            ? 'בוצע ✓'
                            : m.status === 'in_progress'
                            ? 'בתהליך'
                            : 'יבוצע בהמשך'}
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
              </div>
            )}
          </div>
        ) : (
          /* הדפסת טבלת תיקים מלאה בשחור-לבן חד עם תגיות טקסט מפורשות */
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>שם חייב / חברה / פרויקט</th>
                <th>מספר תיק ות&quot;ז</th>
                <th>קטגוריה ומחוז</th>
                <th>שלב וסטטוס</th>
                <th>פרטי תחום / חוב / מסירה</th>
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
                      {c.id_or_hp && <div>ח&quot;פ/ת&quot;ז: {c.id_or_hp}</div>}
                      {c.gush_helka && <div>גוש/חלקה: {c.gush_helka}</div>}
                    </td>
                    <td>
                      <div>[{c.category}]</div>
                      <div>[מחוז: {c.district || 'מרכז'}]</div>
                    </td>
                    <td>
                      <div>[שלב: {classifyWorkflowStage(c)}]</div>
                      <div>[סטטוס: {c.status}]</div>
                      {(c.is_hearing_postponed ||
                        (c.extensions_count || 0) > 0) && (
                        <div>
                          [נדחה: {c.extensions_count || 1} ארכות]
                        </div>
                      )}
                    </td>
                    <td>
                      {c.municipality && <div>רשות: {c.municipality}</div>}
                      {totalDebt > 0 && (
                        <div>חוב: {formatCurrencyILS(totalDebt)}</div>
                      )}
                      <div>[{classifyDeliveryStatus(c)}]</div>
                    </td>
                    <td>
                      <div>
                        <strong>[{c.next_action_type}]</strong>{' '}
                        {c.next_action_description || ''}
                      </div>
                      {(c.custom_fields || []).map((cf) => (
                        <div key={cf.id} style={{ fontSize: '11px' }}>
                          • {cf.label}: {String(cf.value || '')}{' '}
                          {cf.due_date ? `(${formatDateHe(cf.due_date)})` : ''}
                        </div>
                      ))}
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
      </div>
    </>
  );
}
