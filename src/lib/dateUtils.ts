import {
  CaseCategory,
  CaseItem,
  CaseStatus,
  CaseTag,
  CASE_CATEGORIES,
  CASE_STATUSES,
  CASE_TAGS,
  CATEGORY_LABELS,
  NEXT_ACTION_TYPES,
  NextActionType,
} from '@/types/database';

export interface DueCountdown {
  daysDiff: number | null; // שלילי = באיחור, 0 = היום, חיובי = בעתיד
  label: string;
  urgency: 'overdue' | 'today' | 'soon' | 'normal' | 'none';
}

export function getDueCountdown(dueDateStr?: string | null): DueCountdown {
  if (!dueDateStr) {
    return { daysDiff: null, label: 'ללא תאריך יעד', urgency: 'none' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = dueDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return { daysDiff: null, label: dueDateStr, urgency: 'none' };
  }

  const target = new Date(parts[0], parts[1] - 1, parts[2]);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  const daysDiff = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    const absDays = Math.abs(daysDiff);
    return {
      daysDiff,
      label: absDays === 1 ? 'באיחור יום אחד' : `באיחור ${absDays} ימים`,
      urgency: 'overdue',
    };
  }

  if (daysDiff === 0) {
    return {
      daysDiff: 0,
      label: 'היום!',
      urgency: 'today',
    };
  }

  if (daysDiff <= 7) {
    return {
      daysDiff,
      label: daysDiff === 1 ? 'מחר (עוד יום)' : `עוד ${daysDiff} ימים`,
      urgency: 'soon',
    };
  }

  return {
    daysDiff,
    label: `עוד ${daysDiff} ימים`,
    urgency: 'normal',
  };
}

/**
 * מוסיף מספר ימים לתאריך YYYY-MM-DD ומחזיר YYYY-MM-DD
 * משמש לחישוב אוטומטי: אישור מסירה + 30 ימים
 */
export function addDaysToDateStr(dateStr?: string | null, daysToAdd = 30): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().split('T')[0];
}

/**
 * בדיקה האם חלפו 30 ימים (או יותר) מתאריך אישור המסירה וטרם נפתח תיק הוצל"פ
 */
export function isDeliveryOver30DaysAlert(caseItem: CaseItem): {
  isAlert: boolean;
  daysElapsed: number;
  targetDate: string | null;
} {
  if (
    caseItem.category !== 'גבייה' ||
    !caseItem.delivery_confirmation_date ||
    caseItem.status === 'סגור' ||
    caseItem.status === 'בהוצל"פ' ||
    caseItem.status === 'בהסדר תשלומים' ||
    caseItem.status === 'סיום הסדר / סילוק חוב'
  ) {
    return { isAlert: false, daysElapsed: 0, targetDate: null };
  }

  const parts = caseItem.delivery_confirmation_date.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return { isAlert: false, daysElapsed: 0, targetDate: null };
  }

  const deliveryDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysElapsed = Math.floor(
    (today.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const targetDate =
    caseItem.execution_target_date ||
    addDaysToDateStr(caseItem.delivery_confirmation_date, 30);

  return {
    isAlert: daysElapsed >= 30,
    daysElapsed,
    targetDate,
  };
}

/**
 * חישוב סה"כ חוב הרשות מתוך קרן + ריבית + הוצאות + שכ"ט
 */
export function calculateTotalDebt(c: Partial<CaseItem>): number {
  const principal = Number(c.principal_amount) || 0;
  const interest = Number(c.interest_amount) || 0;
  const expenses = Number(c.expenses_amount) || 0;
  const fee = Number(c.legal_fee_amount) || 0;
  const total = principal + interest + expenses + fee;
  if (total === 0 && c.debt_claim_amount) {
    return Number(c.debt_claim_amount) || 0;
  }
  return total;
}

/**
 * חישוב ימים שחלפו מתאריך התחלה לתאריך סיום (או להיום אם טרם הסתיים)
 */
export function calculateMilestoneDays(
  startedAt?: string | null,
  completedAt?: string | null
): number {
  if (!startedAt) return 0;
  const sParts = startedAt.split('-').map(Number);
  if (sParts.length !== 3 || sParts.some(isNaN)) return 0;
  const start = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0);

  let end = new Date();
  end.setHours(0, 0, 0, 0);
  if (completedAt) {
    const eParts = completedAt.split('-').map(Number);
    if (eParts.length === 3 && !eParts.some(isNaN)) {
      end = new Date(eParts[0], eParts[1] - 1, eParts[2], 0, 0, 0);
    }
  }

  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function formatCurrencyILS(amount?: number | null): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDateHe(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  try {
    return new Date(dateStr).toLocaleDateString('he-IL');
  } catch {
    return dateStr;
  }
}

export function formatDateTimeHe(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

// ============================================================================
// CSV Import & Export Utilities
// ============================================================================

export function parseCsvToCases(
  csvText: string
): Omit<CaseItem, 'id' | 'updated_at'>[] {
  const cleanText = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return [];

  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const splitCsvRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitCsvRow(lines[0]).map((h) => h.trim().toLowerCase());

  const findColIdx = (candidates: string[]): number =>
    headers.findIndex((h) => candidates.some((c) => h.includes(c)));

  const idxName = findColIdx(['שם חייב', 'חייב', 'חברה', 'שם', 'debtor_name', 'debtor']);
  const idxIdHp = findColIdx(['ת"ז', 'תז', 'ח"פ', 'חפ', 'id_or_hp', 'id']);
  const idxCaseNum = findColIdx(['מספר תיק', 'תיק', 'case_number', 'case']);
  const idxGush = findColIdx(['גוש', 'חלקה', 'gush_helka']);
  const idxCategory = findColIdx(['סוג הליך', 'תחום', 'קטגוריה', 'הליך', 'category']);
  const idxStage = findColIdx(['שלב', 'current_stage', 'stage']);
  const idxMuni = findColIdx(['עירייה', 'רשות', 'municipality']);
  const idxTags = findColIdx(['תגיות', 'מאפיינים', 'tags']);
  const idxStatus = findColIdx(['סטטוס', 'מצב', 'status']);
  const idxNotes = findColIdx(['הערות', 'notes']);
  const idxActionType = findColIdx(['סוג פעולה', 'סוג מועד', 'next_action_type']);
  const idxActionDesc = findColIdx(['פעולה הבאה', 'תיאור פעולה', 'next_action_description']);
  const idxDueDate = findColIdx(['תאריך יעד', 'מועד דיון', 'מועד', 'next_due_date', 'due_date']);
  const idxDebtYears = findColIdx(['שנות חוב', 'שנים', 'debt_years']);
  const idxPrincipal = findColIdx(['קרן', 'principal']);

  const parsedCases: Omit<CaseItem, 'id' | 'updated_at'>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const debtorName = (idxName >= 0 ? cols[idxName] : cols[0])?.trim();
    if (!debtorName) continue;

    const rawCat = (idxCategory >= 0 ? cols[idxCategory] : '')?.trim();
    const category: CaseCategory = CASE_CATEGORIES.includes(rawCat as CaseCategory)
      ? (rawCat as CaseCategory)
      : rawCat.includes('משכנת')
      ? 'חברה משכנת'
      : rawCat.includes('חבר')
      ? 'חברות'
      : rawCat.includes('גבי') || rawCat.includes('רשו') || rawCat.includes('הוצל')
      ? 'גבייה'
      : 'חדל"פ';

    const rawStatus = (idxStatus >= 0 ? cols[idxStatus] : '')?.trim();
    const status: CaseStatus = CASE_STATUSES.includes(rawStatus as CaseStatus)
      ? (rawStatus as CaseStatus)
      : category === 'גבייה'
      ? 'לפני תביעה'
      : 'פעיל';

    const rawTagsStr = (idxTags >= 0 ? cols[idxTags] : '')?.trim() || '';
    const tags: CaseTag[] = rawTagsStr
      .split(/[;|,]/)
      .map((t) => t.trim())
      .filter((t): t is CaseTag => CASE_TAGS.includes(t as CaseTag));

    const rawActionType = (idxActionType >= 0 ? cols[idxActionType] : '')?.trim();
    const next_action_type: NextActionType = NEXT_ACTION_TYPES.includes(
      rawActionType as NextActionType
    )
      ? (rawActionType as NextActionType)
      : 'אחר';

    let next_due_date: string | null = null;
    const rawDate = (idxDueDate >= 0 ? cols[idxDueDate] : '')?.trim();
    if (rawDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        next_due_date = rawDate;
      } else if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(rawDate)) {
        const dParts = rawDate.split(/[./-]/);
        const day = dParts[0].padStart(2, '0');
        const month = dParts[1].padStart(2, '0');
        const year = dParts[2].length === 2 ? `20${dParts[2]}` : dParts[2];
        next_due_date = `${year}-${month}-${day}`;
      }
    }

    const principalVal =
      idxPrincipal >= 0 ? Number((cols[idxPrincipal] || '').replace(/[^\d.-]/g, '')) || 0 : 0;

    parsedCases.push({
      debtor_name: debtorName,
      id_or_hp: (idxIdHp >= 0 ? cols[idxIdHp] : '') || '',
      case_number: (idxCaseNum >= 0 ? cols[idxCaseNum] : '') || '',
      gush_helka: (idxGush >= 0 ? cols[idxGush] : '') || '',
      category,
      current_stage:
        (idxStage >= 0 ? cols[idxStage] : '') ||
        (category === 'גבייה' ? 'לפני תביעה - בדיקות מקדמיות' : 'פתיחת תיק ובדיקות'),
      municipality: (idxMuni >= 0 ? cols[idxMuni] : '') || null,
      tags,
      status,
      notes: (idxNotes >= 0 ? cols[idxNotes] : '') || '',
      next_action_type,
      next_action_description: (idxActionDesc >= 0 ? cols[idxActionDesc] : '') || '',
      next_due_date,
      debt_years: (idxDebtYears >= 0 ? cols[idxDebtYears] : '') || '',
      principal_amount: principalVal,
      interest_amount: 0,
      expenses_amount: 0,
      legal_fee_amount: 0,
      gachlat_status: 'חסר גח"לת',
      has_property: false,
      monthly_reductions: [],
      milestones: [],
      extensions_count: 0,
    });
  }

  return parsedCases;
}

export function generateCsvContent(cases: CaseItem[]): string {
  const headers = [
    'שם חייב / פרויקט',
    'ת"ז / ח"פ',
    'מספר תיק',
    'גוש / חלקה',
    'תחום התיק',
    'שלב נוכחי',
    'עירייה / רשות',
    'סטטוס',
    'שנות חוב',
    'קרן חוב',
    'ריבית',
    'הוצאות',
    'שכר טרחה',
    'סה"כ חוב / תביעה',
    'גח"לת',
    'קיים נכס',
    'אישור מסירה',
    'יעד הוצל"פ (+30 יום)',
    'מונה ארכות/דחיות',
    'סוג פעולה הבאה',
    'תיאור פעולה הבאה',
    'תאריך יעד',
    'הערות',
  ];

  const escapeCsv = (val?: string | number | null) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = cases.map((c) =>
    [
      escapeCsv(c.debtor_name),
      escapeCsv(c.id_or_hp),
      escapeCsv(c.case_number),
      escapeCsv(c.gush_helka || c.property_details || ''),
      escapeCsv(CATEGORY_LABELS[c.category]?.title || c.category),
      escapeCsv(c.current_stage || ''),
      escapeCsv(c.municipality),
      escapeCsv(c.status),
      escapeCsv(c.debt_years || ''),
      escapeCsv(c.principal_amount || 0),
      escapeCsv(c.interest_amount || 0),
      escapeCsv(c.expenses_amount || 0),
      escapeCsv(c.legal_fee_amount || 0),
      escapeCsv(calculateTotalDebt(c)),
      escapeCsv(c.gachlat_status || ''),
      escapeCsv(c.has_property ? 'כן' : 'לא'),
      escapeCsv(c.delivery_confirmation_date || ''),
      escapeCsv(c.execution_target_date || ''),
      escapeCsv(c.extensions_count || 0),
      escapeCsv(c.next_action_type),
      escapeCsv(c.next_action_description),
      escapeCsv(c.next_due_date),
      escapeCsv(c.notes),
    ].join(',')
  );

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}
