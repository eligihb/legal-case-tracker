'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Plus,
  Tag,
  Calculator,
  Building2,
  Gavel,
  Briefcase,
  Home,
} from 'lucide-react';
import {
  CASE_CATEGORIES,
  CASE_STATUSES,
  CASE_TAGS,
  CATEGORY_LABELS,
  CaseCategory,
  CaseItem,
  CaseMilestone,
  CaseStatus,
  CaseTag,
  GACHLAT_STATUSES,
  GachlatStatus,
  INSOLVENCY_DEBTOR_TYPES,
  InsolvencyDebtorType,
  MunicipalitySetting,
  NEXT_ACTION_TYPES,
  NextActionType,
} from '@/types/database';
import { createCaseItem, generateId } from '@/lib/dataService';
import { addDaysToDateStr, formatCurrencyILS } from '@/lib/dateUtils';

interface NewCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newCase: CaseItem) => void;
  municipalitiesSettings: MunicipalitySetting[];
  defaultCategory?: CaseCategory;
}

export default function NewCaseModal({
  isOpen,
  onClose,
  onCreated,
  municipalitiesSettings,
  defaultCategory = 'גבייה',
}: NewCaseModalProps) {
  const [debtorName, setDebtorName] = useState('');
  const [idOrHp, setIdOrHp] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [gushHelka, setGushHelka] = useState('');
  const [category, setCategory] = useState<CaseCategory>(defaultCategory);
  const [currentStage, setCurrentStage] = useState(
    'לפני תביעה - בדיקות מקדמיות'
  );
  const [municipality, setMunicipality] = useState('');
  const [tags, setTags] = useState<CaseTag[]>([]);
  const [status, setStatus] = useState<CaseStatus>('לפני תביעה');
  const [notes, setNotes] = useState('');
  const [nextActionType, setNextActionType] = useState<NextActionType>(
    'פתיחת תביעה בהוצל"פ'
  );
  const [nextActionDescription, setNextActionDescription] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');

  // 1. שדות תיקי רשויות
  const [debtYears, setDebtYears] = useState('2021-2025');
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

  // 2. שדות תיקי חדל"פ
  const [isMaterialCreditor, setIsMaterialCreditor] = useState(false);
  const [insolvencyDebtorType, setInsolvencyDebtorType] =
    useState<InsolvencyDebtorType>('חייב יחיד');
  const [trusteeNameAndContact, setTrusteeNameAndContact] = useState('');
  const [debtClaimDeadline, setDebtClaimDeadline] = useState('');
  const [debtClaimAmount, setDebtClaimAmount] = useState<number>(0);

  // 3. שדות תיקי חברות (נאמן / מפרק)
  const [selfUndertakingDeposited, setSelfUndertakingDeposited] =
    useState(false);
  const [investigatingTrusteeName, setInvestigatingTrusteeName] = useState('');
  const [trusteeReportDueDate, setTrusteeReportDueDate] = useState('');

  // 4. שדות חברה משכנת
  const [housingProjectName, setHousingProjectName] = useState('');
  const [surveyorName, setSurveyorName] = useState('');
  const [sellerBuyerNames, setSellerBuyerNames] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCategory(defaultCategory);
      if (defaultCategory === 'גבייה') {
        setStatus('לפני תביעה');
        setCurrentStage('לפני תביעה - בדיקות מקדמיות');
        setNextActionType('פתיחת תביעה בהוצל"פ');
      } else if (defaultCategory === 'חדל"פ') {
        setStatus('פעיל');
        setCurrentStage('מינוי נאמן והגשת תביעת חוב');
        setNextActionType('תביעת חוב');
      } else if (defaultCategory === 'חברות') {
        setStatus('פעיל');
        setCurrentStage('הפקדת התחייבות עצמית ואיתור נכסים');
        setNextActionType('דו"ח עדכון נאמן');
      } else {
        setStatus('פעיל');
        setCurrentStage('אישור מפרקים ובדיקת תצ"ר / העברת זכויות');
        setNextActionType('העברת זכויות והנפקת אישור');
      }
    }
  }, [isOpen, defaultCategory]);

  const matchedMuni = useMemo(() => {
    if (!municipality.trim()) return null;
    const norm = municipality.trim().toLowerCase();
    return (
      municipalitiesSettings.find(
        (m) =>
          m.municipality_name.toLowerCase() === norm ||
          m.municipality_name.toLowerCase().includes(norm)
      ) || null
    );
  }, [municipality, municipalitiesSettings]);

  const totalDebt =
    (Number(principalAmount) || 0) +
    (Number(interestAmount) || 0) +
    (Number(expensesAmount) || 0) +
    (Number(legalFeeAmount) || 0);

  if (!isOpen) return null;

  const toggleTag = (tag: CaseTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAutoCalcFee = () => {
    if (!matchedMuni) return;
    if (matchedMuni.fee_calculation_method === 'סכום קבוע') {
      setLegalFeeAmount(Number(matchedMuni.fee_rate_value) || 0);
    } else {
      const base =
        (Number(principalAmount) || 0) + (Number(interestAmount) || 0);
      setLegalFeeAmount(
        Math.round(base * ((Number(matchedMuni.fee_rate_value) || 15) / 100))
      );
    }
  };

  const buildDefaultMilestonesForCategory = (
    cat: CaseCategory,
    today: string
  ): CaseMilestone[] => {
    if (cat === 'גבייה') {
      const list: CaseMilestone[] = [
        {
          id: generateId(),
          title: 'קליטת תדפיס חוב ובדיקת גח"לת ממשרד האוכלוסין',
          status: gachlatStatus === 'התקבל ואומת' ? 'done' : 'in_progress',
          urgency: 'גבוהה',
          planned_days: 5,
          started_at: today,
          completed_at: gachlatStatus === 'התקבל ואומת' ? today : null,
          days_spent: 0,
        },
      ];
      if (hasProperty) {
        list.push({
          id: generateId(),
          title: 'רישום משכון על הנכס',
          status: 'in_progress',
          urgency: 'דחוף מאוד',
          planned_days: 7,
          started_at: today,
          completed_at: null,
          days_spent: 0,
        });
      }
      list.push({
        id: generateId(),
        title: 'משלוח מכתב התראה, אישור מסירה וספירת 30 ימים לפתיחת תביעה בהוצל"פ',
        status: deliveryConfirmationDate ? 'in_progress' : 'upcoming',
        urgency: 'גבוהה',
        planned_days: 30,
        started_at: warningLetterSentDate || null,
        completed_at: null,
        days_spent: 0,
      });
      return list;
    }

    if (cat === 'חדל"פ') {
      return [
        {
          id: generateId(),
          title: 'בקשת נושה לצו פתיחת הליכים',
          status: 'done',
          urgency: 'גבוהה',
          planned_days: 10,
          started_at: today,
          completed_at: today,
          days_spent: 0,
        },
        {
          id: generateId(),
          title: 'מינוי נאמן / מפרק וקבלת צו',
          status: 'in_progress',
          urgency: 'רגילה',
          planned_days: 14,
          started_at: today,
          completed_at: null,
          days_spent: 0,
        },
        {
          id: generateId(),
          title: 'הגשת תביעת חוב (מעקב ספירה לאחור למועד אחרון)',
          status: 'in_progress',
          urgency: 'דחוף מאוד',
          planned_days: 14,
          started_at: today,
          completed_at: null,
          days_spent: 0,
        },
        {
          id: generateId(),
          title: isMaterialCreditor
            ? 'תגובות נושה מהותי בתיק לבקשות הנאמן והחייב'
            : 'תגובות נושה שוטפות בתיק',
          status: 'upcoming',
          urgency: isMaterialCreditor ? 'דחוף מאוד' : 'רגילה',
          planned_days: 7,
          started_at: null,
          completed_at: null,
          days_spent: 0,
        },
        {
          id: generateId(),
          title: 'מעקב חובות חדשים (בדיקה מול נאמן / בקשה לביטול הליכים)',
          status: 'upcoming',
          urgency: 'גבוהה',
          planned_days: 14,
          started_at: null,
          completed_at: null,
          days_spent: 0,
        },
      ];
    }

    if (cat === 'חברות') {
      return [
        {
          id: generateId(),
          title: 'הפקדת התחייבות עצמית של הנאמן/המפרק (100,000 ₪)',
          status: selfUndertakingDeposited ? 'done' : 'in_progress',
          urgency: 'דחוף מאוד',
          planned_days: 5,
          started_at: today,
          completed_at: selfUndertakingDeposited ? today : null,
          days_spent: 0,
        },
        {
          id: generateId(),
          title: 'מכתבים לחברות ביטוח ואיתור נכסים',
          status: 'in_progress',
          urgency: 'גבוהה',
          planned_days: 10,
          started_at: today,
          completed_at: null,
          days_spent: 0,
        },
        {
          id: generateId(),
          title: 'פנייה למייצג ותיאום מועד פנוי של הנאמן החוקר + דרישת סט מסמכים',
          status: 'upcoming',
          urgency: 'גבוהה',
          planned_days: 10,
          started_at: null,
          completed_at: null,
          days_spent: 0,
        },
        {
          id: generateId(),
          title: 'קיום חקירה וטיפול בתוצאות (צו הבאה / השלמות מסמכים)',
          status: 'upcoming',
          urgency: 'גבוהה',
          planned_days: 14,
          started_at: null,
          completed_at: null,
          days_spent: 0,
        },
        {
          id: generateId(),
          title: 'הגשת דו"ח נאמן ועדכון ממצאים לביהמ"ש + הכרעה: שיקום או פירוק',
          status: 'upcoming',
          urgency: 'גבוהה',
          planned_days: 14,
          started_at: null,
          completed_at: null,
          days_spent: 0,
        },
      ];
    }

    // חברה משכנת
    return [
      {
        id: generateId(),
        title: 'אישור מפרקים למכירת זכויות, ניהול תיקים פיזיים והנפקת אישור זכויות',
        status: 'in_progress',
        urgency: 'גבוהה',
        planned_days: 7,
        started_at: today,
        completed_at: null,
        days_spent: 0,
      },
      {
        id: generateId(),
        title: 'מעקב מול מודד על תצ"רים + טיפול בתצ"ר חניות והתאמה לבית משותף',
        status: 'in_progress',
        urgency: 'גבוהה',
        planned_days: 21,
        started_at: today,
        completed_at: null,
        days_spent: 0,
      },
      {
        id: generateId(),
        title: 'בקרת חשבוניות מול אישור ביהמ"ש, ההסכם, צורת התשלום והמועדים',
        status: 'upcoming',
        urgency: 'רגילה',
        planned_days: 7,
        started_at: null,
        completed_at: null,
        days_spent: 0,
      },
      {
        id: generateId(),
        title: 'העברת זכויות: בדיקת סט מסמכי חתימה מלא + אישור המפרק ➔ הפקת אישור זכויות לקונה החדש',
        status: 'upcoming',
        urgency: 'דחוף מאוד',
        planned_days: 5,
        started_at: null,
        completed_at: null,
        days_spent: 0,
      },
    ];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtorName.trim()) return;

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const execTargetDate = deliveryConfirmationDate
        ? addDaysToDateStr(deliveryConfirmationDate, 30)
        : null;

      const initialMilestones = buildDefaultMilestonesForCategory(
        category,
        today
      );

      const finalTags = [...tags];
      if (hasProperty && !finalTags.includes('משכון רשום')) {
        finalTags.push('משכון רשום');
      }
      if (isMaterialCreditor && !finalTags.includes('נושה מהותי')) {
        finalTags.push('נושה מהותי');
      }
      if (category === 'חברה משכנת' && !finalTags.includes('חברה משכנת')) {
        finalTags.push('חברה משכנת');
      }

      const created = await createCaseItem({
        debtor_name: debtorName.trim(),
        id_or_hp: idOrHp.trim(),
        case_number: caseNumber.trim(),
        gush_helka: gushHelka.trim() || propertyDetails.trim(),
        category,
        current_stage: currentStage.trim(),
        municipality: municipality.trim() || null,
        tags: finalTags,
        status,
        notes: notes.trim(),
        next_action_type: nextActionType,
        next_action_description:
          nextActionDescription.trim() ||
          (execTargetDate
            ? 'חלוף 30 יום מאישור מסירה — לפתוח תביעה בהוצל"פ'
            : ''),
        next_due_date:
          nextDueDate || execTargetDate || debtClaimDeadline || null,
        extensions_count: 0,
        is_hearing_postponed: false,
        trustee_report_due_date: trusteeReportDueDate || null,

        // רשויות
        debt_years: debtYears.trim(),
        principal_amount: Number(principalAmount) || 0,
        interest_amount: Number(interestAmount) || 0,
        expenses_amount: Number(expensesAmount) || 0,
        legal_fee_amount: Number(legalFeeAmount) || 0,
        gachlat_status: gachlatStatus,
        has_property: hasProperty,
        property_details: propertyDetails.trim() || gushHelka.trim(),
        warning_letter_sent_date: warningLetterSentDate || null,
        delivery_confirmation_date: deliveryConfirmationDate || null,
        execution_target_date: execTargetDate,
        monthly_reductions: [],
        milestones: initialMilestones,
        is_old_debt_writeoff: false,
        writeoff_classification: null,
        legal_opinion_summary: '',

        // חדל"פ
        is_material_creditor: isMaterialCreditor,
        insolvency_debtor_type: insolvencyDebtorType,
        trustee_name_and_contact: trusteeNameAndContact.trim(),
        debt_claim_deadline: debtClaimDeadline || null,
        debt_claim_submitted: false,
        debt_claim_amount: Number(debtClaimAmount) || 0,
        creditor_responses_notes: '',
        new_debts_tracking: '',

        // חברות
        self_undertaking_deposited: selfUndertakingDeposited,
        self_undertaking_date: selfUndertakingDeposited ? today : null,
        investigating_trustee_name: investigatingTrusteeName.trim(),
        investigation_outcome: 'טרם נחקר',
        company_resolution_decision: 'טרם הוכרע',

        // חברה משכנת
        housing_project_name: housingProjectName.trim(),
        surveyor_name: surveyorName.trim(),
        seller_buyer_names: sellerBuyerNames.trim(),
        condominium_registration_fit: 'בבדיקה',
      });

      onCreated(created);
      setDebtorName('');
      setIdOrHp('');
      setCaseNumber('');
      setGushHelka('');
      setMunicipality('');
      setTags([]);
      setNotes('');
      setNextActionDescription('');
      setNextDueDate('');
      onClose();
    } catch (err) {
      console.error('Error creating case:', err);
      alert('שגיאה בהקמת התיק החדש');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div
        dir="rtl"
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h2 className="text-lg font-extrabold flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" />
            הקמת תיק חדש באחד מ-4 עולמות התוכן
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[84vh] overflow-y-auto"
        >
          {/* בחירת אחד מ-4 תחומי התיקים */}
          <div>
            <label className="block text-sm font-extrabold text-slate-800 mb-2">
              בחר את עולם התוכן של התיק (יטען אוטומטית את הצ&apos;ק-ליסט והשדות הייעודיים):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {CASE_CATEGORIES.map((cat) => {
                const active = category === cat;
                const info = CATEGORY_LABELS[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`p-3 rounded-xl border text-right text-xs font-extrabold transition ${
                      active
                        ? cat === 'גבייה'
                          ? 'bg-blue-700 text-white border-blue-800 shadow-sm'
                          : cat === 'חדל"פ'
                          ? 'bg-purple-700 text-white border-purple-800 shadow-sm'
                          : cat === 'חברות'
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
                          : 'bg-amber-600 text-white border-amber-700 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div>
                      {info.number}. {info.shortTitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1">
                שם חייב / חברה / פרויקט ודירה *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={debtorName}
                onChange={(e) => setDebtorName(e.target.value)}
                placeholder="לדוגמה: ישראל ישראלי בע״מ / פרויקט נופי השרון דירה 12"
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-blue-600 outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                ת&quot;ז / ח&quot;פ
              </label>
              <input
                type="text"
                value={idOrHp}
                onChange={(e) => setIdOrHp(e.target.value)}
                placeholder="9 ספרות"
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-blue-600 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                מספר תיק (ביהמ&quot;ש / הוצל&quot;פ)
              </label>
              <input
                type="text"
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="הוצל״פ / חדל״פ..."
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-blue-600 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                גוש / חלקה / תת-חלקה
              </label>
              <input
                type="text"
                value={gushHelka}
                onChange={(e) => setGushHelka(e.target.value)}
                placeholder="למשל: גוש 6214 חלקה 88"
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-blue-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                עירייה / רשות מקומית
              </label>
              <input
                type="text"
                list="muni-list-new-modal"
                value={municipality}
                onChange={(e) => setMunicipality(e.target.value)}
                placeholder="למשל: עיריית פתח תקווה"
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-blue-600 outline-none"
              />
              <datalist id="muni-list-new-modal">
                {municipalitiesSettings.map((m) => (
                  <option key={m.id} value={m.municipality_name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                השלב הנוכחי בתיק
              </label>
              <input
                type="text"
                value={currentStage}
                onChange={(e) => setCurrentStage(e.target.value)}
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-blue-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                סטטוס תיק
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CaseStatus)}
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:border-blue-600 outline-none font-bold"
              >
                {CASE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {matchedMuni && (
            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-sm space-y-1">
              <div className="font-extrabold text-indigo-950 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  כללי רשות ({matchedMuni.municipality_name}):{' '}
                  {matchedMuni.fee_calculation_method} (
                  {matchedMuni.fee_calculation_method === 'סכום קבוע'
                    ? `₪${matchedMuni.fee_rate_value}`
                    : `${matchedMuni.fee_rate_value}%`}
                  )
                </span>
                <button
                  type="button"
                  onClick={handleAutoCalcFee}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                >
                  חשב שכ&quot;ט אוטומטית
                </button>
              </div>
              <p className="text-xs text-indigo-900">
                <strong>הנחיות הרשות:</strong> {matchedMuni.standing_instructions}
              </p>
            </div>
          )}

          {/* שדות ייעודיים לפי סוג התיק הנבחר */}
          {category === 'גבייה' && (
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-3">
              <h3 className="text-sm font-extrabold text-blue-950 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-blue-600" />
                שדות ייעודיים: תיקי רשויות (לפני תביעה, גח&quot;לת, משכון ואישור מסירה + 30 יום)
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    שנות החוב
                  </label>
                  <input
                    type="text"
                    value={debtYears}
                    onChange={(e) => setDebtYears(e.target.value)}
                    placeholder="2020-2024"
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    קרן חוב (₪)
                  </label>
                  <input
                    type="number"
                    value={principalAmount || ''}
                    onChange={(e) =>
                      setPrincipalAmount(Number(e.target.value) || 0)
                    }
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ריבית (₪)
                  </label>
                  <input
                    type="number"
                    value={interestAmount || ''}
                    onChange={(e) =>
                      setInterestAmount(Number(e.target.value) || 0)
                    }
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    הוצאות (₪)
                  </label>
                  <input
                    type="number"
                    value={expensesAmount || ''}
                    onChange={(e) =>
                      setExpensesAmount(Number(e.target.value) || 0)
                    }
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    שכ&quot;ט (₪)
                  </label>
                  <input
                    type="number"
                    value={legalFeeAmount || ''}
                    onChange={(e) =>
                      setLegalFeeAmount(Number(e.target.value) || 0)
                    }
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white font-bold text-blue-700"
                  />
                </div>
                <div className="bg-blue-900 text-white rounded p-2 flex flex-col justify-center">
                  <span className="text-[11px] text-blue-200">סה&quot;כ חוב:</span>
                  <span className="text-sm font-extrabold">
                    {formatCurrencyILS(totalDebt)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    סטטוס גח&quot;לת
                  </label>
                  <select
                    value={gachlatStatus}
                    onChange={(e) =>
                      setGachlatStatus(e.target.value as GachlatStatus)
                    }
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white font-bold"
                  >
                    {GACHLAT_STATUSES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    קיים נכס? (משכון)
                  </label>
                  <select
                    value={hasProperty ? 'yes' : 'no'}
                    onChange={(e) => setHasProperty(e.target.value === 'yes')}
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white font-bold"
                  >
                    <option value="no">לא</option>
                    <option value="yes">כן (יוצר משימת רישום משכון)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    תאריך משלוח התראה
                  </label>
                  <input
                    type="date"
                    value={warningLetterSentDate}
                    onChange={(e) => setWarningLetterSentDate(e.target.value)}
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    תאריך אישור מסירה (+30 יום)
                  </label>
                  <input
                    type="date"
                    value={deliveryConfirmationDate}
                    onChange={(e) => {
                      setDeliveryConfirmationDate(e.target.value);
                      const t30 = addDaysToDateStr(e.target.value, 30);
                      if (t30) setNextDueDate(t30);
                    }}
                    className="w-full p-2 text-sm rounded border border-blue-400 bg-white font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {category === 'חדל"פ' && (
            <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-3">
              <h3 className="text-sm font-extrabold text-purple-950 flex items-center gap-1.5">
                <Gavel className="w-4 h-4 text-purple-600" />
                שדות ייעודיים: תיקי חדל&quot;פ (ייצוג נושה / פירוק)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-purple-900 mb-1">
                    נושה מהותי בתיק?
                  </label>
                  <select
                    value={isMaterialCreditor ? 'yes' : 'no'}
                    onChange={(e) =>
                      setIsMaterialCreditor(e.target.value === 'yes')
                    }
                    className="w-full p-2 text-sm rounded border border-purple-300 bg-white font-extrabold text-purple-900"
                  >
                    <option value="no">לא (נושה רגיל)</option>
                    <option value="yes">כן — נושה מהותי בתיק!</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    סיווג חייב (יחיד / חברה בפירוק)
                  </label>
                  <select
                    value={insolvencyDebtorType}
                    onChange={(e) =>
                      setInsolvencyDebtorType(
                        e.target.value as InsolvencyDebtorType
                      )
                    }
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white font-bold"
                  >
                    {INSOLVENCY_DEBTOR_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    מועד אחרון להגשת תביעת חוב
                  </label>
                  <input
                    type="date"
                    value={debtClaimDeadline}
                    onChange={(e) => setDebtClaimDeadline(e.target.value)}
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    פרטי נאמן / מפרק בתיק
                  </label>
                  <input
                    type="text"
                    value={trusteeNameAndContact}
                    onChange={(e) => setTrusteeNameAndContact(e.target.value)}
                    placeholder="שם עו״ד/רו״ח, טלפון ודוא״ל..."
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    סכום תביעת החוב (₪)
                  </label>
                  <input
                    type="number"
                    value={debtClaimAmount || ''}
                    onChange={(e) =>
                      setDebtClaimAmount(Number(e.target.value) || 0)
                    }
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {category === 'חברות' && (
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
              <h3 className="text-sm font-extrabold text-emerald-950 flex items-center gap-1.5">
                <Briefcase className="w-4 h-4 text-emerald-600" />
                שדות ייעודיים: תיקי חברות (נאמן / מפרק)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    הפקדת התחייבות עצמית (100,000 ₪)
                  </label>
                  <select
                    value={selfUndertakingDeposited ? 'yes' : 'no'}
                    onChange={(e) =>
                      setSelfUndertakingDeposited(e.target.value === 'yes')
                    }
                    className="w-full p-2 text-sm rounded border border-emerald-300 bg-white font-bold"
                  >
                    <option value="no">טרם הופקדה</option>
                    <option value="yes">הופקדה ✓</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    שם הנאמן החוקר במשרד
                  </label>
                  <input
                    type="text"
                    value={investigatingTrusteeName}
                    onChange={(e) => setInvestigatingTrusteeName(e.target.value)}
                    placeholder="למשל: עו״ד מיכל לוי"
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    מועד עדכון דו&quot;ח נאמן לביהמ&quot;ש
                  </label>
                  <input
                    type="date"
                    value={trusteeReportDueDate}
                    onChange={(e) => setTrusteeReportDueDate(e.target.value)}
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {category === 'חברה משכנת' && (
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3">
              <h3 className="text-sm font-extrabold text-amber-950 flex items-center gap-1.5">
                <Home className="w-4 h-4 text-amber-600" />
                שדות ייעודיים: פרויקט חברה משכנת (רישום וזכויות)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    שם הפרויקט / המתחם
                  </label>
                  <input
                    type="text"
                    value={housingProjectName}
                    onChange={(e) => setHousingProjectName(e.target.value)}
                    placeholder="למשל: פרויקט נופי השרון נתניה"
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    שם המודד המטפל בתצ&quot;רים
                  </label>
                  <input
                    type="text"
                    value={surveyorName}
                    onChange={(e) => setSurveyorName(e.target.value)}
                    placeholder="שם וטלפון מודד..."
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    העברת זכויות (מוכר ➔ קונה חדש)
                  </label>
                  <input
                    type="text"
                    value={sellerBuyerNames}
                    onChange={(e) => setSellerBuyerNames(e.target.value)}
                    placeholder="מוכר: כהן ➔ קונה: לוי"
                    className="w-full p-2 text-sm rounded border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Tag className="w-4 h-4 text-slate-500" />
              תגיות מאפיינים
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CASE_TAGS.map((tag) => {
                const active = tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition ${
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                סוג פעולה הבאה
              </label>
              <select
                value={nextActionType}
                onChange={(e) =>
                  setNextActionType(e.target.value as NextActionType)
                }
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 bg-white outline-none font-bold"
              >
                {NEXT_ACTION_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                תאריך יעד / מועד דיון
              </label>
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 bg-white outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                תיאור הפעולה הבאה
              </label>
              <input
                type="text"
                value={nextActionDescription}
                onChange={(e) => setNextActionDescription(e.target.value)}
                placeholder="למשל: פתיחת תביעה בהוצל״פ / הגשת דו״ח..."
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 bg-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              הערות ליבה בתיק
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="תקציר החוב, אנשי קשר, הערות מיוחדות..."
              className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-blue-600 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={submitting || !debtorName.trim()}
              className="px-6 py-2.5 rounded-xl text-sm font-extrabold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition"
            >
              {submitting ? 'שומר תיק...' : 'שמור ופתח תיק'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
