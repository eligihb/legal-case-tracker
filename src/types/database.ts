export type CaseCategory = 'גבייה' | 'חדל"פ' | 'חברות' | 'חברה משכנת';

export type CaseDistrict =
  | 'מרכז'
  | 'תל אביב'
  | 'חיפה'
  | 'צפון'
  | 'ירושלים'
  | 'דרום'
  | 'כללי';

export const CASE_DISTRICTS: CaseDistrict[] = [
  'מרכז',
  'תל אביב',
  'חיפה',
  'צפון',
  'ירושלים',
  'דרום',
  'כללי',
];

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
  | 'תגובה'
  | 'תשובה'
  | 'משימת מעקב'
  | 'תזכורת'
  | 'משימת מעקב / תזכורת'
  | 'דו"ח עדכון נאמן'
  | 'בקשה ממתינה'
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
  | 'המלצה לחיסול'
  | 'המשך לפירוק / שיקום'
  | 'שיקום כלכלי'
  | 'פירוק חברה';

export type CompanyDocumentsStage =
  | 'קבלת מסמכים'
  | 'השלמת מסמכים'
  | 'עיון וכתיבת טיוטת דוח';

export const COMPANY_DOCUMENTS_STAGES: CompanyDocumentsStage[] = [
  'קבלת מסמכים',
  'השלמת מסמכים',
  'עיון וכתיבת טיוטת דוח',
];

export type CompanyEntityCheckStatus =
  | 'טרם נשלח'
  | 'נשלח — ממתין למענה'
  | 'התקבל מענה ✓';

export const COMPANY_ENTITY_CHECK_STATUSES: CompanyEntityCheckStatus[] = [
  'טרם נשלח',
  'נשלח — ממתין למענה',
  'התקבל מענה ✓',
];

export interface CompanyEntityChecks {
  company_extract_status: CompanyEntityCheckStatus; // נסח חברה (רשם החברות)
  company_extract_notes?: string;
  financial_entities_status: CompanyEntityCheckStatus; // גופים פיננסיים (בנקים ואשראי)
  financial_entities_notes?: string;
  tax_authority_status: CompanyEntityCheckStatus; // רשות המיסים (מע"מ, מס הכנסה, מיסוי מקרקעין)
  tax_authority_notes?: string;
  insurance_pension_status: CompanyEntityCheckStatus; // ביטוח ופנסיה (הר הביטוח / קופות)
  insurance_pension_notes?: string;
}

export type TaskExecutionState =
  | 'בטיפול'
  | 'בוצע'
  | 'הועבר לאחר'
  | 'תלוי באחר';

export const TASK_EXECUTION_STATES: TaskExecutionState[] = [
  'בטיפול',
  'בוצע',
  'הועבר לאחר',
  'תלוי באחר',
];

export const DEFAULT_ACTION_TAGS: string[] = [
  'התקשרות',
  'מייל',
  'בירור',
  'נסח טאבו',
  'מכתב',
  'הגשה',
  'פגישה/חקירה',
];

export const DEFAULT_CONTACT_CATEGORIES: string[] = [
  'חייבים וצדדים בתיקים',
  'צוות המשרד (תפקידים ושיוך)',
  'עיריות ורשויות מקומיות',
  'משרדי עו"ד חיצוניים ובעלי תפקידים',
  'הממונה על חדל"פ, בתי משפט וגופים נוספים',
];

export interface OfficeContactItem {
  id: string;
  category: string;
  name: string; // שם עובד / מנהל / חייב / עו"ד / איש קשר
  organization?: string; // שם רשות / משרד עו"ד / גוף / חברה
  role_or_title?: string; // תפקיד מדויק (למשל: מנהל מחלקת גבייה / נאמן / מתמחה)
  phone?: string;
  email?: string;
  related_case_id?: string;
  related_case_name?: string;
  notes?: string;
  is_auto_synced?: boolean;
  updated_at: string;
}

export type CondominiumFitStatus =
  | 'תקין ומתאים לרישום'
  | 'דורש תיקון מודד'
  | 'בבדיקה';

export type MilestoneStatus = 'done' | 'in_progress' | 'upcoming';

export type NetHaMishpatStatus =
  | 'ללא מעקב פעיל'
  | 'ממתין להחלטת שופט/רשם'
  | 'הוגשה בקשה בנט המשפט'
  | 'נדרשת תגובת צד שכנגד'
  | 'התקבלה החלטה';

export const NET_HAMISHPAT_STATUSES: NetHaMishpatStatus[] = [
  'ללא מעקב פעיל',
  'ממתין להחלטת שופט/רשם',
  'הוגשה בקשה בנט המשפט',
  'נדרשת תגובת צד שכנגד',
  'התקבלה החלטה',
];

export type CustomFieldType = 'text' | 'date' | 'boolean' | 'reminder';

export type CustomFieldScope = 'case' | 'category' | 'all';

export interface CaseCustomField {
  id: string;
  field_key: string; // מזהה משותף להחלה גורפת על קטגוריה או על כלל התיקים
  label: string; // שם שדה המעקב או התזכורת
  field_type: CustomFieldType; // 'text' = טקסט, 'date' = תאריך, 'boolean' = כן/לא, 'reminder' = תזכורת עם מועד
  value: string | boolean; // ערך השדה
  due_date?: string | null; // YYYY-MM-DD עבור תזכורת עם מועד או שדה תאריך
  is_done?: boolean; // האם התזכורת בוצעה
  scope: CustomFieldScope; // 'case' | 'category' | 'all'
  category?: CaseCategory | null;
  updated_by?: string;
  updated_at?: string;
}

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
  assignee?: string; // אחראי לביצוע (למשל: אליאב, רון, מזכירות, מתמחה)
  is_manager_instruction?: boolean; // הוראת מנהל / רון עם סימון בולט
  execution_state?: TaskExecutionState; // 'בטיפול' | 'בוצע' | 'הועבר לאחר' | 'תלוי באחר'
  action_tag?: string; // תגית פעולה גמישה ('התקשרות' | 'מייל' | 'בירור' | 'נסח טאבו' | 'מכתב' וכו')
  follow_up_title?: string; // משימת המשך משורשרת שנפתחת אוטומטית עם השלמת המשימה הנוכחית
  contact_ref?: string; // איש קשר משויך מהאלפון המשרדי
  updated_by?: string;
}

export type HearingLiveStatus = 'מתקיים' | 'נדחה' | 'בוטל';

export const HEARING_LIVE_STATUSES: HearingLiveStatus[] = [
  'מתקיים',
  'נדחה',
  'בוטל',
];

export interface HearingPostponementRecord {
  id: string;
  previous_date: string; // YYYY-MM-DD
  new_date: string; // YYYY-MM-DD
  reason: string;
  recorded_at: string; // ISO string
  recorded_by?: string;
}

export interface CompanyHearingItem {
  id: string;
  title: string; // נושא הדיון
  hearing_date: string; // YYYY-MM-DD
  status: HearingLiveStatus; // 'מתקיים' | 'נדחה' | 'בוטל'
  judge_or_court?: string; // מותב / שופט / בית משפט
  assignee?: string; // אחראי לביצוע / מייצג בדיון
  notes?: string;
  postponements_count: number;
  postponement_history: HearingPostponementRecord[];
}

export type CompanyDocumentType = 'דוח נאמן' | 'בקשה' | 'תגובה';

export const COMPANY_DOCUMENT_TYPES: CompanyDocumentType[] = [
  'דוח נאמן',
  'בקשה',
  'תגובה',
];

export interface SubmissionExtensionRecord {
  id: string;
  requested_at: string; // YYYY-MM-DD
  days_requested: number; // לכמה ימים התבקשה הארכה
  days_approved: number; // כמה ימי ארכה ניתנו בפועל
  reason?: string;
}

export interface CompanySubmissionItem {
  id: string;
  document_type: CompanyDocumentType; // 'דוח נאמן' | 'בקשה' | 'תגובה'
  title: string; // נושא ההגשה / הכותרת
  related_decision_ref: string; // ביחס לאיזו החלטה (למשל: החלטת כב' השופט X)
  related_decision_date?: string | null; // ממתי ההחלטה (YYYY-MM-DD)
  response_to_request?: string; // תגובה לאיזו בקשה (למשל: בקשה מס' 12 של הנושה)
  short_description?: string; // תיאור קצר של ההגשה/התגובה
  original_due_date: string; // תאריך יעד מקורי (YYYY-MM-DD)
  due_date: string; // תאריך יעד נוכחי לאחר ארכות (YYYY-MM-DD)
  submitted_at?: string | null; // תאריך הגשה בפועל (YYYY-MM-DD)
  is_submitted: boolean; // האם הוגש בפועל
  extensions_count: number; // כמה בקשות ארכה התבקשו
  total_extension_days: number; // סך הכול כמה ימי ארכה ניתנו
  extension_requests: SubmissionExtensionRecord[]; // פירוט בקשות הארכה
  late_warning_decisions_count: number; // מונה החלטות התראה על אי-הגשה במועד
  estimated_writing_time: string; // הערכת זמן נדרש לכתיבה (בשעות/ימים)
  assignee: string; // אחראי לביצוע (אליאב, רון, מזכירות, מתמחה וכו')
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
  subject?: string; // תאימות לאחור לתיקים ישנים
  stage_note?: string; // הערת שלב דינמית קצרה עבור השלב הפעיל הנוכחי
  fee_notes?: string; // הערות כספיות / שכ"ט לעיון מהיר (ללא חישובים)
  id_or_hp: string;
  case_number: string;
  gush_helka?: string; // גוש / חלקה / תת-חלקה (להעתקה מהירה וזיהוי נכס)
  category: CaseCategory;
  district?: CaseDistrict; // מחוז (מרכז, תל אביב, חיפה, צפון, ירושלים, דרום, כללי)
  current_stage?: string;
  municipality?: string | null;
  tags: CaseTag[];
  status: CaseStatus;
  net_hamishpat_status?: NetHaMishpatStatus; // מעקב נט המשפט והחלטות ממתינות
  notes: string;
  next_action_type: NextActionType;
  next_action_description: string;
  next_due_date?: string | null; // YYYY-MM-DD
  assigned_to?: string; // אחראי לביצוע בתיק / לפעולה הבאה
  extensions_count?: number; // מונה ארכות / דחיות
  total_extension_days?: number; // סה"כ ימי ארכה שניתנו בתיק
  late_warning_decisions_count?: number; // מונה החלטות התראה על אי-הגשה במועד
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
  // 3. שדות ייעודיים לתיקי חברות (נאמן / מפרק / כינוס / שיקום):
  // =========================================================================
  appointment_date?: string | null; // YYYY-MM-DD מועד קבלת המינוי מהמזכירות
  guarantee_bond_due_date?: string | null; // YYYY-MM-DD יעד הגשת כתב ערובה (14 יום אוטומטית ממועד המינוי)
  self_undertaking_deposited?: boolean; // הפקדת התחייבות עצמית / כתב ערובה (100,000 ₪) (הופקדה/טרם)
  self_undertaking_date?: string | null; // YYYY-MM-DD
  company_entity_checks?: CompanyEntityChecks; // בדיקות מול גופים: נסח חברה, גופים פיננסיים, רשות המיסים, ביטוח ופנסיה
  company_documents_stage?: CompanyDocumentsStage; // סטטוס מסמכים: קבלת מסמכים / השלמת מסמכים / עיון וכתיבת טיוטת דוח
  insurance_and_assets_letters_status?: string; // מכתבים לחברות ביטוח ואיתור נכסים
  representative_contact_details?: string; // פנייה למייצג החברה
  investigating_trustee_name?: string; // שם הנאמן החוקר
  investigation_scheduled_date?: string | null; // YYYY-MM-DD מועד חקירה מתואם
  required_documents_checklist?: string; // סט מסמכים נדרש לחקירה
  investigation_outcome?: InvestigationOutcome; // תוצאות חקירה (אם לא הגיע -> בקשת צו הבאה; חסרים מסמכים -> השלמות)
  missing_documents_details?: string; // פירוט השלמות מסמכים חסרים
  trustee_findings_summary?: string; // תקציר דו"ח נאמן ועדכון ממצאים
  company_resolution_decision?: CompanyResolutionDecision; // צומת הכרעה: המלצה לחיסול מול המשך לפירוק / שיקום
  company_hearings?: CompanyHearingItem[]; // ענף דיונים בתיק חברות (מתקיים / נדחה / בוטל + היסטוריית דחיות)
  company_submissions?: CompanySubmissionItem[]; // ענף הגשות, תגובות ודוחות נאמן (ייחוס להחלטה, ארכות, איחורים והערכת זמן כתיבה)

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

  // 5. שדות מעקב ותזכורות מותאמים אישית (עם תמיכה בהחלה גורפת ועריכה מהירה Inline)
  custom_fields?: CaseCustomField[];
  stage_data?: Record<string, unknown>; // נתוני שלבים גמישים (JSONB)

  // 6. ארכיון חכם (הושלם / ארכיון) + מעקב שכ"ט וזמן היערכות
  is_archived?: boolean;
  archived_at?: string | null;
  legal_fee_paid?: boolean; // האם שכר הטרחה שולם
  legal_fee_paid_amount?: number; // סכום שכ"ט ששולם בפועל
  prep_days_needed?: number; // ימי היערכות נדרשים להגשה/תגובה

  last_modified_by?: string;
  updated_at: string; // ISO string
}

export interface WorkerPermissionsConfig {
  allowCustomFields: boolean; // הוספת שדות מותאמים
  allowEditStages: boolean; // עריכת שלבי תיק
  allowEditFeesAndDebt: boolean; // עריכת סכומי חוב ושכ"ט
  allowDeleteAndArchive: boolean; // מחיקת/ארכוב תיקים
  allowExportAndBackup: boolean; // ייצוא וגיבוי נתונים
}

export interface FullSystemBackup {
  version: string;
  exported_at: string;
  cases: CaseItem[];
  logs: CaseLog[];
  municipalities_settings: MunicipalitySetting[];
  system_users?: SystemUserAccount[];
}

export interface CaseLog {
  id: string;
  case_id: string;
  log_date: string; // ISO string
  log_type: LogType;
  content: string;
  due_date?: string | null; // YYYY-MM-DD
  is_manager_instruction?: boolean; // הוראת מנהל / רון עם סימון בולט
  execution_state?: TaskExecutionState; // 'בטיפול' | 'בוצע' | 'הועבר לאחר' | 'תלוי באחר'
  action_tag?: string; // תגית פעולה ('התקשרות', 'מייל', 'בירור', 'נסח טאבו', 'מכתב' וכו')
  contact_ref?: string; // איש קשר מהאלפון המשרדי
  assignee?: string; // אחראי לביצוע
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
    title: 'תיקי חברות (פירוק, כינוס, שיקום)',
    shortTitle: 'תיקי חברות (פירוק / כינוס / שיקום)',
    subtitle: 'ענף דיונים והגשות קרובות, מונה ארכות וימי ארכה, ייחוס להחלטות, בקרת איחורים, התחייבות עצמית וחקירות',
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
  'תגובה',
  'תשובה',
  'משימת מעקב',
  'תזכורת',
  'משימת מעקב / תזכורת',
  'דו"ח עדכון נאמן',
  'בקשה ממתינה',
  'פתיחת תביעה בהוצל"פ',
  'רישום משכון',
  'מעקב הסדר',
  'שחרור עיקולים וסגירה',
  'חוות דעת למחיקת חוב',
  'תביעת חוב',
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
  'המלצה לחיסול',
  'המשך לפירוק / שיקום',
  'שיקום כלכלי',
  'פירוק חברה',
];

export const CONDOMINIUM_FIT_STATUSES: CondominiumFitStatus[] = [
  'תקין ומתאים לרישום',
  'דורש תיקון מודד',
  'בבדיקה',
];
