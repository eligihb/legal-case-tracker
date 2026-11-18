'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  PlusCircle,
  MessageSquare,
  CheckCircle2,
  Gavel,
  AlertTriangle,
  Calendar,
  Trash2,
  Clock,
  FileText,
  Building2,
  Calculator,
  Home,
  FileSpreadsheet,
  Milestone,
  TrendingDown,
  ShieldCheck,
  Plus,
  Timer,
  Printer,
  CheckSquare,
  ListChecks,
  Briefcase,
  Sparkles,
  Flame,
  Pencil,
  Check,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Columns3,
} from 'lucide-react';
import {
  CASE_CATEGORIES,
  CASE_DISTRICTS,
  CASE_STATUSES,
  CASE_TAGS,
  CATEGORY_LABELS,
  COMPANY_RESOLUTION_DECISIONS,
  CONDOMINIUM_FIT_STATUSES,
  CaseCategory,
  CaseDistrict,
  CaseItem,
  CaseLog,
  CaseMilestone,
  CaseStatus,
  CaseTag,
  CompanyResolutionDecision,
  CondominiumFitStatus,
  GACHLAT_STATUSES,
  GachlatStatus,
  INSOLVENCY_DEBTOR_TYPES,
  INVESTIGATION_OUTCOMES,
  InsolvencyDebtorType,
  InvestigationOutcome,
  LOG_TYPES,
  LogType,
  MilestoneStatus,
  MonthlyReductionEntry,
  MunicipalitySetting,
  NET_HAMISHPAT_STATUSES,
  NEXT_ACTION_TYPES,
  NetHaMishpatStatus,
  NextActionType,
  TASK_URGENCIES,
  TaskUrgency,
  UserSession,
  WRITEOFF_CLASSIFICATIONS,
  WriteoffClassification,
} from '@/types/database';
import {
  addCaseLog,
  bulkApplyDistrictToCases,
  deleteCaseItem,
  deleteCaseLog,
  fetchCaseLogs,
  generateId,
  updateCaseItem,
} from '@/lib/dataService';
import {
  addDaysToDateStr,
  calculateMilestoneDays,
  formatCurrencyILS,
  formatDateHe,
  formatDateTimeHe,
  getDueCountdown,
  isDeliveryOver30DaysAlert,
} from '@/lib/dateUtils';
import { exportSingleCaseToXlsx } from './ExcelExportModal';
import CopyButton from './CopyButton';
import { InlineCustomFieldsList } from './CustomFieldsManager';

export type DrawerTab = 'executive' | 'overview' | 'tasks' | 'logs';
export type CasePrintZone =
  | 'summary'
  | 'active_tab'
  | 'overview'
  | 'tasks'
  | 'logs'
  | 'full';

interface CaseDrawerProps {
  caseItem: CaseItem | null;
  initialTab?: DrawerTab;
  onClose: () => void;
  onCaseUpdated: (updated: CaseItem) => void;
  onAllCasesUpdated?: (updatedCases: CaseItem[]) => void;
  onOpenAddCustomField?: (targetCase: CaseItem) => void;
  onToggleArchive?: (caseItem: CaseItem) => void;
  onPrintCaseZone?: (
    caseData: CaseItem,
    logsData: CaseLog[],
    zone: CasePrintZone,
    activeTab: DrawerTab
  ) => void;
  onCaseDeleted: (id: string) => void;
  municipalitiesSettings: MunicipalitySetting[];
  currentUser: UserSession;
  onOpenMuniSettingsModal?: () => void;
}

export default function CaseDrawer({
  caseItem,
  initialTab = 'executive',
  onClose,
  onCaseUpdated,
  onAllCasesUpdated,
  onOpenAddCustomField,
  onToggleArchive,
  onPrintCaseZone,
  onCaseDeleted,
  municipalitiesSettings,
  currentUser,
  onOpenMuniSettingsModal,
}: CaseDrawerProps) {
  const isAdmin = currentUser.role === 'admin';
  const [activeTab, setActiveTab] = useState<DrawerTab>('executive');
  const [selectedPrintZone, setSelectedPrintZone] =
    useState<CasePrintZone>('active_tab');
  const [rshuSubTab, setRshuSubTab] = useState<'pre_suit' | 'execution'>(
    'pre_suit'
  );
  const [logSortOrder, setLogSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showCompletedTasksExec, setShowCompletedTasksExec] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTaskDueDate, setNewTaskDueDate] = useState('');

  const [logs, setLogs] = useState<CaseLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    'idle' | 'saving' | 'saved'
  >('idle');

  // שדות ליבה של התיק
  const [debtorName, setDebtorName] = useState('');
  const [subject, setSubject] = useState('');
  const [idOrHp, setIdOrHp] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [gushHelka, setGushHelka] = useState('');
  const [category, setCategory] = useState<CaseCategory>('גבייה');
  const [district, setDistrict] = useState<CaseDistrict>('מרכז');
  const [currentStage, setCurrentStage] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [tags, setTags] = useState<CaseTag[]>([]);
  const [status, setStatus] = useState<CaseStatus>('לפני תביעה');
  const [netStatus, setNetStatus] =
    useState<NetHaMishpatStatus>('ללא מעקב פעיל');
  const [notes, setNotes] = useState('');
  const [nextActionType, setNextActionType] = useState<NextActionType>('אחר');
  const [nextActionDescription, setNextActionDescription] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [extensionsCount, setExtensionsCount] = useState<number>(0);
  const [isHearingPostponed, setIsHearingPostponed] = useState<boolean>(false);
  const [postponedReason, setPostponedReason] = useState('');
  const [trusteeReportDueDate, setTrusteeReportDueDate] = useState('');

  // 1. שדות מודול תיקי רשויות:
  const [debtYears, setDebtYears] = useState('');
  const [principalAmount, setPrincipalAmount] = useState<number>(0);
  const [interestAmount, setInterestAmount] = useState<number>(0);
  const [expensesAmount, setExpensesAmount] = useState<number>(0);
  const [legalFeeAmount, setLegalFeeAmount] = useState<number>(0);

  const [gachlatStatus, setGachlatStatus] =
    useState<GachlatStatus>('חסר גח"לת');
  const [hasProperty, setHasProperty] = useState<boolean>(false);
  const [propertyDetails, setPropertyDetails] = useState('');
  const [warningLetterSentDate, setWarningLetterSentDate] = useState('');
  const [deliveryConfirmationDate, setDeliveryConfirmationDate] = useState('');
  const [executionTargetDate, setExecutionTargetDate] = useState('');

  const [executionProceedingsNotes, setExecutionProceedingsNotes] =
    useState('');
  const [monthlyReductions, setMonthlyReductions] = useState<
    MonthlyReductionEntry[]
  >([]);
  const [milestones, setMilestones] = useState<CaseMilestone[]>([]);

  const [isOldDebtWriteoff, setIsOldDebtWriteoff] = useState<boolean>(false);
  const [writeoffClassification, setWriteoffClassification] =
    useState<WriteoffClassification | null>(null);
  const [legalOpinionSummary, setLegalOpinionSummary] = useState('');

  // 2. שדות מודול תיקי חדל"פ:
  const [isMaterialCreditor, setIsMaterialCreditor] = useState<boolean>(false);
  const [insolvencyDebtorType, setInsolvencyDebtorType] =
    useState<InsolvencyDebtorType>('חייב יחיד');
  const [trusteeNameAndContact, setTrusteeNameAndContact] = useState('');
  const [debtClaimDeadline, setDebtClaimDeadline] = useState('');
  const [debtClaimSubmitted, setDebtClaimSubmitted] = useState<boolean>(false);
  const [debtClaimAmount, setDebtClaimAmount] = useState<number>(0);
  const [creditorResponsesNotes, setCreditorResponsesNotes] = useState('');
  const [newDebtsTracking, setNewDebtsTracking] = useState('');

  // 3. שדות מודול תיקי חברות (נאמן / מפרק):
  const [selfUndertakingDeposited, setSelfUndertakingDeposited] =
    useState<boolean>(false);
  const [selfUndertakingDate, setSelfUndertakingDate] = useState('');
  const [insuranceAndAssetsLettersStatus, setInsuranceAndAssetsLettersStatus] =
    useState('');
  const [representativeContactDetails, setRepresentativeContactDetails] =
    useState('');
  const [investigatingTrusteeName, setInvestigatingTrusteeName] = useState('');
  const [investigationScheduledDate, setInvestigationScheduledDate] =
    useState('');
  const [requiredDocumentsChecklist, setRequiredDocumentsChecklist] =
    useState('');
  const [investigationOutcome, setInvestigationOutcome] =
    useState<InvestigationOutcome>('טרם נחקר');
  const [missingDocumentsDetails, setMissingDocumentsDetails] = useState('');
  const [trusteeFindingsSummary, setTrusteeFindingsSummary] = useState('');
  const [companyResolutionDecision, setCompanyResolutionDecision] =
    useState<CompanyResolutionDecision>('טרם הוכרע');

  // 4. שדות מודול חברה משכנת (רישום וזכויות):
  const [housingProjectName, setHousingProjectName] = useState('');
  const [liquidatorsSaleApproval, setLiquidatorsSaleApproval] =
    useState<boolean>(false);
  const [physicalFilesLocation, setPhysicalFilesLocation] = useState('');
  const [rightsCertificateIssued, setRightsCertificateIssued] =
    useState<boolean>(false);
  const [surveyorName, setSurveyorName] = useState('');
  const [tazarStatus, setTazarStatus] = useState('');
  const [parkingTazarHandled, setParkingTazarHandled] =
    useState<boolean>(false);
  const [parkingTazarNotes, setParkingTazarNotes] = useState('');
  const [condominiumRegistrationFit, setCondominiumRegistrationFit] =
    useState<CondominiumFitStatus>('בבדיקה');
  const [invoicesCourtControl, setInvoicesCourtControl] = useState('');
  const [sellerBuyerNames, setSellerBuyerNames] = useState('');
  const [transferSigningDocsComplete, setTransferSigningDocsComplete] =
    useState<boolean>(false);
  const [transferLiquidatorApproved, setTransferLiquidatorApproved] =
    useState<boolean>(false);
  const [transferProcessStage, setTransferProcessStage] = useState('');
  const [newBuyerCertificateIssued, setNewBuyerCertificateIssued] =
    useState<boolean>(false);

  // הוספת משימה חדשה בצ'ק-ליסט (עם דחיפות ומשך ביצוע מתוכנן בימים)
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneUrgency, setNewMilestoneUrgency] =
    useState<TaskUrgency>('גבוהה');
  const [newMilestonePlannedDays, setNewMilestonePlannedDays] = useState<
    number | ''
  >('');

  // הוספת שורת דיווח הפחתה חודשית חדשה
  const [newRedMonth, setNewRedMonth] = useState('');
  const [newRedAmount, setNewRedAmount] = useState<number>(0);
  const [newRedNotes, setNewRedNotes] = useState('');

  // טופס מהיר להוספת תרשומת שיחה / הערה / תזכורת / החלטה / ארכה ודחיית דיון
  const [logType, setLogType] = useState<LogType>('תרשומת שיחה');
  const [logContent, setLogContent] = useState('');
  const [updateNextInOneClick, setUpdateNextInOneClick] = useState(true);
  const [quickNextActionType, setQuickNextActionType] =
    useState<NextActionType>('תגובה');
  const [quickNextActionDesc, setQuickNextActionDesc] = useState('');
  const [quickNextDueDate, setQuickNextDueDate] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  const initializedCaseIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (caseItem) {
      document.body.classList.add('case-drawer-open');
    } else {
      document.body.classList.remove('case-drawer-open');
    }
    return () => {
      document.body.classList.remove('case-drawer-open');
    };
  }, [caseItem]);

  useEffect(() => {
    if (caseItem) {
      setActiveTab(initialTab || 'executive');
    }
  }, [caseItem?.id, initialTab]);

  useEffect(() => {
    if (!caseItem) {
      initializedCaseIdRef.current = null;
      return;
    }
    initializedCaseIdRef.current = null;
    setActiveTab(initialTab || 'executive');
    setRshuSubTab(
      caseItem.status === 'לפני תביעה' ? 'pre_suit' : 'execution'
    );

    setDebtorName(caseItem.debtor_name);
    setSubject(caseItem.subject || '');
    setIdOrHp(caseItem.id_or_hp || '');
    setCaseNumber(caseItem.case_number || '');
    setGushHelka(caseItem.gush_helka || caseItem.property_details || '');
    setCategory(caseItem.category);
    setDistrict(caseItem.district || 'מרכז');
    setCurrentStage(
      caseItem.current_stage ||
        (caseItem.category === 'גבייה'
          ? 'לפני תביעה - בדיקות מקדמיות'
          : 'פתיחת תיק ובדיקות')
    );
    setMunicipality(caseItem.municipality || '');
    setTags(caseItem.tags || []);
    setStatus(caseItem.status);
    setNetStatus(caseItem.net_hamishpat_status || 'ללא מעקב פעיל');
    setNotes(caseItem.notes || '');
    setNextActionType(caseItem.next_action_type || 'אחר');
    setNextActionDescription(caseItem.next_action_description || '');
    setNextDueDate(caseItem.next_due_date || '');
    setExtensionsCount(Number(caseItem.extensions_count) || 0);
    setIsHearingPostponed(Boolean(caseItem.is_hearing_postponed));
    setPostponedReason(caseItem.postponed_reason || '');
    setTrusteeReportDueDate(caseItem.trustee_report_due_date || '');

    // 1. רשויות
    setDebtYears(caseItem.debt_years || '');
    setPrincipalAmount(Number(caseItem.principal_amount) || 0);
    setInterestAmount(Number(caseItem.interest_amount) || 0);
    setExpensesAmount(Number(caseItem.expenses_amount) || 0);
    setLegalFeeAmount(Number(caseItem.legal_fee_amount) || 0);

    setGachlatStatus(caseItem.gachlat_status || 'חסר גח"לת');
    setHasProperty(Boolean(caseItem.has_property));
    setPropertyDetails(caseItem.property_details || '');
    setWarningLetterSentDate(caseItem.warning_letter_sent_date || '');
    setDeliveryConfirmationDate(caseItem.delivery_confirmation_date || '');
    setExecutionTargetDate(
      caseItem.execution_target_date ||
        addDaysToDateStr(caseItem.delivery_confirmation_date, 30) ||
        ''
    );

    setExecutionProceedingsNotes(caseItem.execution_proceedings_notes || '');
    setMonthlyReductions(caseItem.monthly_reductions || []);
    setMilestones(caseItem.milestones || []);

    setIsOldDebtWriteoff(Boolean(caseItem.is_old_debt_writeoff));
    setWriteoffClassification(caseItem.writeoff_classification || null);
    setLegalOpinionSummary(caseItem.legal_opinion_summary || '');

    // 2. חדל"פ
    setIsMaterialCreditor(Boolean(caseItem.is_material_creditor));
    setInsolvencyDebtorType(caseItem.insolvency_debtor_type || 'חייב יחיד');
    setTrusteeNameAndContact(caseItem.trustee_name_and_contact || '');
    setDebtClaimDeadline(caseItem.debt_claim_deadline || '');
    setDebtClaimSubmitted(Boolean(caseItem.debt_claim_submitted));
    setDebtClaimAmount(Number(caseItem.debt_claim_amount) || 0);
    setCreditorResponsesNotes(caseItem.creditor_responses_notes || '');
    setNewDebtsTracking(caseItem.new_debts_tracking || '');

    // 3. חברות
    setSelfUndertakingDeposited(Boolean(caseItem.self_undertaking_deposited));
    setSelfUndertakingDate(caseItem.self_undertaking_date || '');
    setInsuranceAndAssetsLettersStatus(
      caseItem.insurance_and_assets_letters_status || ''
    );
    setRepresentativeContactDetails(
      caseItem.representative_contact_details || ''
    );
    setInvestigatingTrusteeName(caseItem.investigating_trustee_name || '');
    setInvestigationScheduledDate(caseItem.investigation_scheduled_date || '');
    setRequiredDocumentsChecklist(caseItem.required_documents_checklist || '');
    setInvestigationOutcome(caseItem.investigation_outcome || 'טרם נחקר');
    setMissingDocumentsDetails(caseItem.missing_documents_details || '');
    setTrusteeFindingsSummary(caseItem.trustee_findings_summary || '');
    setCompanyResolutionDecision(
      caseItem.company_resolution_decision || 'טרם הוכרע'
    );

    // 4. חברה משכנת
    setHousingProjectName(caseItem.housing_project_name || '');
    setLiquidatorsSaleApproval(Boolean(caseItem.liquidators_sale_approval));
    setPhysicalFilesLocation(caseItem.physical_files_location || '');
    setRightsCertificateIssued(Boolean(caseItem.rights_certificate_issued));
    setSurveyorName(caseItem.surveyor_name || '');
    setTazarStatus(caseItem.tazar_status || '');
    setParkingTazarHandled(Boolean(caseItem.parking_tazar_handled));
    setParkingTazarNotes(caseItem.parking_tazar_notes || '');
    setCondominiumRegistrationFit(
      caseItem.condominium_registration_fit || 'בבדיקה'
    );
    setInvoicesCourtControl(caseItem.invoices_court_control || '');
    setSellerBuyerNames(caseItem.seller_buyer_names || '');
    setTransferSigningDocsComplete(
      Boolean(caseItem.transfer_signing_docs_complete)
    );
    setTransferLiquidatorApproved(
      Boolean(caseItem.transfer_liquidator_approved)
    );
    setTransferProcessStage(caseItem.transfer_process_stage || '');
    setNewBuyerCertificateIssued(
      Boolean(caseItem.new_buyer_certificate_issued)
    );

    setLogType('תרשומת שיחה');
    setLogContent('');
    setQuickNextActionType(caseItem.next_action_type || 'תגובה');
    setQuickNextActionDesc('');
    setQuickNextDueDate('');

    setLoadingLogs(true);
    let initTimer: ReturnType<typeof setTimeout> | null = null;
    fetchCaseLogs(caseItem.id)
      .then((data) => setLogs(data))
      .catch((err) => console.error(err))
      .finally(() => {
        setLoadingLogs(false);
        initTimer = setTimeout(() => {
          initializedCaseIdRef.current = caseItem.id;
        }, 150);
      });
    return () => {
      if (initTimer) clearTimeout(initTimer);
    };
  }, [caseItem?.id]);

  // שליפת הגדרות הרשות הרלוונטית
  const matchedMunicipalitySetting = useMemo(() => {
    if (!municipality.trim()) return null;
    const norm = municipality.trim().toLowerCase();
    return (
      municipalitiesSettings.find(
        (m) =>
          m.municipality_name.toLowerCase() === norm ||
          m.municipality_name.toLowerCase().includes(norm) ||
          norm.includes(m.municipality_name.toLowerCase())
      ) || null
    );
  }, [municipality, municipalitiesSettings]);

  const totalCalculatedDebt = useMemo(() => {
    return (
      (Number(principalAmount) || 0) +
      (Number(interestAmount) || 0) +
      (Number(expensesAmount) || 0) +
      (Number(legalFeeAmount) || 0)
    );
  }, [principalAmount, interestAmount, expensesAmount, legalFeeAmount]);

  // פונקציית שמירה חיה במקום (Auto-Save)
  const persistCaseUpdates = async (
    overrides?: Partial<Omit<CaseItem, 'id' | 'updated_at'>>
  ) => {
    if (!caseItem || !debtorName.trim()) return;
    setAutoSaveStatus('saving');
    try {
      const payload: Partial<Omit<CaseItem, 'id' | 'updated_at'>> = {
        debtor_name: debtorName.trim(),
        subject: subject.trim(),
        id_or_hp: idOrHp.trim(),
        case_number: caseNumber.trim(),
        gush_helka: gushHelka.trim(),
        category,
        district,
        current_stage: currentStage.trim(),
        municipality: municipality.trim() || null,
        tags,
        status,
        net_hamishpat_status: netStatus,
        notes: notes.trim(),
        next_action_type: nextActionType,
        next_action_description: nextActionDescription.trim(),
        next_due_date: nextDueDate || null,
        extensions_count: Number(extensionsCount) || 0,
        is_hearing_postponed: isHearingPostponed,
        postponed_reason: postponedReason.trim(),
        trustee_report_due_date: trusteeReportDueDate || null,

        // רשויות
        debt_years: debtYears.trim(),
        principal_amount: Number(principalAmount) || 0,
        interest_amount: Number(interestAmount) || 0,
        expenses_amount: Number(expensesAmount) || 0,
        legal_fee_amount: Number(legalFeeAmount) || 0,
        gachlat_status: gachlatStatus,
        has_property: hasProperty,
        property_details: propertyDetails.trim(),
        warning_letter_sent_date: warningLetterSentDate || null,
        delivery_confirmation_date: deliveryConfirmationDate || null,
        execution_target_date: executionTargetDate || null,
        execution_proceedings_notes: executionProceedingsNotes.trim(),
        monthly_reductions: monthlyReductions,
        milestones,
        is_old_debt_writeoff: isOldDebtWriteoff,
        writeoff_classification: writeoffClassification,
        legal_opinion_summary: legalOpinionSummary.trim(),

        // חדל"פ
        is_material_creditor: isMaterialCreditor,
        insolvency_debtor_type: insolvencyDebtorType,
        trustee_name_and_contact: trusteeNameAndContact.trim(),
        debt_claim_deadline: debtClaimDeadline || null,
        debt_claim_submitted: debtClaimSubmitted,
        debt_claim_amount: Number(debtClaimAmount) || 0,
        creditor_responses_notes: creditorResponsesNotes.trim(),
        new_debts_tracking: newDebtsTracking.trim(),

        // חברות
        self_undertaking_deposited: selfUndertakingDeposited,
        self_undertaking_date: selfUndertakingDate || null,
        insurance_and_assets_letters_status:
          insuranceAndAssetsLettersStatus.trim(),
        representative_contact_details: representativeContactDetails.trim(),
        investigating_trustee_name: investigatingTrusteeName.trim(),
        investigation_scheduled_date: investigationScheduledDate || null,
        required_documents_checklist: requiredDocumentsChecklist.trim(),
        investigation_outcome: investigationOutcome,
        missing_documents_details: missingDocumentsDetails.trim(),
        trustee_findings_summary: trusteeFindingsSummary.trim(),
        company_resolution_decision: companyResolutionDecision,

        // חברה משכנת
        housing_project_name: housingProjectName.trim(),
        liquidators_sale_approval: liquidatorsSaleApproval,
        physical_files_location: physicalFilesLocation.trim(),
        rights_certificate_issued: rightsCertificateIssued,
        surveyor_name: surveyorName.trim(),
        tazar_status: tazarStatus.trim(),
        parking_tazar_handled: parkingTazarHandled,
        parking_tazar_notes: parkingTazarNotes.trim(),
        condominium_registration_fit: condominiumRegistrationFit,
        invoices_court_control: invoicesCourtControl.trim(),
        seller_buyer_names: sellerBuyerNames.trim(),
        transfer_signing_docs_complete: transferSigningDocsComplete,
        transfer_liquidator_approved: transferLiquidatorApproved,
        transfer_process_stage: transferProcessStage.trim(),
        new_buyer_certificate_issued: newBuyerCertificateIssued,

        ...overrides,
      };

      const updated = await updateCaseItem(caseItem.id, payload);
      onCaseUpdated(updated);
      setAutoSaveStatus('saved');
    } catch (err) {
      console.error('Auto-save error:', err);
      setAutoSaveStatus('idle');
    }
  };

  // Auto-Save חי בכל שינוי שדה
  useEffect(() => {
    if (!caseItem || initializedCaseIdRef.current !== caseItem.id) return;
    const timer = setTimeout(() => {
      persistCaseUpdates();
    }, 400);
    return () => clearTimeout(timer);
  }, [
    debtorName,
    subject,
    idOrHp,
    caseNumber,
    gushHelka,
    category,
    district,
    currentStage,
    municipality,
    tags,
    status,
    netStatus,
    notes,
    nextActionType,
    nextActionDescription,
    nextDueDate,
    extensionsCount,
    isHearingPostponed,
    postponedReason,
    trusteeReportDueDate,
    debtYears,
    principalAmount,
    interestAmount,
    expensesAmount,
    legalFeeAmount,
    gachlatStatus,
    hasProperty,
    propertyDetails,
    warningLetterSentDate,
    deliveryConfirmationDate,
    executionTargetDate,
    executionProceedingsNotes,
    monthlyReductions,
    milestones,
    isOldDebtWriteoff,
    writeoffClassification,
    legalOpinionSummary,
    isMaterialCreditor,
    insolvencyDebtorType,
    trusteeNameAndContact,
    debtClaimDeadline,
    debtClaimSubmitted,
    debtClaimAmount,
    creditorResponsesNotes,
    newDebtsTracking,
    selfUndertakingDeposited,
    selfUndertakingDate,
    insuranceAndAssetsLettersStatus,
    representativeContactDetails,
    investigatingTrusteeName,
    investigationScheduledDate,
    requiredDocumentsChecklist,
    investigationOutcome,
    missingDocumentsDetails,
    trusteeFindingsSummary,
    companyResolutionDecision,
    housingProjectName,
    liquidatorsSaleApproval,
    physicalFilesLocation,
    rightsCertificateIssued,
    surveyorName,
    tazarStatus,
    parkingTazarHandled,
    parkingTazarNotes,
    condominiumRegistrationFit,
    invoicesCourtControl,
    sellerBuyerNames,
    transferSigningDocsComplete,
    transferLiquidatorApproved,
    transferProcessStage,
    newBuyerCertificateIssued,
  ]);

  if (!caseItem) return null;

  const countdown = getDueCountdown(nextDueDate || null);
  const claimCountdown = getDueCountdown(debtClaimDeadline || null);
  const trusteeReportCountdown = getDueCountdown(trusteeReportDueDate || null);
  const deliveryAlertInfo = isDeliveryOver30DaysAlert({
    ...caseItem,
    category,
    status,
    delivery_confirmation_date: deliveryConfirmationDate || null,
    execution_target_date: executionTargetDate || null,
  });

  // ============================================================================
  // אוטומציות וטריגרים חכמים לכל 4 סוגי התיקים
  // ============================================================================

  // 1. חישוב שכ"ט אוטומטי לפי כללי הרשות
  const handleCalculateLegalFeeByMuniRule = () => {
    if (!matchedMunicipalitySetting) {
      alert(
        'לא נמצאה הגדרת רשות תואמת. בחר רשות או הגדר אותה במסך הגדרות רשויות.'
      );
      return;
    }
    let calculated = 0;
    if (matchedMunicipalitySetting.fee_calculation_method === 'סכום קבוע') {
      calculated = Number(matchedMunicipalitySetting.fee_rate_value) || 0;
    } else {
      const base =
        (Number(principalAmount) || 0) + (Number(interestAmount) || 0);
      calculated = Math.round(
        base * ((Number(matchedMunicipalitySetting.fee_rate_value) || 15) / 100)
      );
    }
    setLegalFeeAmount(calculated);
  };

  // 2. מתג "קיים נכס? (כן / לא)" -> יוצר משימת רישום משכון
  const handleToggleHasProperty = (val: boolean) => {
    setHasProperty(val);
    if (val) {
      const exists = milestones.some((m) =>
        m.title.includes('רישום משכון על הנכס')
      );
      if (!exists) {
        const today = new Date().toISOString().split('T')[0];
        const newMs: CaseMilestone = {
          id: generateId(),
          title: 'רישום משכון על הנכס',
          status: 'in_progress',
          urgency: 'דחוף מאוד',
          planned_days: 7,
          started_at: today,
          completed_at: null,
          days_spent: 0,
          updated_by: currentUser.displayName,
        };
        setMilestones((prev) => [...prev, newMs]);
      }
      if (!tags.includes('משכון רשום')) {
        setTags((prev) => [...prev, 'משכון רשום']);
      }
    }
  };

  // 3. תאריך אישור מסירה -> מחשב אוטומטית אישור מסירה + 30 ימים לפתיחת תביעה בהוצל"פ
  const handleDeliveryConfirmationDateChange = (dateVal: string) => {
    setDeliveryConfirmationDate(dateVal);
    if (dateVal) {
      const target30 = addDaysToDateStr(dateVal, 30);
      if (target30) {
        setExecutionTargetDate(target30);
        setNextDueDate(target30);
        setNextActionType('פתיחת תביעה בהוצל"פ');
        setNextActionDescription(
          'חלוף 30 יום מאישור מסירה — פתיחת תביעה בהוצל"פ'
        );
      }
    } else {
      setExecutionTargetDate('');
    }
  };

  // 4. שינוי סטטוס התיק -> טריגרים אוטומטיים של הסדר תשלומים / סילוק חוב / מחיקת חוב ישן
  const handleStatusChangeWithTriggers = (newStatus: CaseStatus) => {
    setStatus(newStatus);
    const today = new Date().toISOString().split('T')[0];
    const updatedMilestones = [...milestones];

    const ensureMilestone = (
      title: string,
      msStatus: MilestoneStatus = 'in_progress',
      urgency: TaskUrgency = 'גבוהה',
      planned = 7
    ) => {
      if (!updatedMilestones.some((m) => m.title === title)) {
        updatedMilestones.push({
          id: generateId(),
          title,
          status: msStatus,
          urgency,
          planned_days: planned,
          started_at: msStatus === 'in_progress' ? today : null,
          completed_at: null,
          days_spent: 0,
          updated_by: currentUser.displayName,
        });
      }
    };

    if (newStatus === 'בהסדר תשלומים' || newStatus === 'בהסדר') {
      ensureMilestone('עדכון ההסדר בהוצל"פ', 'in_progress', 'גבוהה', 3);
      ensureMilestone(
        'הגשת בקשה לעיכוב הליכים תוך השארת עיקולים קיימים',
        'in_progress',
        'דחוף מאוד',
        3
      );
      ensureMilestone(
        'שחרור עיקולים וסגירת תיק בתום ההסדר',
        'upcoming',
        'רגילה',
        14
      );
      setCurrentStage('הוצל"פ - בהסדר תשלומים (עיקולים קיימים מוקפאים)');
      setNextActionType('מעקב הסדר');
      setNextActionDescription(
        'עדכון ההסדר בהוצל"פ, עיכוב הליכים תוך השארת עיקולים קיימים ומעקב תשלומים'
      );
    } else if (newStatus === 'סיום הסדר / סילוק חוב') {
      ensureMilestone(
        'הגשת בקשה לשחרור עיקולים וסגירת תיק הוצל"פ',
        'in_progress',
        'דחוף מאוד',
        3
      );
      setCurrentStage('סיום הסדר / סילוק חוב — נדרש שחרור עיקולים וסגירה');
      setNextActionType('שחרור עיקולים וסגירה');
      setNextActionDescription(
        'הגשת בקשה לשחרור עיקולים וסגירת תיק הוצל"פ'
      );
    } else if (newStatus === 'מחיקת חוב ישן') {
      setIsOldDebtWriteoff(true);
      ensureMilestone(
        'הכנת חוות דעת משפטית למחיקת חוב ישן',
        'in_progress',
        'גבוהה',
        10
      );
      setCurrentStage('בחינת מחיקת חוב ישן והכנת חוות דעת משפטית');
      setNextActionType('חוות דעת למחיקת חוב');
      setNextActionDescription('הכנת חוות דעת משפטית למחיקת חוב ישן');
    } else if (newStatus === 'דיון נדחה') {
      setIsHearingPostponed(true);
    }

    setMilestones(updatedMilestones);
  };

  // 5. טריגר תוצאות חקירה בתיקי חברות (נאמן / מפרק):
  // אם לא הגיע -> משימה דחופה לבקשת צו הבאה; אם חסרים מסמכים -> מעקב השלמות מסמכים
  const handleInvestigationOutcomeChange = (outcome: InvestigationOutcome) => {
    setInvestigationOutcome(outcome);
    const today = new Date().toISOString().split('T')[0];
    const nextMs = [...milestones];

    if (outcome === 'לא התייצב לחקירה') {
      if (!nextMs.some((m) => m.title.includes('צו הבאה'))) {
        nextMs.push({
          id: generateId(),
          title: 'הגשת בקשה דחופה לצו הבאה לביהמ"ש (אי-התייצבות לחקירה)',
          status: 'in_progress',
          urgency: 'דחוף מאוד',
          planned_days: 2,
          started_at: today,
          completed_at: null,
          days_spent: 0,
          updated_by: currentUser.displayName,
        });
      }
      if (!tags.includes('צו הבאה')) {
        setTags((prev) => [...prev, 'צו הבאה']);
      }
      setCurrentStage('לא התייצב לחקירה — הגשת בקשה דחופה לצו הבאה');
      setNextActionType('בקשת צו הבאה');
      setNextActionDescription(
        'הגשת בקשה דחופה לצו הבאה לביהמ"ש עקב אי-התייצבות לחקירה'
      );
      setNextDueDate(today);
    } else if (outcome === 'חסרים מסמכים') {
      if (!nextMs.some((m) => m.title.includes('השלמות מסמכים'))) {
        nextMs.push({
          id: generateId(),
          title: 'מעקב השלמות מסמכים חסרים לאחר חקירה',
          status: 'in_progress',
          urgency: 'גבוהה',
          planned_days: 7,
          started_at: today,
          completed_at: null,
          days_spent: 0,
          updated_by: currentUser.displayName,
        });
      }
      setCurrentStage('מעקב השלמות מסמכים חסרים לאחר חקירה');
      setNextActionType('השלמת מסמכים');
      setNextActionDescription('דרישה ומעקב אחר השלמת מסמכים חסרים מהנחקר/מייצג');
    }
    setMilestones(nextMs);
  };

  // 6. ניהול משימות וצ'ק-ליסט + דחיפות + מדידת זמנים
  const handleMilestoneStatusChange = (
    msId: string,
    newMsStatus: MilestoneStatus
  ) => {
    const today = new Date().toISOString().split('T')[0];
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id !== msId) return m;
        const started =
          m.started_at || (newMsStatus !== 'upcoming' ? today : null);
        const completed = newMsStatus === 'done' ? today : null;
        const days = calculateMilestoneDays(started, completed);
        return {
          ...m,
          status: newMsStatus,
          started_at: started,
          completed_at: completed,
          days_spent: days,
          updated_by: currentUser.displayName,
        };
      })
    );
  };

  const handleMilestoneTitleChange = (msId: string, newTitle: string) => {
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === msId
          ? { ...m, title: newTitle, updated_by: currentUser.displayName }
          : m
      )
    );
  };

  const handleMilestoneUrgencyChange = (
    msId: string,
    urgency: TaskUrgency
  ) => {
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === msId
          ? { ...m, urgency, updated_by: currentUser.displayName }
          : m
      )
    );
  };

  const handleMilestonePlannedDaysChange = (msId: string, days: number) => {
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === msId
          ? {
              ...m,
              planned_days: Math.max(0, days),
              updated_by: currentUser.displayName,
            }
          : m
      )
    );
  };

  const handleMilestoneDueDateChange = (msId: string, dueDate: string) => {
    setMilestones((prev) =>
      prev.map((m) =>
        m.id === msId
          ? {
              ...m,
              due_date: dueDate || null,
              updated_by: currentUser.displayName,
            }
          : m
      )
    );
  };

  const handleAddMilestone = () => {
    if (!newMilestoneTitle.trim()) return;
    const today = new Date().toISOString().split('T')[0];
    const created: CaseMilestone = {
      id: generateId(),
      title: newMilestoneTitle.trim(),
      status: 'in_progress',
      urgency: newMilestoneUrgency,
      planned_days: Number(newMilestonePlannedDays) || 7,
      due_date: newTaskDueDate || null,
      started_at: today,
      completed_at: null,
      days_spent: 0,
      updated_by: currentUser.displayName,
    };
    setMilestones((prev) => [created, ...prev]);
    setNewMilestoneTitle('');
    setNewTaskDueDate('');
  };

  const handleDeleteMilestone = (msId: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== msId));
  };

  // 7. יומן הפחתות חודשי
  const handleAddMonthlyReduction = async () => {
    if (!newRedMonth.trim() || Number(newRedAmount) <= 0) return;
    const entry: MonthlyReductionEntry = {
      id: generateId(),
      month_year: newRedMonth.trim(),
      report_received: true,
      reported_amount: Number(newRedAmount) || 0,
      reduced_in_execution: false,
      reduction_date: null,
      performed_by: '',
      notes: newRedNotes.trim() || 'התקבל דיווח תשלום מהרשות',
    };
    setMonthlyReductions((prev) => [entry, ...prev]);
    setNewRedAmount(0);
    setNewRedNotes('');

    const log = await addCaseLog({
      case_id: caseItem.id,
      log_type: 'דיווח הפחתה',
      content: `נקלט דיווח תשלום חודשי מהרשות (${entry.month_year}) על סך ${formatCurrencyILS(
        entry.reported_amount
      )} — ממתין לביצוע הפחתה בתיק ההוצל"פ.`,
      created_by: currentUser.displayName,
    });
    setLogs((prev) => [log, ...prev]);
  };

  const handleToggleReductionExecuted = async (entryId: string) => {
    const today = new Date().toISOString().split('T')[0];
    let targetEntry: MonthlyReductionEntry | null = null;

    setMonthlyReductions((prev) =>
      prev.map((r) => {
        if (r.id !== entryId) return r;
        const nextVal = !r.reduced_in_execution;
        const updated: MonthlyReductionEntry = {
          ...r,
          reduced_in_execution: nextVal,
          reduction_date: nextVal ? today : null,
          performed_by: nextVal ? currentUser.displayName : '',
        };
        targetEntry = updated;
        return updated;
      })
    );

    if (
      targetEntry &&
      (targetEntry as MonthlyReductionEntry).reduced_in_execution
    ) {
      const e = targetEntry as MonthlyReductionEntry;
      const log = await addCaseLog({
        case_id: caseItem.id,
        log_type: 'דיווח הפחתה',
        content: `בוצעה הפחתה בתיק ההוצל"פ בגין דיווח חודש ${
          e.month_year
        } בסך ${formatCurrencyILS(e.reported_amount)} (בוצע ע"י ${
          currentUser.displayName
        } בתאריך ${formatDateHe(today)}).`,
        created_by: currentUser.displayName,
      });
      setLogs((prev) => [log, ...prev]);
    }
  };

  // 8. רישום דחיית דיון / ארכה אוטומטית + מונה ארכות/דחיות
  const handleIncrementExtensionOrPostpone = async () => {
    const nextCount = (Number(extensionsCount) || 0) + 1;
    setExtensionsCount(nextCount);
    setIsHearingPostponed(true);
    if (!tags.includes('דיון נדחה')) {
      setTags((prev) => [...prev, 'דיון נדחה']);
    }
    const log = await addCaseLog({
      case_id: caseItem.id,
      log_type: 'בקשת ארכה / דחיית דיון',
      content: `נרשמה בקשת ארכה / דחיית דיון מס׳ ${nextCount} בתיק — סומן כ"נדחה" (נחתם ע"י ${currentUser.displayName}).`,
      created_by: currentUser.displayName,
    });
    setLogs((prev) => [log, ...prev]);
  };

  const toggleTag = (tag: CaseTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleQuickLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logContent.trim()) return;

    setSubmittingLog(true);
    try {
      let nextExtCount = Number(extensionsCount) || 0;
      let nextPostponed = isHearingPostponed;
      let nextReason = postponedReason;

      if (logType === 'בקשת ארכה / דחיית דיון') {
        nextExtCount += 1;
        nextPostponed = true;
        nextReason = logContent.trim();
        setExtensionsCount(nextExtCount);
        setIsHearingPostponed(true);
        setPostponedReason(nextReason);
      }

      const createdLog = await addCaseLog({
        case_id: caseItem.id,
        log_type: logType,
        content: logContent.trim(),
        due_date:
          updateNextInOneClick && quickNextDueDate ? quickNextDueDate : null,
        created_by: currentUser.displayName,
      });

      setLogs((prev) => [createdLog, ...prev]);
      setLogContent('');

      if (updateNextInOneClick) {
        const updatedActionDesc =
          quickNextActionDesc.trim() || nextActionDescription.trim();
        const updatedDueDate = quickNextDueDate || nextDueDate || '';
        setNextActionType(quickNextActionType);
        setNextActionDescription(updatedActionDesc);
        setNextDueDate(updatedDueDate);
        setQuickNextActionDesc('');
        setQuickNextDueDate('');
        await persistCaseUpdates({
          next_action_type: quickNextActionType,
          next_action_description: updatedActionDesc,
          next_due_date: updatedDueDate || null,
          extensions_count: nextExtCount,
          is_hearing_postponed: nextPostponed,
          postponed_reason: nextReason,
        });
      }
    } catch (err) {
      console.error('Failed to add log:', err);
      alert('שגיאה בהוספת הרישום');
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!isAdmin) {
      alert('רק מנהל מערכת מורשה למחוק תרשומות');
      return;
    }
    try {
      await deleteCaseLog(logId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err) {
      console.error('Failed to delete log:', err);
    }
  };

  const handleDeleteEntireCase = async () => {
    if (!isAdmin) {
      alert('רק מנהל מערכת (admin) מורשה למחוק תיקים');
      return;
    }
    if (
      !window.confirm(
        `האם אתה בטוח שברצונך למחוק את התיק "${caseItem.debtor_name}" וכל התרשומות שלו?`
      )
    ) {
      return;
    }
    try {
      await deleteCaseItem(caseItem.id);
      onCaseDeleted(caseItem.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete case:', err);
      alert('שגיאה במחיקת התיק');
    }
  };

  const getUrgencyBadge = (urgency?: TaskUrgency) => {
    switch (urgency) {
      case 'דחוף מאוד':
        return 'bg-red-600 text-white border-red-700';
      case 'גבוהה':
        return 'bg-amber-500 text-white border-amber-600';
      case 'נמוכה':
        return 'bg-slate-200 text-slate-700 border-slate-300';
      default:
        return 'bg-blue-100 text-blue-900 border-blue-300';
    }
  };

  const doneCount = milestones.filter((m) => m.status === 'done').length;
  const inProgressCount = milestones.filter(
    (m) => m.status === 'in_progress'
  ).length;
  const upcomingCount = milestones.filter(
    (m) => m.status === 'upcoming'
  ).length;
  const progressPercent =
    milestones.length > 0
      ? Math.round((doneCount / milestones.length) * 100)
      : 0;

  const totalReductionsReported = monthlyReductions.reduce(
    (sum, r) => sum + (Number(r.reported_amount) || 0),
    0
  );

  const openMilestones = milestones.filter((m) => m.status !== 'done');
  const completedMilestones = milestones.filter((m) => m.status === 'done');

  const sortedLogs = [...logs].sort((a, b) => {
    const tA = new Date(a.log_date).getTime();
    const tB = new Date(b.log_date).getTime();
    return logSortOrder === 'desc' ? tB - tA : tA - tB;
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 case-drawer-print-wrapper">
      <div className="fixed inset-0 no-print" onClick={onClose} />

      <div
        dir="rtl"
        className="relative z-10 w-full max-w-6xl bg-white h-[100dvh] sm:h-[94vh] rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 flex flex-col overflow-hidden case-drawer-print-wrapper"
      >
        {/* שורת ניווט עליונה: מסך הבית > שם התיק + חזרה למסך קודם */}
        <div className="px-4 py-2 bg-slate-800 text-slate-200 border-b border-slate-700 flex items-center justify-between text-xs font-bold shrink-0 no-print">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="hover:text-white inline-flex items-center gap-1 text-sky-300 font-extrabold shrink-0"
            >
              <Home className="w-3.5 h-3.5" />
              <span>מסך הבית</span>
            </button>
            <span className="text-slate-500">&gt;</span>
            <span className="text-slate-300 shrink-0">{category}</span>
            <span className="text-slate-500">&gt;</span>
            <span className="text-white font-extrabold truncate">
              {debtorName}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-extrabold inline-flex items-center gap-1 transition shrink-0"
          >
            <span>חזרה למסך קודם ➔</span>
          </button>
        </div>

        {/* כותרת עליונה שקטה ונקייה עם כפתורי העתקה מהירה, ארכיון, הדפסה וייצוא לאקסל */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 bg-[#0F172A] text-white flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 text-xs font-extrabold rounded-full bg-white/15 text-white border border-white/25">
                {CATEGORY_LABELS[category]?.title}
              </span>

              <div className="inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg text-sm font-mono">
                <span>תיק: {caseNumber || 'ללא מספר'}</span>
                <CopyButton value={caseNumber} label="העתק מספר תיק" />
              </div>

              {idOrHp && (
                <div className="inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg text-sm font-mono">
                  <span>ת&quot;ז/ח&quot;פ: {idOrHp}</span>
                  <CopyButton value={idOrHp} label="העתק ת״ז/ח״פ" />
                </div>
              )}

              {gushHelka && (
                <div className="inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg text-sm">
                  <span>{gushHelka}</span>
                  <CopyButton value={gushHelka} label="העתק גוש/חלקה" />
                </div>
              )}

              {(isHearingPostponed || extensionsCount > 0) && (
                <span className="px-3 py-1 text-xs font-extrabold rounded-full bg-rose-500 text-white shadow-xs">
                  {isHearingPostponed ? 'דיון נדחה • ' : ''}
                  מונה דחיות/ארכות: {extensionsCount}
                </span>
              )}

              {countdown.urgency !== 'none' && (
                <span
                  className={`px-3 py-1 text-xs font-extrabold rounded-full ${
                    countdown.urgency === 'overdue'
                      ? 'bg-red-500 text-white'
                      : countdown.urgency === 'today'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  יעד: {countdown.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <h2 className="text-xl sm:text-2xl font-extrabold truncate">
                {debtorName}
              </h2>
              <CopyButton value={debtorName} label="העתק שם חייב/תיק" />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 no-print">
            <span className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-emerald-300 border border-white/15 font-bold">
              {autoSaveStatus === 'saving'
                ? 'שומר אוטומטית...'
                : 'Auto-Save פעיל ✓'}
            </span>

            {onToggleArchive && (
              <button
                type="button"
                onClick={() => onToggleArchive(caseItem)}
                className={`px-3.5 py-2 rounded-xl text-sm font-extrabold flex items-center gap-1.5 border transition ${
                  caseItem.is_archived
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                }`}
                title={
                  caseItem.is_archived
                    ? 'שחזר תיק מהארכיון לפעילים'
                    : 'העבר תיק לארכיון (הושלם / ארכיון)'
                }
              >
                <CheckCircle2 className="w-4 h-4" />
                {caseItem.is_archived ? 'שחזר מארכיון' : 'הושלם / ארכיון'}
              </button>
            )}

            {/* בחירת אזור הדפסה ספציפי בתיק (מסך נוכחי / תמצית נתונים עיקריים / משימות / תרשומות / תיק מלא) */}
            <div className="inline-flex items-center rounded-xl bg-white/15 border border-white/25 overflow-hidden">
              <select
                value={selectedPrintZone}
                onChange={(e) =>
                  setSelectedPrintZone(e.target.value as CasePrintZone)
                }
                aria-label="בחר אזור הדפסה בתיק"
                className="px-2.5 py-2 bg-slate-900/80 text-white text-xs font-extrabold outline-none cursor-pointer border-l border-white/20"
              >
                <option value="active_tab">
                  🖨️ הדפס מסך נוכחי (
                  {activeTab === 'executive'
                    ? 'תמצית, משימות ויומן'
                    : activeTab === 'overview'
                    ? 'שדות תחום מורחבים'
                    : activeTab === 'tasks'
                    ? 'משימות וזמנים'
                    : 'תרשומות וארכות'}
                  )
                </option>
                <option value="summary">
                  📋 תמצית תיק (נתונים עיקריים בלבד)
                </option>
                <option value="overview">
                  🏛️ מסך כללי + כל שדות התחום
                </option>
                <option value="tasks">
                  ✅ צ&apos;ק-ליסט משימות וזמנים בלבד
                </option>
                <option value="logs">
                  💬 יומן תרשומות וארכות בלבד
                </option>
                <option value="full">
                  📑 דוח תיק מלא (כל האזורים יחד)
                </option>
              </select>

              <button
                type="button"
                onClick={() => {
                  const snapshot: CaseItem = {
                    ...caseItem,
                    debtor_name: debtorName,
                    id_or_hp: idOrHp,
                    case_number: caseNumber,
                    gush_helka: gushHelka,
                    category,
                    district,
                    current_stage: currentStage,
                    municipality: municipality || null,
                    tags,
                    status,
                    notes,
                    next_action_type: nextActionType,
                    next_action_description: nextActionDescription,
                    next_due_date: nextDueDate || null,
                    extensions_count: extensionsCount,
                    is_hearing_postponed: isHearingPostponed,
                    postponed_reason: postponedReason,
                    trustee_report_due_date: trusteeReportDueDate || null,
                    debt_years: debtYears,
                    principal_amount: principalAmount,
                    interest_amount: interestAmount,
                    expenses_amount: expensesAmount,
                    legal_fee_amount: legalFeeAmount,
                    gachlat_status: gachlatStatus,
                    has_property: hasProperty,
                    property_details: propertyDetails,
                    warning_letter_sent_date: warningLetterSentDate || null,
                    delivery_confirmation_date:
                      deliveryConfirmationDate || null,
                    execution_target_date: executionTargetDate || null,
                    execution_proceedings_notes: executionProceedingsNotes,
                    monthly_reductions: monthlyReductions,
                    milestones,
                    is_old_debt_writeoff: isOldDebtWriteoff,
                    writeoff_classification: writeoffClassification,
                    legal_opinion_summary: legalOpinionSummary,
                    is_material_creditor: isMaterialCreditor,
                    insolvency_debtor_type: insolvencyDebtorType,
                    trustee_name_and_contact: trusteeNameAndContact,
                    debt_claim_deadline: debtClaimDeadline || null,
                    debt_claim_submitted: debtClaimSubmitted,
                    debt_claim_amount: debtClaimAmount,
                    creditor_responses_notes: creditorResponsesNotes,
                    new_debts_tracking: newDebtsTracking,
                    self_undertaking_deposited: selfUndertakingDeposited,
                    self_undertaking_date: selfUndertakingDate || null,
                    insurance_and_assets_letters_status:
                      insuranceAndAssetsLettersStatus,
                    representative_contact_details:
                      representativeContactDetails,
                    investigating_trustee_name: investigatingTrusteeName,
                    investigation_scheduled_date:
                      investigationScheduledDate || null,
                    required_documents_checklist: requiredDocumentsChecklist,
                    investigation_outcome: investigationOutcome,
                    missing_documents_details: missingDocumentsDetails,
                    trustee_findings_summary: trusteeFindingsSummary,
                    company_resolution_decision: companyResolutionDecision,
                    housing_project_name: housingProjectName,
                    liquidators_sale_approval: liquidatorsSaleApproval,
                    physical_files_location: physicalFilesLocation,
                    rights_certificate_issued: rightsCertificateIssued,
                    surveyor_name: surveyorName,
                    tazar_status: tazarStatus,
                    parking_tazar_handled: parkingTazarHandled,
                    parking_tazar_notes: parkingTazarNotes,
                    condominium_registration_fit: condominiumRegistrationFit,
                    invoices_court_control: invoicesCourtControl,
                    seller_buyer_names: sellerBuyerNames,
                    transfer_signing_docs_complete: transferSigningDocsComplete,
                    transfer_liquidator_approved: transferLiquidatorApproved,
                    transfer_process_stage: transferProcessStage,
                    new_buyer_certificate_issued: newBuyerCertificateIssued,
                  };
                  if (onPrintCaseZone) {
                    onPrintCaseZone(
                      snapshot,
                      logs,
                      selectedPrintZone,
                      activeTab
                    );
                  } else {
                    window.print();
                  }
                }}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition"
                title="הדפס את האזור שנבחר בתיק"
              >
                <Printer className="w-4 h-4" />
                <span>הדפס</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                exportSingleCaseToXlsx(
                  {
                    ...caseItem,
                    debtor_name: debtorName,
                    id_or_hp: idOrHp,
                    case_number: caseNumber,
                    gush_helka: gushHelka,
                    category,
                    current_stage: currentStage,
                    municipality: municipality || null,
                    tags,
                    status,
                    notes,
                    next_action_type: nextActionType,
                    next_action_description: nextActionDescription,
                    next_due_date: nextDueDate || null,
                    extensions_count: extensionsCount,
                    is_hearing_postponed: isHearingPostponed,
                    postponed_reason: postponedReason,
                    trustee_report_due_date: trusteeReportDueDate || null,
                    debt_years: debtYears,
                    principal_amount: principalAmount,
                    interest_amount: interestAmount,
                    expenses_amount: expensesAmount,
                    legal_fee_amount: legalFeeAmount,
                    gachlat_status: gachlatStatus,
                    has_property: hasProperty,
                    property_details: propertyDetails,
                    warning_letter_sent_date: warningLetterSentDate || null,
                    delivery_confirmation_date:
                      deliveryConfirmationDate || null,
                    execution_target_date: executionTargetDate || null,
                    execution_proceedings_notes: executionProceedingsNotes,
                    monthly_reductions: monthlyReductions,
                    milestones,
                    is_old_debt_writeoff: isOldDebtWriteoff,
                    writeoff_classification: writeoffClassification,
                    legal_opinion_summary: legalOpinionSummary,
                    is_material_creditor: isMaterialCreditor,
                    insolvency_debtor_type: insolvencyDebtorType,
                    trustee_name_and_contact: trusteeNameAndContact,
                    debt_claim_deadline: debtClaimDeadline || null,
                    debt_claim_submitted: debtClaimSubmitted,
                    debt_claim_amount: debtClaimAmount,
                    creditor_responses_notes: creditorResponsesNotes,
                    new_debts_tracking: newDebtsTracking,
                    self_undertaking_deposited: selfUndertakingDeposited,
                    self_undertaking_date: selfUndertakingDate || null,
                    insurance_and_assets_letters_status:
                      insuranceAndAssetsLettersStatus,
                    representative_contact_details:
                      representativeContactDetails,
                    investigating_trustee_name: investigatingTrusteeName,
                    investigation_scheduled_date:
                      investigationScheduledDate || null,
                    required_documents_checklist: requiredDocumentsChecklist,
                    investigation_outcome: investigationOutcome,
                    missing_documents_details: missingDocumentsDetails,
                    trustee_findings_summary: trusteeFindingsSummary,
                    company_resolution_decision: companyResolutionDecision,
                    housing_project_name: housingProjectName,
                    liquidators_sale_approval: liquidatorsSaleApproval,
                    physical_files_location: physicalFilesLocation,
                    rights_certificate_issued: rightsCertificateIssued,
                    surveyor_name: surveyorName,
                    tazar_status: tazarStatus,
                    parking_tazar_handled: parkingTazarHandled,
                    parking_tazar_notes: parkingTazarNotes,
                    condominium_registration_fit: condominiumRegistrationFit,
                    invoices_court_control: invoicesCourtControl,
                    seller_buyer_names: sellerBuyerNames,
                    transfer_signing_docs_complete: transferSigningDocsComplete,
                    transfer_liquidator_approved: transferLiquidatorApproved,
                    transfer_process_stage: transferProcessStage,
                    new_buyer_certificate_issued: newBuyerCertificateIssued,
                  },
                  logs
                )
              }
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold flex items-center gap-1.5 shadow-xs transition"
              title="ייצא את התיק הנוכחי לקובץ אקסל (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              ייצוא לאקסל (.xlsx)
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              title="סגור חלון (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* סרגל הלשוניות הפנימיות (Zero-Scroll Tabs) */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 no-print">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('executive')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'executive'
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <Columns3 className="w-4 h-4 text-sky-400 shrink-0" />
              <span>כרטיס תיק מרכזי (תמצית • משימות • יומן כרונולוגי)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'overview'
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <Milestone className="w-4 h-4 text-blue-400 shrink-0" />
              <span>שדות תחום מורחבים ({category})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'tasks'
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <ListChecks className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>טבלת זמנים ({doneCount}/{milestones.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition ${
                activeTab === 'logs'
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-amber-400 shrink-0" />
              <span>ארכיון תרשומות ({logs.length})</span>
            </button>

            {onOpenAddCustomField && (
              <button
                type="button"
                onClick={() => onOpenAddCustomField(caseItem)}
                className="px-3 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>+ שדה מעקב</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold hidden sm:inline">
              משתמש: <strong className="text-slate-800">{currentUser.displayName}</strong>
            </span>
            {isAdmin && (
              <button
                type="button"
                onClick={handleDeleteEntireCase}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 flex items-center gap-1 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                מחק תיק
              </button>
            )}
          </div>
        </div>

        {/* גוף החלון לפי הלשונית הפעילה */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50/70 case-drawer-scroll-body">
          {/* ================================================================ */}
          {/* לשונית ראשית (Zero-Scroll 3-Part Executive Case Card):           */}
          {/* 1. תמצית התיק  |  2. משימות לביצוע מול מה שבוצע  |  3. יומן כרונולוגי */}
          {/* ================================================================ */}
          {activeTab === 'executive' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full lg:min-h-[68dvh]">
              {/* ============================================================ */}
              {/* חלק 1 (ימין): תמצית התיק (Case Executive Summary)            */}
              {/* ============================================================ */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span>1. תמצית התיק</span>
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-900 border border-blue-200">
                      {progressPercent}% הושלם ({doneCount}/{milestones.length})
                    </span>
                  </div>

                  {/* תיבת תמצית בולטת ב-3-4 שורות */}
                  <div className="p-3 rounded-xl bg-blue-50/50 border-2 border-blue-200 space-y-2">
                    <div>
                      <label className="block text-xs font-extrabold text-blue-950 mb-1">
                        נושא התיק / מהות העניין
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="נושא מרכזי של התיק..."
                        className="w-full p-2 text-xs rounded-lg border border-blue-200 bg-white font-extrabold text-slate-900 outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-blue-950 mb-1">
                        תקציר מנהלים (3-4 שורות על מהות התיק והמצב הנוכחי)
                      </label>
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="סכם ב-3–4 שורות את מהות התיק, הסטטוס הנוכחי והצעד הבא..."
                        className="w-full p-2 text-xs rounded-lg border border-blue-200 bg-white font-medium text-slate-900 outline-none focus:border-blue-600 leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* סטטוס נוכחי + מעקב נט המשפט */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        סטטוס תיק נוכחי
                      </label>
                      <select
                        value={status}
                        onChange={(e) =>
                          handleStatusChangeWithTriggers(
                            e.target.value as CaseStatus
                          )
                        }
                        className="w-full p-2 text-xs rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900 outline-none focus:border-blue-600"
                      >
                        {CASE_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-indigo-900 mb-1">
                        מעקב נט המשפט והחלטות
                      </label>
                      <select
                        value={netStatus}
                        onChange={(e) =>
                          setNetStatus(e.target.value as NetHaMishpatStatus)
                        }
                        className="w-full p-2 text-xs rounded-xl border-2 border-indigo-300 bg-indigo-50/50 font-extrabold text-indigo-950 outline-none focus:border-indigo-600"
                      >
                        {NET_HAMISHPAT_STATUSES.map((ns) => (
                          <option key={ns} value={ns}>
                            {ns}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* הדיון הקרוב והצעד הבא */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                          הצעד הבא / סוג מועד
                        </label>
                        <select
                          value={nextActionType}
                          onChange={(e) =>
                            setNextActionType(e.target.value as NextActionType)
                          }
                          className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                        >
                          {NEXT_ACTION_TYPES.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                          מועד דיון / תאריך יעד
                        </label>
                        <input
                          type="date"
                          value={nextDueDate}
                          onChange={(e) => setNextDueDate(e.target.value)}
                          className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        פירוט הדיון הקרוב / הפעולה הבאה
                      </label>
                      <input
                        type="text"
                        value={nextActionDescription}
                        onChange={(e) =>
                          setNextActionDescription(e.target.value)
                        }
                        placeholder="מה נדרש לבצע לקראת המועד הקרוב..."
                        className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isHearingPostponed}
                          onChange={(e) =>
                            setIsHearingPostponed(e.target.checked)
                          }
                          className="rounded text-rose-600"
                        />
                        <span>דיון נדחה ({extensionsCount} דחיות)</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleIncrementExtensionOrPostpone}
                        className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 text-[11px] font-extrabold transition"
                      >
                        + תעד דחייה
                      </button>
                    </div>
                  </div>

                  {/* פרטי זיהוי מהירים (ניתנים להשלמה בכל עת) */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                        מספר תיק (ביהמ&quot;ש / הוצל&quot;פ)
                      </label>
                      <input
                        type="text"
                        value={caseNumber}
                        onChange={(e) => setCaseNumber(e.target.value)}
                        placeholder="ניתן להשלים כאן..."
                        className="w-full p-1.5 text-xs rounded-lg border border-slate-300 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                        ת&quot;ז / ח&quot;פ
                      </label>
                      <input
                        type="text"
                        value={idOrHp}
                        onChange={(e) => setIdOrHp(e.target.value)}
                        placeholder="ת״ז / ח״פ..."
                        className="w-full p-1.5 text-xs rounded-lg border border-slate-300 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold flex items-center justify-center gap-1.5 transition"
                >
                  <Milestone className="w-3.5 h-3.5 text-blue-600" />
                  <span>לכל שדות התחום המורחבים ({category}) ➔</span>
                </button>
              </div>

              {/* ============================================================ */}
              {/* חלק 2 (אמצע): משימות לביצוע מול מה שבוצע (To-Do vs Done)     */}
              {/* ============================================================ */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3 flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 shrink-0">
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <ListChecks className="w-5 h-5 text-emerald-600" />
                      <span>2. משימות לביצוע מול בוצע</span>
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs font-extrabold">
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                        פתוחות: {openMilestones.length}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                        בוצעו ✓: {completedMilestones.length}
                      </span>
                    </div>
                  </div>

                  {/* הוספה מהירה של משימה פתוחה */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newMilestoneTitle}
                        onChange={(e) => setNewMilestoneTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMilestone();
                          }
                        }}
                        placeholder="הוסף משימה חדשה לביצוע..."
                        className="flex-1 p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold outline-none focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={handleAddMilestone}
                        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shrink-0 transition"
                      >
                        + הוסף
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="p-1.5 text-[11px] rounded-lg border border-slate-300 bg-white font-bold"
                        title="תאריך יעד למשימה"
                      />
                      <select
                        value={newMilestoneUrgency}
                        onChange={(e) =>
                          setNewMilestoneUrgency(e.target.value as TaskUrgency)
                        }
                        className="p-1.5 text-[11px] rounded-lg border border-slate-300 bg-white font-bold"
                      >
                        {TASK_URGENCIES.map((u) => (
                          <option key={u} value={u}>
                            דחיפות: {u}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* רשימה עליונה: משימות פתוחות לביצוע (עם כפתור ✓ ואייקון עיפרון ✏️ לעריכה) */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                    <div className="text-xs font-extrabold text-slate-700 flex items-center justify-between">
                      <span>משימות פתוחות לביצוע ({openMilestones.length})</span>
                    </div>

                    {openMilestones.length === 0 ? (
                      <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 text-center text-xs font-bold text-emerald-800">
                        כל המשימות בתיק הושלמו! ✓
                      </div>
                    ) : (
                      openMilestones.map((m) => {
                        const isEditing = editingTaskId === m.id;
                        return (
                          <div
                            key={m.id}
                            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition space-y-2 shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleMilestoneStatusChange(m.id, 'done')
                                }
                                title="סמן כבוצע בקליק אחד ✓"
                                className="w-5 h-5 mt-0.5 rounded-md border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center shrink-0 transition"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>

                              <div className="flex-1 min-w-0">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={m.title}
                                    onChange={(e) =>
                                      handleMilestoneTitleChange(
                                        m.id,
                                        e.target.value
                                      )
                                    }
                                    className="w-full p-1.5 text-xs rounded-lg border border-blue-500 bg-blue-50/20 font-extrabold text-slate-900 outline-none"
                                  />
                                ) : (
                                  <div className="text-xs font-extrabold text-slate-900 leading-snug">
                                    {m.title}
                                  </div>
                                )}

                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${getUrgencyBadge(
                                      m.urgency
                                    )}`}
                                  >
                                    {m.urgency || 'רגילה'}
                                  </span>
                                  {m.due_date && (
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                      יעד: {formatDateHe(m.due_date)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingTaskId(isEditing ? null : m.id)
                                  }
                                  title="ערוך משימה (שינוי טקסט, תאריך יעד או דחיפות)"
                                  className={`p-1.5 rounded-lg border text-xs transition ${
                                    isEditing
                                      ? 'bg-blue-600 text-white border-blue-700'
                                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMilestone(m.id)}
                                  title="מחק משימה"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {isEditing && (
                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 bg-slate-50 p-2 rounded-lg">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    תאריך יעד
                                  </label>
                                  <input
                                    type="date"
                                    value={m.due_date || ''}
                                    onChange={(e) =>
                                      handleMilestoneDueDateChange(
                                        m.id,
                                        e.target.value
                                      )
                                    }
                                    className="w-full p-1 text-xs rounded border border-slate-300 bg-white font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                    דחיפות
                                  </label>
                                  <select
                                    value={m.urgency || 'רגילה'}
                                    onChange={(e) =>
                                      handleMilestoneUrgencyChange(
                                        m.id,
                                        e.target.value as TaskUrgency
                                      )
                                    }
                                    className="w-full p-1 text-xs rounded border border-slate-300 bg-white font-bold"
                                  >
                                    {TASK_URGENCIES.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {/* רשימה תחתונה (מתקפלת/נקייה): משימות שבוצעו ✓ */}
                    <div className="pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() =>
                          setShowCompletedTasksExec((prev) => !prev)
                        }
                        className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 text-emerald-950 text-xs font-extrabold flex items-center justify-between transition"
                      >
                        <span>
                          משימות שבוצעו ✓ ({completedMilestones.length})
                        </span>
                        {showCompletedTasksExec ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {showCompletedTasksExec &&
                        completedMilestones.length > 0 && (
                          <div className="space-y-1.5 mt-2">
                            {completedMilestones.map((m) => (
                              <div
                                key={m.id}
                                className="p-2 rounded-lg bg-emerald-50/40 border border-emerald-200/80 flex items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMilestoneStatusChange(
                                        m.id,
                                        'in_progress'
                                      )
                                    }
                                    title="החזר למשימות פתוחות"
                                    className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center shrink-0"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-600 line-through truncate">
                                      {m.title}
                                    </div>
                                    <div className="text-[10px] text-emerald-800 font-bold">
                                      בוצע ב-{formatDateHe(m.completed_at)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* חלק 3 (שמאל): יומן הערות והתפתחויות כרונולוגי                 */}
              {/* ============================================================ */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3 flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 shrink-0">
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-amber-500" />
                      <span>3. יומן התפתחויות ({logs.length})</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setLogSortOrder((prev) =>
                          prev === 'desc' ? 'asc' : 'desc'
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-extrabold inline-flex items-center gap-1 transition"
                      title="הפוך סדר כרונולוגי בקליק"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        {logSortOrder === 'desc'
                          ? 'מהחדש לישן ⬇'
                          : 'מהישן לחדש ⬆'}
                      </span>
                    </button>
                  </div>

                  {/* הוספת הערה / עדכון מהיר ליומן הכרונולוגי */}
                  <form
                    onSubmit={handleQuickLogSubmit}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shrink-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <select
                        value={logType}
                        onChange={(e) => setLogType(e.target.value as LogType)}
                        className="p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                      >
                        {LOG_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={submittingLog || !logContent.trim()}
                        className="px-3 py-1.5 rounded-lg bg-[#0F172A] hover:bg-[#1E3A8A] disabled:opacity-50 text-white text-xs font-extrabold mr-auto transition"
                      >
                        + רשום ביומן
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={logContent}
                      onChange={(e) => setLogContent(e.target.value)}
                      placeholder="הקלד הערה, עדכון מייל/נט המשפט, דחיית דיון או החלטה..."
                      className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white outline-none focus:border-blue-600"
                    />
                  </form>

                  {/* ציר זמן כרונולוגי */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                    {loadingLogs ? (
                      <p className="text-xs text-slate-500 text-center py-4">
                        טוען יומן כרונולוגי...
                      </p>
                    ) : sortedLogs.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6">
                        טרם נרשמו הערות או התפתחויות בתיק.
                      </p>
                    ) : (
                      sortedLogs.map((l) => (
                        <div
                          key={l.id}
                          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                l.log_type === 'בקשת ארכה / דחיית דיון'
                                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                                  : l.log_type === 'החלטת ביהמ"ש'
                                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                                  : 'bg-blue-100 text-blue-900 border-blue-300'
                              }`}
                            >
                              {l.log_type}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {formatDateTimeHe(l.log_date)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
                            {l.content}
                          </p>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                            <span>נרשם ע&quot;י: {l.created_by || 'מערכת'}</span>
                            {l.due_date && (
                              <span className="font-extrabold text-indigo-700">
                                יעד: {formatDateHe(l.due_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* לשונית 1: מבט על, פס התקדמות ויזואלי והשדות הייעודיים של סוג התיק */}
          {/* ================================================================ */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* פס התקדמות ויזואלי: מה נעשה ✓ / בתהליך כעת ⏳ / יבוצע בהמשך ➔ */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-base font-extrabold text-slate-900">
                      פס התקדמות בתיק ({progressPercent}% הושלם):
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      מה נעשה ✓ ({doneCount})
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                      בתהליך כעת ⏳ ({inProgressCount})
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-300">
                      יבוצע בהמשך ➔ ({upcomingCount})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tasks')}
                    className="text-sm font-extrabold text-blue-600 hover:underline no-print"
                  >
                    לניהול המשימות ומדידת הזמנים ➔
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3 border border-slate-200">
                  <div
                    className="h-full bg-gradient-to-l from-emerald-500 to-blue-600 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* גלולות שלבי התיק למעבר מהיר */}
                <div className="flex flex-wrap gap-2">
                  {milestones.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        const nextOrder: Record<
                          MilestoneStatus,
                          MilestoneStatus
                        > = {
                          upcoming: 'in_progress',
                          in_progress: 'done',
                          done: 'upcoming',
                        };
                        handleMilestoneStatusChange(m.id, nextOrder[m.status]);
                      }}
                      title="לחץ לשינוי סטטוס השלב (נעשה ✓ / בתהליך ⏳ / יבוצע בהמשך ➔)"
                      className={`px-3 py-1.5 rounded-xl text-sm font-bold border flex items-center gap-1.5 transition ${
                        m.status === 'done'
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          : m.status === 'in_progress'
                          ? 'bg-amber-50 text-amber-950 border-amber-400 ring-2 ring-amber-100'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      <span>
                        {m.status === 'done'
                          ? '✓'
                          : m.status === 'in_progress'
                          ? '⏳'
                          : '➔'}
                      </span>
                      <span>{m.title}</span>
                      {m.urgency === 'דחוף מאוד' && m.status !== 'done' && (
                        <span className="px-1.5 py-0.5 text-[11px] rounded bg-red-600 text-white font-extrabold">
                          דחוף מאוד
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* פרטי זיהוי, סטטוס, מועד הבא ודחיות */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-extrabold text-slate-700 mb-1 flex items-center justify-between">
                      <span>שם חייב / חברה / פרויקט</span>
                      <CopyButton value={debtorName} />
                    </label>
                    <input
                      type="text"
                      value={debtorName}
                      onChange={(e) => setDebtorName(e.target.value)}
                      placeholder="הקלד שם חייב / חברה / פרויקט..."
                      className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-extrabold text-slate-700 mb-1 flex items-center justify-between">
                      <span>ת&quot;ז / ח&quot;פ</span>
                      <CopyButton value={idOrHp} />
                    </label>
                    <input
                      type="text"
                      value={idOrHp}
                      onChange={(e) => setIdOrHp(e.target.value)}
                      placeholder="הקלד ת״ז או ח״פ..."
                      className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-extrabold text-slate-700 mb-1 flex items-center justify-between">
                      <span>מספר תיק</span>
                      <CopyButton value={caseNumber} />
                    </label>
                    <input
                      type="text"
                      value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      placeholder="הקלד מספר תיק..."
                      className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-extrabold text-slate-700 mb-1 flex items-center justify-between">
                      <span>גוש / חלקה</span>
                      <CopyButton value={gushHelka} />
                    </label>
                    <input
                      type="text"
                      value={gushHelka}
                      onChange={(e) => setGushHelka(e.target.value)}
                      placeholder="גוש / חלקה..."
                      className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-extrabold text-slate-700 mb-1 flex items-center justify-between">
                      <span>מחוז (District)</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            window.confirm(
                              `להחיל את מחוז "${district}" באופן גורף על כל התיקים בקטגוריית "${category}"?`
                            )
                          ) {
                            const updatedList = await bulkApplyDistrictToCases({
                              district,
                              scope: 'category',
                              target_category: category,
                            });
                            if (onAllCasesUpdated) onAllCasesUpdated(updatedList);
                          }
                        }}
                        className="text-[11px] font-bold text-blue-700 hover:underline no-print"
                        title="החל מחוז זה באופן גורף על כל התיקים בקטגוריה זו"
                      >
                        החל על כל {category}
                      </button>
                    </label>
                    <select
                      value={district}
                      onChange={(e) =>
                        setDistrict(e.target.value as CaseDistrict)
                      }
                      className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 bg-white font-extrabold text-slate-900 outline-none focus:border-blue-600"
                    >
                      {CASE_DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          מחוז {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-sm font-extrabold text-slate-700 mb-1">
                      סטטוס תיק (טריגר חכם)
                    </label>
                    <select
                      value={status}
                      onChange={(e) =>
                        handleStatusChangeWithTriggers(
                          e.target.value as CaseStatus
                        )
                      }
                      className="w-full p-2.5 text-[15px] rounded-xl border border-blue-400 bg-blue-50/40 font-extrabold text-slate-900 outline-none"
                    >
                      {CASE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-extrabold text-slate-700 mb-1">
                      סוג הפעולה / המועד הקרוב
                    </label>
                    <select
                      value={nextActionType}
                      onChange={(e) =>
                        setNextActionType(e.target.value as NextActionType)
                      }
                      className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 bg-white font-bold outline-none"
                    >
                      {NEXT_ACTION_TYPES.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-sm font-extrabold text-slate-700 mb-1">
                      תיאור הפעולה הבאה / הדיון הקרוב
                    </label>
                    <input
                      type="text"
                      value={nextActionDescription}
                      onChange={(e) => setNextActionDescription(e.target.value)}
                      placeholder="הקלד תיאור לפעולה הבאה או לדיון הקרוב..."
                      className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-extrabold text-slate-700 mb-1">
                      תאריך יעד / מועד דיון
                    </label>
                    <input
                      type="date"
                      value={nextDueDate}
                      onChange={(e) => setNextDueDate(e.target.value)}
                      className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-bold"
                    />
                  </div>
                </div>

                {/* שורת מעקב דיונים שנדחו, מונה ארכות ודו"ח נאמן */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 bg-slate-50 p-3 rounded-xl">
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-extrabold text-rose-900">
                      <input
                        type="checkbox"
                        checked={isHearingPostponed}
                        onChange={(e) =>
                          setIsHearingPostponed(e.target.checked)
                        }
                        className="w-4 h-4 rounded text-rose-600"
                      />
                      <span>סמן דיון כ&quot;נדחה&quot;</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700">
                        מונה דחיות/ארכות:
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-900 font-extrabold text-sm border border-rose-300">
                        {extensionsCount}
                      </span>
                      <button
                        type="button"
                        onClick={handleIncrementExtensionOrPostpone}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold transition no-print"
                      >
                        + רשום ארכה / דחיית דיון
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm font-extrabold text-slate-700">
                      מועד עדכון דו&quot;ח נאמן:
                    </label>
                    <input
                      type="date"
                      value={trusteeReportDueDate}
                      onChange={(e) => setTrusteeReportDueDate(e.target.value)}
                      className="p-1.5 text-sm rounded-lg border border-slate-300 bg-white font-bold"
                    />
                    {trusteeReportDueDate && (
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 text-xs font-extrabold">
                        {trusteeReportCountdown.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* בלוק ייעודי 1: תיקי רשויות (גבייה והוצל"פ) — מוצג רק ב-'גבייה'! */}
              {/* ============================================================ */}
              {category === 'גבייה' && (
                <div className="bg-blue-50/50 border-2 border-blue-200 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 pb-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-6 h-6 text-blue-700" />
                      <div>
                        <h3 className="text-lg font-extrabold text-blue-950">
                          ניהול תיק רשות מקומית (לפני תביעה ➔ הוצל&quot;פ, הפחתות ומחיקת חובות)
                        </h3>
                        <p className="text-xs text-blue-800">
                          כללי שכ&quot;ט וריבית לפי רשות, גח&quot;לת, משכון, אישור מסירה + 30 ימים, ויומן הפחתות חודשי
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => setRshuSubTab('pre_suit')}
                        className={`px-3.5 py-2 rounded-xl text-sm font-extrabold transition ${
                          rshuSubTab === 'pre_suit'
                            ? 'bg-blue-700 text-white shadow-xs'
                            : 'bg-white text-blue-900 border border-blue-300'
                        }`}
                      >
                        א. שלב לפני תביעה (תדפיס חוב, גח&quot;לת, משכון, +30 יום)
                      </button>
                      <button
                        type="button"
                        onClick={() => setRshuSubTab('execution')}
                        className={`px-3.5 py-2 rounded-xl text-sm font-extrabold transition ${
                          rshuSubTab === 'execution'
                            ? 'bg-indigo-700 text-white shadow-xs'
                            : 'bg-white text-indigo-900 border border-indigo-300'
                        }`}
                      >
                        ב. שלב הוצל&quot;פ (יומן הפחתות חודשי, הסדר ומחיקת חוב ישן)
                      </button>
                    </div>
                  </div>

                  {/* בחירת רשות וטעינת תעריף שכ"ט וכללים אוטומטית ממסך המנהל */}
                  <div className="bg-white p-3.5 rounded-xl border border-blue-200 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="text-sm font-extrabold text-slate-800">
                          עירייה / רשות מקומית:
                        </label>
                        <input
                          type="text"
                          list="drawer-muni-list"
                          value={municipality}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMunicipality(val);
                            const matched = municipalitiesSettings.find(
                              (m) =>
                                m.municipality_name.toLowerCase() ===
                                val.trim().toLowerCase()
                            );
                            if (matched) {
                              if (
                                matched.fee_calculation_method === 'סכום קבוע'
                              ) {
                                setLegalFeeAmount(
                                  Number(matched.fee_rate_value) || 0
                                );
                              } else {
                                const base =
                                  (Number(principalAmount) || 0) +
                                  (Number(interestAmount) || 0);
                                if (base > 0) {
                                  setLegalFeeAmount(
                                    Math.round(
                                      base *
                                        ((Number(matched.fee_rate_value) ||
                                          15) /
                                          100)
                                    )
                                  );
                                }
                              }
                            }
                          }}
                          placeholder="בחר רשות (טוען כללי שכ״ט אוטומטית)..."
                          className="p-2 text-sm rounded-lg border border-slate-300 font-bold w-60"
                        />
                        <datalist id="drawer-muni-list">
                          {municipalitiesSettings.map((m) => (
                            <option key={m.id} value={m.municipality_name} />
                          ))}
                        </datalist>

                        {matchedMunicipalitySetting && (
                          <span className="text-xs px-3 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold">
                            תעריף: {matchedMunicipalitySetting.fee_calculation_method} (
                            {matchedMunicipalitySetting.fee_calculation_method ===
                            'סכום קבוע'
                              ? `₪${matchedMunicipalitySetting.fee_rate_value}`
                              : `${matchedMunicipalitySetting.fee_rate_value}%`}
                            ) • {matchedMunicipalitySetting.interest_and_expenses_rules}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 no-print">
                        <button
                          type="button"
                          onClick={handleCalculateLegalFeeByMuniRule}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold transition"
                        >
                          חשב שכ&quot;ט אוטומטית לפי הרשות
                        </button>
                        {onOpenMuniSettingsModal && (
                          <button
                            type="button"
                            onClick={onOpenMuniSettingsModal}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                          >
                            הגדרות רשות (מנהל)
                          </button>
                        )}
                      </div>
                    </div>

                    {matchedMunicipalitySetting?.standing_instructions && (
                      <div className="text-xs text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                        <strong className="text-blue-950">
                          הנחיות קבע של {matchedMunicipalitySetting.municipality_name}:
                        </strong>{' '}
                        {matchedMunicipalitySetting.standing_instructions}
                      </div>
                    )}
                  </div>

                  {rshuSubTab === 'pre_suit' ? (
                    <div className="space-y-4">
                      {/* פירוט תדפיס חוב */}
                      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-white p-4 rounded-xl border border-blue-200">
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-1">
                            שנות החוב
                          </label>
                          <input
                            type="text"
                            value={debtYears}
                            onChange={(e) => setDebtYears(e.target.value)}
                            placeholder="2020-2025"
                            className="w-full p-2 text-[15px] rounded-lg border border-slate-300 font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-1">
                            קרן חוב (₪)
                          </label>
                          <input
                            type="number"
                            value={principalAmount || ''}
                            onChange={(e) =>
                              setPrincipalAmount(Number(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="w-full p-2 text-[15px] rounded-lg border border-slate-300 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-1">
                            ריבית והצמדה (₪)
                          </label>
                          <input
                            type="number"
                            value={interestAmount || ''}
                            onChange={(e) =>
                              setInterestAmount(Number(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="w-full p-2 text-[15px] rounded-lg border border-slate-300 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-1">
                            הוצאות (₪)
                          </label>
                          <input
                            type="number"
                            value={expensesAmount || ''}
                            onChange={(e) =>
                              setExpensesAmount(Number(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="w-full p-2 text-[15px] rounded-lg border border-slate-300 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-extrabold text-blue-800 mb-1">
                            שכר טרחה (₪)
                          </label>
                          <input
                            type="number"
                            value={legalFeeAmount || ''}
                            onChange={(e) =>
                              setLegalFeeAmount(Number(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="w-full p-2 text-[15px] rounded-lg border border-blue-400 bg-blue-50/40 font-extrabold text-blue-900"
                          />
                        </div>
                        <div className="bg-blue-900 text-white rounded-xl p-2.5 flex flex-col justify-center">
                          <span className="text-xs text-blue-200">
                            סה&quot;כ חוב מחושב:
                          </span>
                          <span className="text-lg font-extrabold">
                            {formatCurrencyILS(totalCalculatedDebt)}
                          </span>
                        </div>
                      </div>

                      {/* גח"לת, נכס ומשכון, התראה ואישור מסירה + 30 ימים */}
                      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 bg-white p-4 rounded-xl border border-blue-200">
                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-1">
                            סטטוס גח&quot;לת (משרד האוכלוסין)
                          </label>
                          <select
                            value={gachlatStatus}
                            onChange={(e) =>
                              setGachlatStatus(e.target.value as GachlatStatus)
                            }
                            className="w-full p-2 text-sm rounded-lg border border-slate-300 bg-white font-extrabold"
                          >
                            {GACHLAT_STATUSES.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-1">
                            מתג קיים נכס? (רישום משכון)
                          </label>
                          <select
                            value={hasProperty ? 'yes' : 'no'}
                            onChange={(e) =>
                              handleToggleHasProperty(e.target.value === 'yes')
                            }
                            className={`w-full p-2 text-sm rounded-lg border font-extrabold ${
                              hasProperty
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                                : 'bg-white border-slate-300 text-slate-700'
                            }`}
                          >
                            <option value="no">לא קיים נכס</option>
                            <option value="yes">כן — קיים נכס (משכון!)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-1">
                            פרטי נכס / רישום משכון
                          </label>
                          <input
                            type="text"
                            value={propertyDetails}
                            onChange={(e) => setPropertyDetails(e.target.value)}
                            placeholder="גוש/חלקה/כתובת הנכס למשכון..."
                            className="w-full p-2 text-sm rounded-lg border border-slate-300 font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold text-slate-700 mb-1">
                            תאריך מכתב התראה
                          </label>
                          <input
                            type="date"
                            value={warningLetterSentDate}
                            onChange={(e) =>
                              setWarningLetterSentDate(e.target.value)
                            }
                            className="w-full p-2 text-sm rounded-lg border border-slate-300 font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold text-blue-900 mb-1">
                            תאריך אישור מסירה
                          </label>
                          <input
                            type="date"
                            value={deliveryConfirmationDate}
                            onChange={(e) =>
                              handleDeliveryConfirmationDateChange(
                                e.target.value
                              )
                            }
                            className="w-full p-2 text-sm rounded-lg border border-blue-500 bg-blue-50/40 font-extrabold"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-extrabold text-indigo-900 mb-1">
                            אישור מסירה + 30 ימים (להוצל&quot;פ)
                          </label>
                          <input
                            type="date"
                            value={executionTargetDate}
                            onChange={(e) =>
                              setExecutionTargetDate(e.target.value)
                            }
                            className={`w-full p-2 text-sm rounded-lg border font-extrabold ${
                              deliveryAlertInfo.isAlert
                                ? 'bg-red-100 border-red-500 text-red-900'
                                : 'bg-indigo-50 border-indigo-300 text-indigo-950'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* ניהול הסדר תשלומים (טריגר אוטומטי מובנה: עדכון בהוצל"פ ➔ עיכוב הליכים + השארת עיקולים ➔ שחרור עיקולים וסגירה בתום ההסדר) */}
                      <div className="bg-white p-3.5 rounded-xl border-2 border-indigo-300 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-extrabold text-indigo-950">
                          ניהול הסדר תשלומים בהוצל&quot;פ (טריגר אוטומטי):
                        </div>
                        <div className="flex flex-wrap items-center gap-2 no-print">
                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChangeWithTriggers('בהסדר תשלומים')
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition ${
                              status === 'בהסדר תשלומים' || status === 'בהסדר'
                                ? 'bg-indigo-700 text-white border-indigo-800 shadow-xs'
                                : 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                            }`}
                          >
                            1. עדכון ההסדר בהוצל&quot;פ ➔ 2. עיכוב הליכים + השארת עיקולים
                          </button>
                          <span className="text-slate-400 font-bold">➔</span>
                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChangeWithTriggers(
                                'סיום הסדר / סילוק חוב'
                              )
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition ${
                              status === 'סיום הסדר / סילוק חוב'
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                            }`}
                          >
                            3. שחרור עיקולים וסגירת תיק בתום ההסדר ✓
                          </button>
                        </div>
                      </div>

                      {/* שלב הוצל"פ: יומן הפחתות חודשי + מעקב בקשות + מחיקת חובות ישנים */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-indigo-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-extrabold text-indigo-950 flex items-center gap-1.5">
                              <TrendingDown className="w-4 h-4 text-indigo-600" />
                              יומן הפחתות חודשי (דיווחי תשלומים מהרשות — סה&quot;כ:{' '}
                              {formatCurrencyILS(totalReductionsReported)})
                            </h4>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 no-print">
                            <input
                              type="text"
                              value={newRedMonth}
                              onChange={(e) => setNewRedMonth(e.target.value)}
                              placeholder="חודש (11/2026)"
                              className="p-2 text-xs rounded-lg border border-slate-300 w-24 font-mono font-bold"
                            />
                            <input
                              type="number"
                              value={newRedAmount || ''}
                              onChange={(e) =>
                                setNewRedAmount(Number(e.target.value) || 0)
                              }
                              placeholder="סכום בש״ח"
                              className="p-2 text-xs rounded-lg border border-slate-300 w-28 font-bold"
                            />
                            <input
                              type="text"
                              value={newRedNotes}
                              onChange={(e) => setNewRedNotes(e.target.value)}
                              placeholder="הערה לדיווח..."
                              className="p-2 text-xs rounded-lg border border-slate-300 flex-1"
                            />
                            <button
                              type="button"
                              onClick={handleAddMonthlyReduction}
                              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold transition"
                            >
                              + הוסף דיווח
                            </button>
                          </div>

                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {monthlyReductions.length === 0 ? (
                              <p className="text-xs text-slate-400 py-2">
                                טרם הוזנו דיווחי הפחתות חודשיים בתיק זה.
                              </p>
                            ) : (
                              monthlyReductions.map((r) => (
                                <div
                                  key={r.id}
                                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div>
                                    <span className="font-extrabold text-slate-900">
                                      {r.month_year}:{' '}
                                      {formatCurrencyILS(r.reported_amount)}
                                    </span>{' '}
                                    <span className="text-slate-600">
                                      ({r.notes})
                                    </span>
                                    {r.performed_by && (
                                      <div className="text-[11px] text-emerald-700 font-bold">
                                        הופחת ע&quot;י {r.performed_by} ב-
                                        {formatDateHe(r.reduction_date)}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleReductionExecuted(r.id)
                                    }
                                    className={`px-2.5 py-1 rounded-md font-extrabold transition ${
                                      r.reduced_in_execution
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                                    }`}
                                  >
                                    {r.reduced_in_execution
                                      ? 'הופחת בהוצל"פ ✓'
                                      : 'סמן כבוצע בהוצל"פ'}
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* מעקב הוצל"פ + מחיקת חובות ישנים */}
                        <div className="bg-white p-4 rounded-xl border border-indigo-200 space-y-3">
                          <div>
                            <label className="block text-xs font-extrabold text-slate-700 mb-1">
                              מעקב בקשות, תגובות, עיקולים והחלטות בהוצל&quot;פ
                            </label>
                            <textarea
                              rows={2}
                              value={executionProceedingsNotes}
                              onChange={(e) =>
                                setExecutionProceedingsNotes(e.target.value)
                              }
                              placeholder="הקלד מעקב בקשות, עיקולים, תגובות והחלטות רשם ההוצל״פ..."
                              className="w-full p-2 text-sm rounded-lg border border-slate-300"
                            />
                          </div>

                          <div className="pt-2 border-t border-slate-100 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-extrabold text-rose-900">
                                <input
                                  type="checkbox"
                                  checked={isOldDebtWriteoff}
                                  onChange={(e) =>
                                    setIsOldDebtWriteoff(e.target.checked)
                                  }
                                  className="w-4 h-4 rounded text-rose-600"
                                />
                                <span>מחיקת חובות ישנים (סיווג + חוות דעת משפטית)</span>
                              </label>
                              {isOldDebtWriteoff && (
                                <select
                                  value={writeoffClassification || ''}
                                  onChange={(e) =>
                                    setWriteoffClassification(
                                      (e.target
                                        .value as WriteoffClassification) ||
                                        null
                                    )
                                  }
                                  className="p-1.5 text-xs rounded-lg border border-rose-300 bg-rose-50 font-bold text-rose-900"
                                >
                                  <option value="">בחר סיווג מחיקה...</option>
                                  {WRITEOFF_CLASSIFICATIONS.map((w) => (
                                    <option key={w} value={w}>
                                      {w}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                            {isOldDebtWriteoff && (
                              <textarea
                                rows={2}
                                value={legalOpinionSummary}
                                onChange={(e) =>
                                  setLegalOpinionSummary(e.target.value)
                                }
                                placeholder="סיכום חוות דעת משפטית מנומקת לוועדת מחיקת חובות ברשות..."
                                className="w-full p-2 text-sm rounded-lg border border-rose-300 bg-rose-50/30"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================ */}
              {/* בלוק ייעודי 2: תיקי חדל"פ (ייצוג נושה / פירוק) — מוצג רק ב-'חדל"פ'! */}
              {/* ============================================================ */}
              {category === 'חדל"פ' && (
                <div className="bg-purple-50/50 border-2 border-purple-200 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Gavel className="w-6 h-6 text-purple-700" />
                      <div>
                        <h3 className="text-lg font-extrabold text-purple-950">
                          ניהול תיק חדל&quot;פ (ייצוג נושה / פירוק)
                        </h3>
                        <p className="text-xs text-purple-800">
                          מתג נושה מהותי, חייב יחיד מול חברה בפירוק, הגשת תביעת חוב, תגובות נושה ומעקב חובות חדשים
                        </p>
                      </div>
                    </div>

                    {/* מתג בולט: נושה מהותי בתיק (כן/לא) */}
                    <button
                      type="button"
                      onClick={() => setIsMaterialCreditor(!isMaterialCreditor)}
                      className={`px-4 py-2 rounded-xl text-sm font-extrabold border-2 transition flex items-center gap-2 ${
                        isMaterialCreditor
                          ? 'bg-purple-700 text-white border-purple-900 shadow-md ring-4 ring-purple-200'
                          : 'bg-white text-purple-900 border-purple-300 hover:bg-purple-100'
                      }`}
                    >
                      <Flame className="w-4 h-4" />
                      נושה מהותי בתיק: {isMaterialCreditor ? 'כן! (פעיל)' : 'לא'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 bg-white p-4 rounded-xl border border-purple-200">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        סיווג חייב יחיד / חברה בפירוק
                      </label>
                      <select
                        value={insolvencyDebtorType}
                        onChange={(e) =>
                          setInsolvencyDebtorType(
                            e.target.value as InsolvencyDebtorType
                          )
                        }
                        className="w-full p-2.5 text-sm rounded-lg border border-slate-300 bg-white font-extrabold"
                      >
                        {INSOLVENCY_DEBTOR_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        פרטי נאמן / מפרק ממונה
                      </label>
                      <input
                        type="text"
                        value={trusteeNameAndContact}
                        onChange={(e) =>
                          setTrusteeNameAndContact(e.target.value)
                        }
                        placeholder="שם הנאמן/המפרק, טלפון ודוא״ל..."
                        className="w-full p-2.5 text-sm rounded-lg border border-slate-300 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-purple-900 mb-1">
                        מועד אחרון לתביעת חוב ({claimCountdown.label})
                      </label>
                      <input
                        type="date"
                        value={debtClaimDeadline}
                        onChange={(e) => setDebtClaimDeadline(e.target.value)}
                        className="w-full p-2.5 text-sm rounded-lg border border-purple-400 bg-purple-50/40 font-extrabold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        תביעת חוב (₪) + סטטוס הגשה
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={debtClaimAmount || ''}
                          onChange={(e) =>
                            setDebtClaimAmount(Number(e.target.value) || 0)
                          }
                          placeholder="סכום בש״ח"
                          className="w-full p-2 text-sm rounded-lg border border-slate-300 font-bold"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDebtClaimSubmitted(!debtClaimSubmitted)
                          }
                          className={`px-2.5 py-2 rounded-lg text-xs font-extrabold shrink-0 ${
                            debtClaimSubmitted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {debtClaimSubmitted ? 'הוגשה ✓' : 'טרם'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div
                      className={`p-4 rounded-xl border ${
                        isMaterialCreditor
                          ? 'bg-purple-100/70 border-2 border-purple-500 shadow-xs'
                          : 'bg-white border-purple-200'
                      }`}
                    >
                      <label className="block text-sm font-extrabold text-purple-950 mb-1">
                        {isMaterialCreditor
                          ? '★ תגובות נושה מהותי בתיק (מודגש בתיק מהותי!)'
                          : 'מעקב תגובות נושה בתיק'}
                      </label>
                      <textarea
                        rows={2}
                        value={creditorResponsesNotes}
                        onChange={(e) =>
                          setCreditorResponsesNotes(e.target.value)
                        }
                        placeholder="עמדת הנושה לבקשות הנאמן, תוכנית שיקום כלכלי, מימוש נכסים..."
                        className="w-full p-2.5 text-sm rounded-lg border border-purple-300 bg-white font-semibold"
                      />
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-purple-200">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-extrabold text-rose-900">
                          מעקב חובות חדשים (בדיקה מול נאמן / בקשה לביטול הליכים)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const today = new Date()
                              .toISOString()
                              .split('T')[0];
                            setMilestones((prev) => [
                              ...prev,
                              {
                                id: generateId(),
                                title:
                                  'הגשת בקשה לביטול הליכי חדל"פ עקב צבירת חובות חדשים',
                                status: 'in_progress',
                                urgency: 'דחוף מאוד',
                                planned_days: 5,
                                started_at: today,
                                completed_at: null,
                                days_spent: 0,
                                updated_by: currentUser.displayName,
                              },
                            ]);
                            setNextActionType('הגשה לביהמ"ש');
                            setNextActionDescription(
                              'הגשת בקשה לביטול הליכים בגין יצירת חובות חדשים'
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold no-print"
                        >
                          + משימת בקשה לביטול הליכים
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={newDebtsTracking}
                        onChange={(e) => setNewDebtsTracking(e.target.value)}
                        placeholder="פירוט חובות שוטפים שנוצרו לאחר צו פתיחת ההליכים ופנייה לנאמן..."
                        className="w-full p-2.5 text-sm rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* בלוק ייעודי 3: תיקי חברות (נאמן / מפרק) — מוצג רק ב-'חברות'! */}
              {/* ============================================================ */}
              {category === 'חברות' && (
                <div className="bg-emerald-50/50 border-2 border-emerald-200 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Briefcase className="w-6 h-6 text-emerald-700" />
                      <div>
                        <h3 className="text-lg font-extrabold text-emerald-950">
                          ניהול תיק חברה בתפקיד נאמן / מפרק
                        </h3>
                        <p className="text-xs text-emerald-800">
                          התחייבות עצמית (100,000 ₪), מכתבי איתור, תיאום חקירה + סט מסמכים, צו הבאה/השלמות, דו&quot;ח נאמן והכרעה: שיקום או פירוק
                        </p>
                      </div>
                    </div>

                    {/* מעקב הפקדת התחייבות עצמית (100,000 ₪) */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !selfUndertakingDeposited;
                          setSelfUndertakingDeposited(nextVal);
                          if (nextVal && !selfUndertakingDate) {
                            setSelfUndertakingDate(
                              new Date().toISOString().split('T')[0]
                            );
                          }
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-extrabold border-2 transition ${
                          selfUndertakingDeposited
                            ? 'bg-emerald-700 text-white border-emerald-900 shadow-sm'
                            : 'bg-red-600 text-white border-red-800 animate-pulse'
                        }`}
                      >
                        התחייבות עצמית (100,000 ₪):{' '}
                        {selfUndertakingDeposited
                          ? 'הופקדה ✓'
                          : 'טרם הופקדה!'}
                      </button>

                      {/* הכרעה: שיקום או פירוק */}
                      <select
                        value={companyResolutionDecision}
                        onChange={(e) =>
                          setCompanyResolutionDecision(
                            e.target.value as CompanyResolutionDecision
                          )
                        }
                        className="p-2 text-sm rounded-xl border-2 border-emerald-600 bg-white font-extrabold text-emerald-950"
                      >
                        {COMPANY_RESOLUTION_DECISIONS.map((d) => (
                          <option key={d} value={d}>
                            הכרעה: {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-white p-4 rounded-xl border border-emerald-200">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        פנייה למייצג החברה (רו&quot;ח / עו&quot;ד)
                      </label>
                      <input
                        type="text"
                        value={representativeContactDetails}
                        onChange={(e) =>
                          setRepresentativeContactDetails(e.target.value)
                        }
                        placeholder="פרטי מייצג וטלפון..."
                        className="w-full p-2.5 text-sm rounded-lg border border-slate-300 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        שם הנאמן החוקר + מועד פנוי לחקירה
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={investigatingTrusteeName}
                          onChange={(e) =>
                            setInvestigatingTrusteeName(e.target.value)
                          }
                          placeholder="שם החוקר..."
                          className="w-full p-2 text-sm rounded-lg border border-slate-300 font-bold"
                        />
                        <input
                          type="date"
                          value={investigationScheduledDate}
                          onChange={(e) =>
                            setInvestigationScheduledDate(e.target.value)
                          }
                          className="p-2 text-xs rounded-lg border border-slate-300 font-bold"
                        />
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block text-xs font-extrabold text-emerald-950 mb-1">
                        תוצאות חקירה (טריגר אוטומטי: לא התייצב ➔ בקשת צו הבאה | חסרים מסמכים ➔ השלמות)
                      </label>
                      <select
                        value={investigationOutcome}
                        onChange={(e) =>
                          handleInvestigationOutcomeChange(
                            e.target.value as InvestigationOutcome
                          )
                        }
                        className={`w-full p-2.5 text-sm rounded-lg border-2 font-extrabold ${
                          investigationOutcome === 'לא התייצב לחקירה'
                            ? 'bg-red-50 border-red-500 text-red-900'
                            : investigationOutcome === 'חסרים מסמכים'
                            ? 'bg-amber-50 border-amber-500 text-amber-950'
                            : 'bg-white border-emerald-400 text-emerald-950'
                        }`}
                      >
                        {INVESTIGATION_OUTCOMES.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <div className="bg-white p-3.5 rounded-xl border border-emerald-200">
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        מכתבים לחברות ביטוח ואיתור נכסים
                      </label>
                      <textarea
                        rows={2}
                        value={insuranceAndAssetsLettersStatus}
                        onChange={(e) =>
                          setInsuranceAndAssetsLettersStatus(e.target.value)
                        }
                        placeholder="פירוט פניות לחברות ביטוח, בנקים ותשובות שהתקבלו..."
                        className="w-full p-2 text-sm rounded-lg border border-slate-300"
                      />
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-emerald-200">
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        סט מסמכים נדרש לחקירה (דרישה למייצג)
                      </label>
                      <textarea
                        rows={2}
                        value={requiredDocumentsChecklist}
                        onChange={(e) =>
                          setRequiredDocumentsChecklist(e.target.value)
                        }
                        placeholder="מאזנים, כרטסות הנה״ח, דפי בנק, דוחות מע״מ..."
                        className="w-full p-2 text-sm rounded-lg border border-slate-300"
                      />
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-emerald-200">
                      <label className="block text-xs font-extrabold text-amber-900 mb-1">
                        מעקב השלמות מסמכים חסרים / בקשת צו הבאה
                      </label>
                      <textarea
                        rows={2}
                        value={missingDocumentsDetails}
                        onChange={(e) =>
                          setMissingDocumentsDetails(e.target.value)
                        }
                        placeholder="פירוט מסמכים שטרם הומצאו לאחר החקירה..."
                        className="w-full p-2 text-sm rounded-lg border border-amber-300 bg-amber-50/20"
                      />
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-emerald-200">
                      <label className="block text-xs font-extrabold text-emerald-950 mb-1">
                        דו&quot;ח נאמן ועדכון ממצאים לביהמ&quot;ש
                      </label>
                      <textarea
                        rows={2}
                        value={trusteeFindingsSummary}
                        onChange={(e) =>
                          setTrusteeFindingsSummary(e.target.value)
                        }
                        placeholder="תקציר ממצאי החקירה והמלצת הנאמן לשיקום או פירוק..."
                        className="w-full p-2 text-sm rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* בלוק ייעודי 4: חברה משכנת (רישום וזכויות) — מוצג רק ב-'חברה משכנת'! */}
              {/* ============================================================ */}
              {category === 'חברה משכנת' && (
                <div className="bg-amber-50/50 border-2 border-amber-200 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <Home className="w-6 h-6 text-amber-700" />
                      <div>
                        <h3 className="text-lg font-extrabold text-amber-950">
                          פרויקט &quot;חברה משכנת בלבד&quot; — רישום, תצ&quot;רים, חשבוניות והעברת זכויות
                        </h3>
                        <p className="text-xs text-amber-900">
                          אישור מפרקים, תיקים פיזיים, מעקב מודד ותצ&quot;ר חניות, התאמה לבית משותף, בקרת חשבוניות והעברת זכויות לקונה חדש
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          setLiquidatorsSaleApproval(!liquidatorsSaleApproval)
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                          liquidatorsSaleApproval
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        אישור מפרקים למכירת זכויות:{' '}
                        {liquidatorsSaleApproval ? 'אושר ✓' : 'טרם'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setRightsCertificateIssued(!rightsCertificateIssued)
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                          rightsCertificateIssued
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        הנפקת אישור זכויות:{' '}
                        {rightsCertificateIssued ? 'הונפק ✓' : 'טרם'}
                      </button>
                    </div>
                  </div>

                  {/* שורה 1: פרויקט, תיקים פיזיים, מודד, תצ"ר חניות והתאמה לבית משותף */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-white p-4 rounded-xl border border-amber-200">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        שם הפרויקט / מתחם
                      </label>
                      <input
                        type="text"
                        value={housingProjectName}
                        onChange={(e) => setHousingProjectName(e.target.value)}
                        placeholder="הקלד שם פרויקט / מתחם..."
                        className="w-full p-2 text-sm rounded-lg border border-slate-300 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        ניהול תיקים פיזיים (מיקום בארכיב / קלסר)
                      </label>
                      <input
                        type="text"
                        value={physicalFilesLocation}
                        onChange={(e) =>
                          setPhysicalFilesLocation(e.target.value)
                        }
                        placeholder="ארון / מדף / קלסר פיזי..."
                        className="w-full p-2 text-sm rounded-lg border border-slate-300 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 mb-1">
                        שם המודד המטפל בתצ&quot;רים
                      </label>
                      <input
                        type="text"
                        value={surveyorName}
                        onChange={(e) => setSurveyorName(e.target.value)}
                        placeholder="הקלד שם ופרטי מודד..."
                        className="w-full p-2 text-sm rounded-lg border border-slate-300 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-amber-950 mb-1">
                        התאמת התצ&quot;ר לרישום בית משותף
                      </label>
                      <select
                        value={condominiumRegistrationFit}
                        onChange={(e) =>
                          setCondominiumRegistrationFit(
                            e.target.value as CondominiumFitStatus
                          )
                        }
                        className={`w-full p-2 text-sm rounded-lg border-2 font-extrabold ${
                          condominiumRegistrationFit === 'תקין ומתאים לרישום'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                            : condominiumRegistrationFit === 'דורש תיקון מודד'
                            ? 'bg-red-50 border-red-400 text-red-900'
                            : 'bg-amber-50 border-amber-400 text-amber-950'
                        }`}
                      >
                        {CONDOMINIUM_FIT_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* שורה 2: מעקב תצ"רים ותצ"ר חניות + בקרת חשבוניות מול אישור ביהמ"ש */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                    <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-2">
                      <label className="block text-xs font-extrabold text-slate-800">
                        מעקב מול מודד על תצ&quot;רים (ראשי ופרצלציה)
                      </label>
                      <textarea
                        rows={2}
                        value={tazarStatus}
                        onChange={(e) => setTazarStatus(e.target.value)}
                        placeholder="סטטוס תצ״ר ראשי מול המודד..."
                        className="w-full p-2 text-sm rounded-lg border border-slate-300"
                      />
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-extrabold text-amber-950">
                          סימון וטיפול בתצ&quot;ר חניות
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={parkingTazarHandled}
                            onChange={(e) =>
                              setParkingTazarHandled(e.target.checked)
                            }
                            className="w-4 h-4 rounded text-amber-600"
                          />
                          <span>תצ&quot;ר חניות טופל ✓</span>
                        </label>
                      </div>
                      <textarea
                        rows={2}
                        value={parkingTazarNotes}
                        onChange={(e) => setParkingTazarNotes(e.target.value)}
                        placeholder="פירוט סימון חניות, הצמדות ותיקונים בתצ״ר החניות..."
                        className="w-full p-2 text-sm rounded-lg border border-amber-300 bg-amber-50/20"
                      />
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-2">
                      <label className="block text-xs font-extrabold text-slate-800">
                        בקרת חשבוניות מול אישור ביהמ&quot;ש, ההסכם, צורת התשלום והמועדים
                      </label>
                      <textarea
                        rows={2}
                        value={invoicesCourtControl}
                        onChange={(e) =>
                          setInvoicesCourtControl(e.target.value)
                        }
                        placeholder="פירוט מס׳ חשבונית, התאמה להחלטת ביהמ״ש, אופן התשלום ומועדי הפירעון..."
                        className="w-full p-2 text-sm rounded-lg border border-slate-300"
                      />
                    </div>
                  </div>

                  {/* שורה 3: תהליך העברת זכויות מרוכש לקונה */}
                  <div className="bg-white p-4 rounded-xl border-2 border-amber-400 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-extrabold text-amber-950">
                        תהליך העברת זכויות מרוכש לקונה: בדיקת סט מסמכי חתימה מלא + אישור המפרק ➔ בחינה וביצוע ➔ הפקת אישור זכויות לקונה החדש
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-extrabold text-slate-700 mb-1">
                          שם מוכר ➔ שם הקונה החדש
                        </label>
                        <input
                          type="text"
                          value={sellerBuyerNames}
                          onChange={(e) => setSellerBuyerNames(e.target.value)}
                          placeholder="מוכר: ... ➔ קונה חדש: ..."
                          className="w-full p-2 text-sm rounded-lg border border-slate-300 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-extrabold text-slate-700 mb-1">
                          שלב בחינה וביצוע ההעברה
                        </label>
                        <input
                          type="text"
                          value={transferProcessStage}
                          onChange={(e) =>
                            setTransferProcessStage(e.target.value)
                          }
                          placeholder="בבדיקה / הועבר לחתימה / בוצע..."
                          className="w-full p-2 text-sm rounded-lg border border-slate-300 font-bold"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setTransferSigningDocsComplete(
                            !transferSigningDocsComplete
                          )
                        }
                        className={`p-2.5 rounded-xl text-xs font-extrabold border text-center transition ${
                          transferSigningDocsComplete
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        1. סט מסמכי חתימה מלא:{' '}
                        {transferSigningDocsComplete ? 'תקין ✓' : 'חסר'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setTransferLiquidatorApproved(
                            !transferLiquidatorApproved
                          )
                        }
                        className={`p-2.5 rounded-xl text-xs font-extrabold border text-center transition ${
                          transferLiquidatorApproved
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        2. אישור המפרק:{' '}
                        {transferLiquidatorApproved ? 'אושר ✓' : 'טרם'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setNewBuyerCertificateIssued(
                            !newBuyerCertificateIssued
                          )
                        }
                        className={`p-2.5 rounded-xl text-xs font-extrabold border text-center transition ${
                          newBuyerCertificateIssued
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-amber-100 text-amber-950 border-amber-400'
                        }`}
                      >
                        3. אישור זכויות לקונה החדש:{' '}
                        {newBuyerCertificateIssued ? 'הופק ✓' : 'טרם הופק'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* שדות מעקב ותזכורות מותאמים אישית (Inline Quick-Edit + החלה גורפת) */}
              <div className="bg-indigo-50/50 p-4 rounded-2xl border-2 border-indigo-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-700" />
                    <div>
                      <h4 className="text-sm sm:text-base font-extrabold text-indigo-950">
                        שדות מעקב ותזכורות מותאמים אישית (Inline Quick-Edit)
                      </h4>
                      <p className="text-xs text-indigo-800">
                        ערוך בלחיצה ישירות מכאן או מהטבלה • ניתן להחיל שדה חדש על תיק זה, על כל תיקי {category} או על כלל התיקים במערכת
                      </p>
                    </div>
                  </div>
                  {onOpenAddCustomField && (
                    <button
                      type="button"
                      onClick={() => onOpenAddCustomField(caseItem)}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xs transition no-print"
                    >
                      <Plus className="w-4 h-4" />
                      + הוסף שדה מעקב / תזכורת
                    </button>
                  )}
                </div>

                <InlineCustomFieldsList
                  caseItem={caseItem}
                  onCasesUpdated={(updatedList) => {
                    if (onAllCasesUpdated) {
                      onAllCasesUpdated(updatedList);
                    }
                    const found = updatedList.find((c) => c.id === caseItem.id);
                    if (found) onCaseUpdated(found);
                  }}
                  onOpenAddModal={(target) => {
                    if (onOpenAddCustomField) onOpenAddCustomField(target);
                  }}
                />
              </div>

              {/* הערות ליבה ותגיות */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-extrabold text-slate-800 mb-1">
                    הערות ליבה ותקציר התיק
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="הקלד הערות ליבה ותקציר התיק..."
                    className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 focus:border-blue-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-extrabold text-slate-800 mb-1.5">
                    תגיות מאפיינים (לסינון מהיר)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CASE_TAGS.map((tag) => {
                      const active = tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`px-3 py-1 rounded-full text-xs font-extrabold border transition ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {active ? `✓ ${tag}` : tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* לשונית 2: משימות וצ'ק-ליסט + דחיפות ומדידת זמנים                */}
          {/* ================================================================ */}
          {activeTab === 'tasks' && (
            <div className="space-y-5">
              {/* הוספת משימה חדשה עם דחיפות ומשך ביצוע מתוכנן בימים */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 no-print">
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-blue-600" />
                  הוספת משימה חדשה לצ&apos;ק-ליסט התיק (עם הגדרת דחיפות ומשך מתוכנן בימים)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-6">
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      תיאור המשימה / השלב בצ&apos;ק-ליסט
                    </label>
                    <input
                      type="text"
                      value={newMilestoneTitle}
                      onChange={(e) => setNewMilestoneTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddMilestone();
                        }
                      }}
                      placeholder="הקלד משימה חדשה (למשל: הגשת בקשה לצו הבאה / בדיקת תצ״ר חניות)..."
                      className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      מידת דחיפות
                    </label>
                    <select
                      value={newMilestoneUrgency}
                      onChange={(e) =>
                        setNewMilestoneUrgency(e.target.value as TaskUrgency)
                      }
                      className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 bg-white font-extrabold"
                    >
                      {TASK_URGENCIES.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">
                      משך מתוכנן (בימים)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newMilestonePlannedDays}
                      onChange={(e) =>
                        setNewMilestonePlannedDays(
                          e.target.value ? Number(e.target.value) : ''
                        )
                      }
                      placeholder="למשל: 7"
                      className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddMilestone}
                      className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[15px] font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition"
                    >
                      <Plus className="w-4 h-4" />
                      הוסף משימה
                    </button>
                  </div>
                </div>
              </div>

              {/* רשימת המשימות ומדידת הזמנים */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                  <span className="text-base font-extrabold">
                    צ&apos;ק-ליסט משימות ומדידה אוטומטית של ימי ביצוע עד סגירה ({milestones.length} משימות)
                  </span>
                  <span className="text-xs text-slate-300">
                    עריכה חיה של שם המשימה, דחיפות ומשך מתוכנן • סגירת משימה (&quot;מה נעשה ✓&quot;) מודדת אוטומטית כמה ימים לקח עד לסגירתה
                  </span>
                </div>

                <div className="divide-y divide-slate-200">
                  {milestones.map((m, idx) => {
                    const liveDays = calculateMilestoneDays(
                      m.started_at,
                      m.completed_at
                    );
                    const planned = Number(m.planned_days) || 0;
                    const isOverPlanned = planned > 0 && liveDays > planned;

                    return (
                      <div
                        key={m.id}
                        className={`p-4 flex flex-wrap items-center justify-between gap-3 transition ${
                          m.status === 'done'
                            ? 'bg-emerald-50/40'
                            : m.status === 'in_progress'
                            ? 'bg-amber-50/30'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-800 font-extrabold text-sm flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="text"
                                value={m.title}
                                onChange={(e) =>
                                  handleMilestoneTitleChange(
                                    m.id,
                                    e.target.value
                                  )
                                }
                                className={`flex-1 min-w-[240px] px-2.5 py-1 rounded-lg border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white bg-transparent text-base font-extrabold outline-none transition ${
                                  m.status === 'done'
                                    ? 'line-through text-slate-500'
                                    : 'text-slate-900'
                                }`}
                                title="לחץ לעריכת שם המשימה"
                              />
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${getUrgencyBadge(
                                  m.urgency
                                )}`}
                              >
                                דחיפות: {m.urgency || 'רגילה'}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-slate-600 mt-1 flex-wrap font-semibold">
                              <span>
                                התחלה: <strong>{formatDateHe(m.started_at)}</strong>
                              </span>
                              {m.completed_at && (
                                <span className="text-emerald-800">
                                  נסגר ב: <strong>{formatDateHe(m.completed_at)}</strong>
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded font-extrabold ${
                                  isOverPlanned
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                זמן בפועל: {liveDays} ימים{' '}
                                {planned > 0 ? `(מתוכנן: ${planned} ימים)` : ''}
                              </span>
                              {m.updated_by && (
                                <span className="text-slate-400">
                                  עודכן ע&quot;י: {m.updated_by}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap no-print">
                          {/* שינוי דחיפות */}
                          <select
                            value={m.urgency || 'רגילה'}
                            onChange={(e) =>
                              handleMilestoneUrgencyChange(
                                m.id,
                                e.target.value as TaskUrgency
                              )
                            }
                            className="p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                          >
                            {TASK_URGENCIES.map((u) => (
                              <option key={u} value={u}>
                                דחיפות: {u}
                              </option>
                            ))}
                          </select>

                          {/* שינוי משך מתוכנן */}
                          <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                            <span className="text-xs font-bold text-slate-600">
                              תכנון (ימים):
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={m.planned_days || 7}
                              onChange={(e) =>
                                handleMilestonePlannedDaysChange(
                                  m.id,
                                  Number(e.target.value) || 1
                                )
                              }
                              className="w-12 p-1 text-xs rounded border border-slate-300 bg-white text-center font-bold"
                            />
                          </div>

                          {/* כפתורי סטטוס */}
                          <div className="inline-flex rounded-xl border border-slate-300 overflow-hidden">
                            <button
                              type="button"
                              onClick={() =>
                                handleMilestoneStatusChange(m.id, 'done')
                              }
                              className={`px-3 py-1.5 text-xs font-extrabold transition ${
                                m.status === 'done'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              מה נעשה ✓
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleMilestoneStatusChange(m.id, 'in_progress')
                              }
                              className={`px-3 py-1.5 text-xs font-extrabold border-x border-slate-300 transition ${
                                m.status === 'in_progress'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              בתהליך כעת ⏳
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleMilestoneStatusChange(m.id, 'upcoming')
                              }
                              className={`px-3 py-1.5 text-xs font-extrabold transition ${
                                m.status === 'upcoming'
                                  ? 'bg-slate-700 text-white'
                                  : 'bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              יבוצע בהמשך ➔
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteMilestone(m.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                            title="מחק משימה"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* לשונית 3: תרשומות שיחה, הערות, תזכורות, החלטות וארכות             */}
          {/* ================================================================ */}
          {activeTab === 'logs' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* טופס הזנה מהירה מימין */}
              <form
                onSubmit={handleQuickLogSubmit}
                className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 self-start no-print"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    הזנה מהירה ליומן התיק
                  </h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold">
                    נחתם ע&quot;י: {currentUser.displayName}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-extrabold text-slate-700 mb-1.5">
                    בחר סוג רישום:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {LOG_TYPES.map((t) => {
                      const active = logType === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setLogType(t)}
                          className={`p-2 rounded-xl text-xs font-extrabold border text-right transition ${
                            active
                              ? t === 'בקשת ארכה / דחיית דיון'
                                ? 'bg-rose-600 text-white border-rose-700'
                                : 'bg-blue-600 text-white border-blue-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-extrabold text-slate-700 mb-1">
                    תוכן התרשומת / ההערה / התזכורת / ההחלטה *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={logContent}
                    onChange={(e) => setLogContent(e.target.value)}
                    placeholder={
                      logType === 'בקשת ארכה / דחיית דיון'
                        ? 'פרט את סיבת הארכה / דחיית הדיון (יעלה אוטומטית את מונה הדחיות ויסמן "נדחה")...'
                        : 'הקלד תרשומת שיחה, הערה, תזכורת או החלטת ביהמ״ש...'
                    }
                    className="w-full p-3 text-[15px] rounded-xl border border-slate-300 focus:border-blue-600 outline-none"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-extrabold text-blue-950">
                    <input
                      type="checkbox"
                      checked={updateNextInOneClick}
                      onChange={(e) =>
                        setUpdateNextInOneClick(e.target.checked)
                      }
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>עדכן במקביל גם את המועד / הפעולה הבאה בתיק</span>
                  </label>

                  {updateNextInOneClick && (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={quickNextActionType}
                          onChange={(e) =>
                            setQuickNextActionType(
                              e.target.value as NextActionType
                            )
                          }
                          className="p-2 text-sm rounded-lg border border-slate-300 bg-white font-bold"
                        >
                          {NEXT_ACTION_TYPES.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={quickNextDueDate}
                          onChange={(e) => setQuickNextDueDate(e.target.value)}
                          className="p-2 text-sm rounded-lg border border-slate-300 bg-white font-bold"
                        />
                      </div>
                      <input
                        type="text"
                        value={quickNextActionDesc}
                        onChange={(e) => setQuickNextActionDesc(e.target.value)}
                        placeholder="תיאור הפעולה / התזכורת הבאה..."
                        className="w-full p-2 text-sm rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submittingLog || !logContent.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[15px] font-extrabold shadow-sm transition"
                >
                  {submittingLog
                    ? 'שומר רישום...'
                    : `שמור ${logType} בחתימת ${currentUser.displayName}`}
                </button>
              </form>

              {/* ציר זמן תרשומות משמאל */}
              <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-lg font-extrabold text-slate-900">
                    היסטוריית תרשומות שיחה, הערות, תזכורות וארכות ({logs.length})
                  </h3>
                  <span className="text-xs font-extrabold text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                    מונה דחיות / ארכות בתיק: {extensionsCount}
                  </span>
                </div>

                {loadingLogs ? (
                  <p className="text-sm text-slate-500 py-6 text-center">
                    טוען יומן תרשומות...
                  </p>
                ) : logs.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">
                    טרם הוזנו תרשומות או הערות בתיק זה.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[54vh] overflow-y-auto pr-1">
                    {logs.map((l) => (
                      <div
                        key={l.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
                                l.log_type === 'בקשת ארכה / דחיית דיון'
                                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                                  : l.log_type === 'החלטת ביהמ"ש'
                                  ? 'bg-purple-100 text-purple-900 border-purple-300'
                                  : l.log_type === 'תזכורת אישית/מועד'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-blue-100 text-blue-900 border-blue-300'
                              }`}
                            >
                              {l.log_type}
                            </span>
                            <span className="text-xs font-bold text-slate-500">
                              {formatDateTimeHe(l.log_date)}
                            </span>
                            <span className="text-xs font-extrabold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                              נחתם ע&quot;י: {l.created_by || 'מערכת'}
                            </span>
                          </div>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteLog(l.id)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded no-print"
                              title="מחק תרשומת (מנהל)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <p className="text-[15px] text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
                          {l.content}
                        </p>

                        {l.due_date && (
                          <div className="text-xs font-extrabold text-indigo-700 pt-1">
                            מועד יעד שנקבע: {formatDateHe(l.due_date)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
