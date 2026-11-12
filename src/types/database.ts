export type CaseCategory = 'גבייה' | 'חדל"פ' | 'חברות' | 'חברה משכנת';

export type CaseTag =
  | 'חברה משכנת'
  | 'עיזבון'
  | 'בהסדר'
  | 'מנהל מיוחד/מפרק'
  | 'ייצוג נושה'
  | 'נושה מהותי'
  | 'משכון רשום'
  | 'עיקולים פעילים'
  | 'מחיקת חוב'
  | 'דיון נדחה'
  | 'צו הבאה'
  | 'תצ"ר חניות';

export type CaseStatus =
  | 'פעיל'
  | 'לפני תביעה'
  | 'בהוצל"פ'
  | 'בהסדר'
  | 'בהסדר תשלומים'
  | 'ממתין להחלטה'
  | 'הגשה ממתינה לביהמ"ש'
  | 'דיון קבוע'
  | 'דיון נדחה'
  | 'סיום הסדר / סילוק חוב'
  | 'מחיקת חוב ישן'
  | 'סגור';

export type NextActionType =
  | 'דיון'
  | 'דיון שנדחה'
  | 'הגשה לביהמ"ש'
  | 'דו"ח עדכון נאמן'
  | 'בקשה ממתינה'
  | 'תגובה'
  | 'תשובה'
  | 'תביעת חוב'
  | 'בקשת צו הבאה'
  | 'השלמת מסמכים'
  | 'מעקב הסדר'
  | 'פתיחת תביעה בהוצל"פ'
  | 'רישום משכון'
  | 'שחרור עיקולים וסגירה'
  | 'חוות דעת למחיקת חוב'
  | 'בדיקת תצ"ר / מודד'
  | 'העברת זכויות והנפקת אישור'
  | 'בקשת חיסול'
  | 'אחר';

export type LogType =
  | 'תרשומת שיחה'
  | 'הערה'
  | 'תזכורת אישית/מועד'
  | 'החלטת ביהמ"ש'
  | 'בקשת ארכה / דחיית דיון'
  | 'פעולה שבוצעה'
  | 'פעולה נדרשת'
  | 'דיווח הפחתה';

export type TaskUrgency = 'דחוף מאוד' | 'גבוהה' | 'רגילה' | 'נמוכה';

export type FeeCalculationMethod = 'אחוזים' | 'סכום קבוע' | 'מדרגות הוצל"פ';

export type GachlatStatus = 'התקבל ואומת' | 'חסר גח"לת' | 'נדרש בירור';

export type WriteoffClassification =
  | 'התיישנות'
  | 'חוסר כדאיות כלכלית'
  | 'היעדר נכסים/איתור'
  | 'חדל"פ/פטור'
  | 'אחר';

export type InsolvencyDebtorType = 'חייב יחיד' | 'חברה בפירוק';

export type InvestigationOutcome =
  | 'טרם נחקר'
  | 'התייצב ונחקר'
  | 'לא התייצב לחקירה'
  | 'חסרים מסמכים';

export type CompanyResolutionDecision =
  | 'טרם הוכרע'
  | 'שיקום כלכלי'
  | 'פירוק חברה';

export type CondominiumFitStatus =
  | 'תקין ומתאים לרישום'
  | 'דורש תיקון מודד'
  | 'בבדיקה';

export type MilestoneStatus = 'done' | 'in_progress' | 'upcoming';

export interface CaseMilestone {
  id: string;
  title: string;
  status: MilestoneStatus; // 'done' = מה נעשה ✓, 'in_progress' = בתהליך כעת ⏳, 'upcoming' = יבוצע בהמשך ➔
  urgency?: TaskUrgency; // דחיפות המשימה
  planned_days?: number; // משך ביצוע מתוכנן בימים
  started_at?: string | null; // YYYY-MM-DD
  completed_at?: string | null; // YYYY-MM-DD
  days_spent?: number; // מדידה אוטומטית של כמה ימים לקח עד לסגירה
  due_date?: string | null; // YYYY-MM-DD
  updated_by?: string;
}

export interface MonthlyReductionEntry {
  id: string;
  month_year: string; // למשל '11/2026'
  report_received: boolean; // האם התקבל דיווח תשלומים מהרשות
  reported_amount: number; // סכום התשלום שדווח בש"ח
  reduced_in_execution: boolean; // האם בוצעה הפחתה בתיק ההוצל"פ
  reduction_date?: string | null; // YYYY-MM-DD תאריך ביצוע ההפחתה
  performed_by?: string; // שם המבצע
  notes?: string;
}

export interface MunicipalitySetting {
  id: string;
  municipality_name: string;
  fee_calculation_method: FeeCalculationMethod;
  fee_rate_value: number; // אחוז (למשל 15) או סכום קבוע בש"ח
  fee_tariff_description: string;
  interest_and_expenses_rules: string;
  standing_instructions: string;
  contact_person?: string;
  updated_by?: string;
  updated_at: string;
}

export interface SystemUserAccount {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  password: string;
  title?: string;
  active: boolean;
  updated_at: string;
}

export interface UserSession {
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  loggedInAt: string;
}

export interface CaseItem {
  id: string;
  debtor_name: string;
  id_or_hp: string;
  case_number: string;
  gush_helka?: string; // גוש / חלקה / תת-חלקה (להעתקה מהירה וזיהוי נכס)
  category: CaseCategory;
  current_stage?: string;
  municipality?: string | null;
  tags: CaseTag[];
  status: CaseStatus;
  notes: string;
  next_action_type: NextActionType;
  next_action_description: string;
  next_due_date?: string | null; // YYYY-MM-DD
  extensions_count?: number; // מונה ארכות / דחיות
  is_hearing_postponed?: boolean; // האם הדיון נדחה (מסומן ב-'נדחה')
  postponed_reason?: string; // סיבת דחיית דיון / ארכה אחרונה
  trustee_report_due_date?: string | null; // YYYY-MM-DD מועד עדכון דו"ח נאמן

  // =========================================================================
  // 1. שדות ייעודיים לתיקי רשויות (גבייה והוצל"פ):
  // =========================================================================
  debt_years?: string; // למשל '2020-2024'
  principal_amount?: number;
  interest_amount?: number;
  expenses_amount?: number;
  legal_fee_amount?: number;

  gachlat_status?: GachlatStatus;
  has_property?: boolean;
  property_details?: string;
  warning_letter_sent_date?: string | null; // YYYY-MM-DD
  delivery_confirmation_date?: string | null; // YYYY-MM-DD
  execution_target_date?: string | null; // YYYY-MM-DD (אישור מסירה + 30 ימים)

  execution_proceedings_notes?: string;
  monthly_reductions?: MonthlyReductionEntry[];
  milestones?: CaseMilestone[];

  is_old_debt_writeoff?: boolean;
  writeoff_classification?: WriteoffClassification | null;
  legal_opinion_summary?: string;

  // =========================================================================
  // 2. שדות ייעודיים לתיקי חדל"פ (ייצוג נושה / פירוק):
  // =========================================================================
  is_material_creditor?: boolean; // נושה מהותי בתיק (כן/לא)
  insolvency_debtor_type?: InsolvencyDebtorType; // חייב יחיד מול חברה בפירוק
  trustee_name_and_contact?: string; // פרטי נאמן / מפרק
  debt_claim_deadline?: string | null; // YYYY-MM-DD מועד אחרון להגשת תביעת חוב
  debt_claim_submitted?: boolean; // האם הוגשה תביעת חוב
  debt_claim_amount?: number; // סכום תביעת החוב בש"ח
  creditor_responses_notes?: string; // מעקב תגובות נושה (מודגש בתיק מהותי)
  new_debts_tracking?: string; // מעקב חובות חדשים (בדיקה מול נאמן / בקשה לביטול הליכים)

  // =========================================================================
  // 3. שדות ייעודיים לתיקי חברות (נאמן / מפרק):
  // =========================================================================
  self_undertaking_deposited?: boolean; // הפקדת התחייבות עצמית (100,000 ₪) (הופקדה/טרם)
  self_undertaking_date?: string | null; // YYYY-MM-DD
  insurance_and_assets_letters_status?: string; // מכתבים לחברות ביטוח ואיתור נכסים
  representative_contact_details?: string; // פנייה למייצג החברה
  investigating_trustee_name?: string; // שם הנאמן החוקר
  investigation_scheduled_date?: string | null; // YYYY-MM-DD מועד חקירה מתואם
  required_documents_checklist?: string; // סט מסמכים נדרש לחקירה
  investigation_outcome?: InvestigationOutcome; // תוצאות חקירה (אם לא הגיע -> בקשת צו הבאה; חסרים מסמכים -> השלמות)
  missing_documents_details?: string; // פירוט השלמות מסמכים חסרים
  trustee_findings_summary?: string; // תקציר דו"ח נאמן ועדכון ממצאים
  company_resolution_decision?: CompanyResolutionDecision; // הכרעה: שיקום או פירוק

  // =========================================================================
  // 4. שדות ייעודיים לפרויקטים של "חברה משכנת" (רישום וזכויות):
  // =========================================================================
  housing_project_name?: string; // שם הפרויקט / מתחם
  liquidators_sale_approval?: boolean; // אישור מפרקים למכירת זכויות
  physical_files_location?: string; // ניהול תיקים פיזיים (מיקום ארכיב / מדף / קלסר)
  rights_certificate_issued?: boolean; // הנפקת אישור זכויות
  surveyor_name?: string; // שם המודד המטפל
  tazar_status?: string; // מעקב מול מודד על תצ"רים
  parking_tazar_handled?: boolean; // סימון/טיפול בתצ"ר חניות
  parking_tazar_notes?: string; // הערות תצ"ר חניות
  condominium_registration_fit?: CondominiumFitStatus; // בדיקת התאמת התצ"ר לרישום בית משותף (תקין / דורש תיקון)
  invoices_court_control?: string; // בקרת חשבוניות מול אישור ביהמ"ש, ההסכם, צורת התשלום והמועדים
  seller_buyer_names?: string; // העברת זכויות: שם מוכר -> שם קונה חדש
  transfer_signing_docs_complete?: boolean; // בדיקת סט מסמכי חתימה מלא
  transfer_liquidator_approved?: boolean; // אישור המפרק להעברת הזכויות
  transfer_process_stage?: string; // שלב בחינה וביצוע העברת זכויות
  new_buyer_certificate_issued?: boolean; // הפקת אישור זכויות על שם הקונה החדש

  last_modified_by?: string;
  updated_at: string; // ISO string
}

export interface CaseLog {
  id: string;
  case_id: string;
  log_date: string; // ISO string
  log_type: LogType;
  content: string;
  due_date?: string | null; // YYYY-MM-DD
  created_by?: string;
}

export const CASE_CATEGORIES: CaseCategory[] = [
  'גבייה',
  'חדל"פ',
  'חברות',
  'חברה משכנת',
];

export const CATEGORY_LABELS: Record<
  CaseCategory,
  {
    number: number;
    title: string;
    shortTitle: string;
    subtitle: string;
    themeColor: 'blue' | 'purple' | 'emerald' | 'amber';
  }
> = {
  'גבייה': {
    number: 1,
    title: 'תיקי רשויות (גבייה והוצל"פ)',
    shortTitle: 'תיקי רשויות (גבייה והוצל"פ)',
    subtitle: 'לפני תביעה, גח"לת, משכון, אישור מסירה + 30 יום, יומן הפחתות ומחיקת חובות',
    themeColor: 'blue',
  },
  'חדל"פ': {
    number: 2,
    title: 'תיקי חדל"פ (ייצוג נושה / פירוק)',
    shortTitle: 'תיקי חדל"פ (ייצוג נושה)',
    subtitle: 'נושה מהותי, חייב יחיד מול חברה בפירוק, תביעות חוב, תגובות נושה וחובות חדשים',
    themeColor: 'purple',
  },
  'חברות': {
    number: 3,
    title: 'תיקי חברות (נאמן / מפרק)',
    shortTitle: 'תיקי חברות (נאמן / מפרק)',
    subtitle: 'התחייבות עצמית 100,000 ₪, איתור נכסים, חקירות וצו הבאה, דו"ח נאמן ושיקום/פירוק',
    themeColor: 'emerald',
  },
  'חברה משכנת': {
    number: 4,
    title: 'חברה משכנת (רישום וזכויות)',
    shortTitle: 'חברה משכנת (רישום וזכויות)',
    subtitle: 'אישור מפרקים, תצ"רים ותצ"ר חניות, בית משותף, בקרת חשבוניות והעברת זכויות לקונה',
    themeColor: 'amber',
  },
};

export const CASE_TAGS: CaseTag[] = [
  'חברה משכנת',
  'עיזבון',
  'בהסדר',
  'מנהל מיוחד/מפרק',
  'ייצוג נושה',
  'נושה מהותי',
  'משכון רשום',
  'עיקולים פעילים',
  'מחיקת חוב',
  'דיון נדחה',
  'צו הבאה',
  'תצ"ר חניות',
];

export const CASE_STATUSES: CaseStatus[] = [
  'לפני תביעה',
  'בהוצל"פ',
  'פעיל',
  'דיון קבוע',
  'דיון נדחה',
  'הגשה ממתינה לביהמ"ש',
  'ממתין להחלטה',
  'בהסדר תשלומים',
  'בהסדר',
  'סיום הסדר / סילוק חוב',
  'מחיקת חוב ישן',
  'סגור',
];

export const NEXT_ACTION_TYPES: NextActionType[] = [
  'דיון',
  'דיון שנדחה',
  'הגשה לביהמ"ש',
  'דו"ח עדכון נאמן',
  'בקשה ממתינה',
  'פתיחת תביעה בהוצל"פ',
  'רישום משכון',
  'מעקב הסדר',
  'שחרור עיקולים וסגירה',
  'חוות דעת למחיקת חוב',
  'תביעת חוב',
  'תגובה',
  'תשובה',
  'בקשת צו הבאה',
  'השלמת מסמכים',
  'בדיקת תצ"ר / מודד',
  'העברת זכויות והנפקת אישור',
  'בקשת חיסול',
  'אחר',
];

export const LOG_TYPES: LogType[] = [
  'תרשומת שיחה',
  'הערה',
  'תזכורת אישית/מועד',
  'החלטת ביהמ"ש',
  'בקשת ארכה / דחיית דיון',
  'פעולה שבוצעה',
  'פעולה נדרשת',
  'דיווח הפחתה',
];

export const TASK_URGENCIES: TaskUrgency[] = [
  'דחוף מאוד',
  'גבוהה',
  'רגילה',
  'נמוכה',
];

export const GACHLAT_STATUSES: GachlatStatus[] = [
  'התקבל ואומת',
  'חסר גח"לת',
  'נדרש בירור',
];

export const WRITEOFF_CLASSIFICATIONS: WriteoffClassification[] = [
  'התיישנות',
  'חוסר כדאיות כלכלית',
  'היעדר נכסים/איתור',
  'חדל"פ/פטור',
  'אחר',
];

export const FEE_CALCULATION_METHODS: FeeCalculationMethod[] = [
  'אחוזים',
  'סכום קבוע',
  'מדרגות הוצל"פ',
];

export const INSOLVENCY_DEBTOR_TYPES: InsolvencyDebtorType[] = [
  'חייב יחיד',
  'חברה בפירוק',
];

export const INVESTIGATION_OUTCOMES: InvestigationOutcome[] = [
  'טרם נחקר',
  'התייצב ונחקר',
  'לא התייצב לחקירה',
  'חסרים מסמכים',
];

export const COMPANY_RESOLUTION_DECISIONS: CompanyResolutionDecision[] = [
  'טרם הוכרע',
  'שיקום כלכלי',
  'פירוק חברה',
];

export const CONDOMINIUM_FIT_STATUSES: CondominiumFitStatus[] = [
  'תקין ומתאים לרישום',
  'דורש תיקון מודד',
  'בבדיקה',
];
