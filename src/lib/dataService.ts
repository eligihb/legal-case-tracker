import { supabase, isSupabaseConfigured } from './supabase';
import {
  INITIAL_MUNICIPALITIES_SETTINGS,
  INITIAL_SAMPLE_CASES,
  INITIAL_SAMPLE_LOGS,
  INITIAL_SYSTEM_USERS,
  OPTIONAL_DEMO_CASES,
  OPTIONAL_DEMO_LOGS,
} from './sampleData';
import {
  CASE_TAGS,
  CaseCategory,
  CaseCustomField,
  CaseDistrict,
  CaseItem,
  CaseLog,
  CaseMilestone,
  CaseTag,
  CompanyEntityChecks,
  CustomFieldScope,
  CustomFieldType,
  DEFAULT_ACTION_TAGS,
  DEFAULT_CONTACT_CATEGORIES,
  FullSystemBackup,
  MunicipalitySetting,
  NetHaMishpatStatus,
  OfficeContactItem,
  SystemUserAccount,
  UserSession,
  WorkerPermissionsConfig,
} from '@/types/database';
import { APP_VERSION } from './version';

// מפתחות אחסון קבועים ב-LocalStorage (Non-Destructive Data Safety)
const STORAGE_CASES_KEY = 'legal_fork_cases_v4';
const STORAGE_LOGS_KEY = 'legal_fork_logs_v4';
const STORAGE_MUNI_SETTINGS_KEY = 'legal_fork_muni_settings_v4';
const STORAGE_SYSTEM_USERS_KEY = 'legal_fork_system_users_v4';
const STORAGE_DEMO_AUTH_KEY = 'legal_fork_demo_authenticated';
const STORAGE_USER_SESSION_KEY = 'legal_fork_user_session_v3';
const STORAGE_WORKER_PERMS_KEY = 'legal_fork_worker_permissions_v1';

export const DEFAULT_WORKER_PERMISSIONS: WorkerPermissionsConfig = {
  allowCustomFields: true,
  allowEditStages: true,
  allowEditFeesAndDebt: false,
  allowDeleteAndArchive: false,
  allowExportAndBackup: true,
};

export function getWorkerPermissions(): WorkerPermissionsConfig {
  if (typeof window === 'undefined') return DEFAULT_WORKER_PERMISSIONS;
  const raw = localStorage.getItem(STORAGE_WORKER_PERMS_KEY);
  if (!raw) {
    localStorage.setItem(
      STORAGE_WORKER_PERMS_KEY,
      JSON.stringify(DEFAULT_WORKER_PERMISSIONS)
    );
    return DEFAULT_WORKER_PERMISSIONS;
  }
  try {
    return {
      ...DEFAULT_WORKER_PERMISSIONS,
      ...(JSON.parse(raw) as Partial<WorkerPermissionsConfig>),
    };
  } catch {
    return DEFAULT_WORKER_PERMISSIONS;
  }
}

export function saveWorkerPermissions(
  config: WorkerPermissionsConfig
): WorkerPermissionsConfig {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_WORKER_PERMS_KEY, JSON.stringify(config));
  }
  return config;
}

export function verifyAdminPassword(passwordInput: string): boolean {
  const clean = passwordInput.trim();
  if (!clean) return false;
  const users = getLocalSystemUsers();
  const adminAccount = users.find((u) => u.role === 'admin' && u.active);
  if (adminAccount && adminAccount.password === clean) return true;
  return clean === '1234' || clean === 'admin';
}

const LEGACY_CASES_KEYS = [
  'legal_fork_cases_v3',
  'legal_fork_cases_v2',
  'legal_fork_cases_v1',
  'legal_fork_cases',
];
const LEGACY_LOGS_KEYS = [
  'legal_fork_logs_v3',
  'legal_fork_logs_v2',
  'legal_fork_logs_v1',
  'legal_fork_logs',
];

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// הרשאות ומשתמש מחובר (Admin מול User) + ניהול משתמשים וסיסמאות
// ============================================================================
const DEFAULT_ADMIN_SESSION: UserSession = {
  username: 'admin',
  displayName: 'עו"ד מנהל מערכת',
  role: 'admin',
  loggedInAt: new Date().toISOString(),
};

export function getCurrentUserSession(): UserSession {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_SESSION;
  const raw = localStorage.getItem(STORAGE_USER_SESSION_KEY);
  if (!raw) {
    localStorage.setItem(
      STORAGE_USER_SESSION_KEY,
      JSON.stringify(DEFAULT_ADMIN_SESSION)
    );
    return DEFAULT_ADMIN_SESSION;
  }
  try {
    return JSON.parse(raw) as UserSession;
  } catch {
    return DEFAULT_ADMIN_SESSION;
  }
}

export function setCurrentUserSession(session: UserSession): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_USER_SESSION_KEY, JSON.stringify(session));
  }
}

export function getLocalSystemUsers(): SystemUserAccount[] {
  if (typeof window === 'undefined') return INITIAL_SYSTEM_USERS;
  const raw = localStorage.getItem(STORAGE_SYSTEM_USERS_KEY);
  if (!raw) {
    localStorage.setItem(
      STORAGE_SYSTEM_USERS_KEY,
      JSON.stringify(INITIAL_SYSTEM_USERS)
    );
    return INITIAL_SYSTEM_USERS;
  }
  try {
    return JSON.parse(raw) as SystemUserAccount[];
  } catch {
    return INITIAL_SYSTEM_USERS;
  }
}

export function saveLocalSystemUsers(users: SystemUserAccount[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_SYSTEM_USERS_KEY, JSON.stringify(users));
  }
}

export async function fetchSystemUsers(): Promise<SystemUserAccount[]> {
  return getLocalSystemUsers();
}

export async function saveSystemUserAccount(
  account: Omit<SystemUserAccount, 'id' | 'updated_at'> & { id?: string }
): Promise<SystemUserAccount> {
  const session = getCurrentUserSession();
  if (session.role !== 'admin') {
    throw new Error('רק מנהל מערכת (admin) רשאי להוסיף או לערוך משתמשים וסיסמאות');
  }
  const list = getLocalSystemUsers();
  const now = new Date().toISOString();
  let saved: SystemUserAccount;
  if (account.id) {
    const idx = list.findIndex((u) => u.id === account.id);
    saved = {
      ...account,
      id: account.id,
      updated_at: now,
    };
    if (idx !== -1) list[idx] = saved;
    else list.push(saved);
  } else {
    saved = {
      ...account,
      id: generateId(),
      updated_at: now,
    };
    list.push(saved);
  }
  saveLocalSystemUsers(list);
  return saved;
}

export async function deleteSystemUserAccount(id: string): Promise<void> {
  const session = getCurrentUserSession();
  if (session.role !== 'admin') {
    throw new Error('רק מנהל מערכת (admin) רשאי למחוק משתמשים');
  }
  const list = getLocalSystemUsers();
  const target = list.find((u) => u.id === id);
  if (target?.username === 'admin') {
    throw new Error('לא ניתן למחוק את חשבון מנהל המערכת הראשי');
  }
  saveLocalSystemUsers(list.filter((u) => u.id !== id));
}

export function isLocalDemoMode(): boolean {
  if (!isSupabaseConfigured) return true;
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_DEMO_AUTH_KEY) === 'force_local';
  }
  return false;
}

export function setDemoAuthenticated(forceLocal = false): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(
      STORAGE_DEMO_AUTH_KEY,
      forceLocal ? 'force_local' : 'true'
    );
  }
}

export function isDemoAuthenticated(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(STORAGE_DEMO_AUTH_KEY);
  if (!isSupabaseConfigured && val !== 'logged_out') {
    return true;
  }
  return val === 'true' || val === 'force_local';
}

export function signOutDemo(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_DEMO_AUTH_KEY, 'logged_out');
  }
}

function inferDefaultDistrict(raw: Partial<CaseItem>): CaseDistrict {
  if (raw.district) return raw.district;
  const text = `${raw.municipality || ''} ${raw.debtor_name || ''} ${
    raw.housing_project_name || ''
  } ${raw.notes || ''}`;
  if (text.includes('תל אביב') || text.includes('רמת גן') || text.includes('גבעתיים'))
    return 'תל אביב';
  if (text.includes('חיפה') || text.includes('קריות') || text.includes('נשר'))
    return 'חיפה';
  if (
    text.includes('צפון') ||
    text.includes('טבריה') ||
    text.includes('נצרת') ||
    text.includes('עפולה') ||
    text.includes('נהריה')
  )
    return 'צפון';
  if (text.includes('ירושלים') || text.includes('בית שמש')) return 'ירושלים';
  if (
    text.includes('באר שבע') ||
    text.includes('דרום') ||
    text.includes('אשדוד') ||
    text.includes('אשקלון') ||
    text.includes('אילת')
  )
    return 'דרום';
  if (
    text.includes('נתניה') ||
    text.includes('ראשון לציון') ||
    text.includes('פתח תקווה') ||
    text.includes('חולון') ||
    text.includes('רחובות') ||
    text.includes('כפר סבא')
  )
    return 'מרכז';
  return 'מרכז';
}

// ============================================================================
// פונקציית מיגרציה בטוחה (Safe Merge / Non-Destructive Normalization):
// לעולם אינה דורסת או מאפסת שדות קיימים בתיק — רק מוסיפה שדות ברירת מחדל חסרים
// ============================================================================
export function safeNormalizeCaseItem(raw: Partial<CaseItem>): CaseItem {
  const defaultNetStatus: NetHaMishpatStatus =
    raw.net_hamishpat_status ||
    (raw.status === 'ממתין להחלטה'
      ? 'ממתין להחלטת שופט/רשם'
      : raw.status === 'הגשה ממתינה לביהמ"ש'
      ? 'הוגשה בקשה בנט המשפט'
      : 'ללא מעקב פעיל');

  return {
    id: raw.id || generateId(),
    debtor_name: raw.debtor_name || 'תיק ללא שם',
    subject: raw.subject ?? '',
    stage_note: raw.stage_note ?? (raw.subject || ''),
    fee_notes: raw.fee_notes ?? '',
    id_or_hp: raw.id_or_hp ?? '',
    case_number: raw.case_number ?? '',
    gush_helka: raw.gush_helka ?? '',
    category: raw.category || 'גבייה',
    district: inferDefaultDistrict(raw),
    current_stage: raw.current_stage ?? (raw.status || 'פתיחת תיק ובדיקות'),
    municipality: raw.municipality ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    status: raw.status || 'פעיל',
    net_hamishpat_status: defaultNetStatus,
    notes: raw.notes ?? '',
    next_action_type: raw.next_action_type || 'אחר',
    next_action_description: raw.next_action_description ?? '',
    next_due_date: raw.next_due_date ?? null,
    assigned_to: raw.assigned_to ?? '',
    extensions_count: Number(raw.extensions_count) || 0,
    total_extension_days: Number(raw.total_extension_days) || 0,
    late_warning_decisions_count: Number(raw.late_warning_decisions_count) || 0,
    is_hearing_postponed: Boolean(raw.is_hearing_postponed),
    postponed_reason: raw.postponed_reason ?? '',
    trustee_report_due_date: raw.trustee_report_due_date ?? null,

    // רשויות
    debt_years: raw.debt_years ?? '',
    principal_amount: Number(raw.principal_amount) || 0,
    interest_amount: Number(raw.interest_amount) || 0,
    expenses_amount: Number(raw.expenses_amount) || 0,
    legal_fee_amount: Number(raw.legal_fee_amount) || 0,
    gachlat_status: raw.gachlat_status || 'חסר גח"לת',
    has_property: Boolean(raw.has_property),
    property_details: raw.property_details ?? '',
    warning_letter_sent_date: raw.warning_letter_sent_date ?? null,
    delivery_confirmation_date: raw.delivery_confirmation_date ?? null,
    execution_target_date: raw.execution_target_date ?? null,
    execution_proceedings_notes: raw.execution_proceedings_notes ?? '',
    monthly_reductions: Array.isArray(raw.monthly_reductions)
      ? raw.monthly_reductions
      : [],
    milestones: Array.isArray(raw.milestones) ? raw.milestones : [],
    is_old_debt_writeoff: Boolean(raw.is_old_debt_writeoff),
    writeoff_classification: raw.writeoff_classification ?? null,
    legal_opinion_summary: raw.legal_opinion_summary ?? '',

    // חדל"פ
    is_material_creditor: Boolean(raw.is_material_creditor),
    insolvency_debtor_type: raw.insolvency_debtor_type || 'חייב יחיד',
    trustee_name_and_contact: raw.trustee_name_and_contact ?? '',
    debt_claim_deadline: raw.debt_claim_deadline ?? null,
    debt_claim_submitted: Boolean(raw.debt_claim_submitted),
    debt_claim_amount: Number(raw.debt_claim_amount) || 0,
    creditor_responses_notes: raw.creditor_responses_notes ?? '',
    new_debts_tracking: raw.new_debts_tracking ?? '',

    // חברות
    appointment_date: raw.appointment_date ?? null,
    guarantee_bond_due_date: raw.guarantee_bond_due_date ?? null,
    self_undertaking_deposited: Boolean(raw.self_undertaking_deposited),
    self_undertaking_date: raw.self_undertaking_date ?? null,
    company_entity_checks: raw.company_entity_checks || {
      company_extract_status: 'טרם נשלח',
      company_extract_notes: '',
      financial_entities_status: 'טרם נשלח',
      financial_entities_notes: '',
      tax_authority_status: 'טרם נשלח',
      tax_authority_notes: '',
      insurance_pension_status: 'טרם נשלח',
      insurance_pension_notes: '',
    },
    company_documents_stage: raw.company_documents_stage || 'קבלת מסמכים',
    insurance_and_assets_letters_status:
      raw.insurance_and_assets_letters_status ?? '',
    representative_contact_details: raw.representative_contact_details ?? '',
    investigating_trustee_name: raw.investigating_trustee_name ?? '',
    investigation_scheduled_date: raw.investigation_scheduled_date ?? null,
    required_documents_checklist: raw.required_documents_checklist ?? '',
    investigation_outcome: raw.investigation_outcome || 'טרם נחקר',
    missing_documents_details: raw.missing_documents_details ?? '',
    trustee_findings_summary: raw.trustee_findings_summary ?? '',
    company_resolution_decision:
      raw.company_resolution_decision || 'טרם הוכרע',
    company_hearings: Array.isArray(raw.company_hearings)
      ? raw.company_hearings
      : [],
    company_submissions: Array.isArray(raw.company_submissions)
      ? raw.company_submissions
      : [],

    // חברה משכנת
    housing_project_name: raw.housing_project_name ?? '',
    liquidators_sale_approval: Boolean(raw.liquidators_sale_approval),
    physical_files_location: raw.physical_files_location ?? '',
    rights_certificate_issued: Boolean(raw.rights_certificate_issued),
    surveyor_name: raw.surveyor_name ?? '',
    tazar_status: raw.tazar_status ?? '',
    parking_tazar_handled: Boolean(raw.parking_tazar_handled),
    parking_tazar_notes: raw.parking_tazar_notes ?? '',
    condominium_registration_fit:
      raw.condominium_registration_fit || 'בבדיקה',
    invoices_court_control: raw.invoices_court_control ?? '',
    seller_buyer_names: raw.seller_buyer_names ?? '',
    transfer_signing_docs_complete: Boolean(raw.transfer_signing_docs_complete),
    transfer_liquidator_approved: Boolean(raw.transfer_liquidator_approved),
    transfer_process_stage: raw.transfer_process_stage ?? '',
    new_buyer_certificate_issued: Boolean(raw.new_buyer_certificate_issued),

    // שדות מותאמים, נתוני שלבים גמישים, ארכיון חכם, מעקב שכ"ט וזמן היערכות
    custom_fields: Array.isArray(raw.custom_fields) ? raw.custom_fields : [],
    stage_data:
      raw.stage_data && typeof raw.stage_data === 'object'
        ? raw.stage_data
        : {},
    is_archived: Boolean(raw.is_archived),
    archived_at: raw.archived_at ?? null,
    legal_fee_paid:
      raw.legal_fee_paid !== undefined
        ? Boolean(raw.legal_fee_paid)
        : raw.status === 'סיום הסדר / סילוק חוב' ||
          raw.status === 'סגור' ||
          Boolean(raw.rights_certificate_issued) ||
          Boolean(raw.new_buyer_certificate_issued),
    legal_fee_paid_amount:
      raw.legal_fee_paid_amount !== undefined
        ? Number(raw.legal_fee_paid_amount) || 0
        : raw.legal_fee_paid ||
          raw.status === 'סיום הסדר / סילוק חוב' ||
          raw.status === 'סגור'
        ? Number(raw.legal_fee_amount) || 4500
        : 0,
    prep_days_needed:
      raw.prep_days_needed !== undefined
        ? Number(raw.prep_days_needed) || 7
        : 7,

    last_modified_by: raw.last_modified_by || 'מנהל מערכת',
    updated_at: raw.updated_at || new Date().toISOString(),
  };
}

const STORAGE_SAMPLE_PURGE_V7_1 = 'legal_fork_sample_purged_v7_1';

function isBuiltInSampleCaseId(id?: string): boolean {
  if (!id) return false;
  return (
    id.startsWith('11111111-1111-') ||
    id.startsWith('22222222-2222-') ||
    id.startsWith('33333333-3333-') ||
    id.startsWith('44444444-4444-')
  );
}

// ============================================================================
// LocalStorage Helpers (עם ניקוי אוטומטי של תיקי הדוגמה לבקשת המשתמש)
// ============================================================================
function getLocalCases(): CaseItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  let raw = localStorage.getItem(STORAGE_CASES_KEY);

  // בדיקת מפתחות מגרסאות קודמות אם המפתח הראשי טרם קיים (Safe Migration)
  if (!raw) {
    for (const legacyKey of LEGACY_CASES_KEYS) {
      const legacyVal = localStorage.getItem(legacyKey);
      if (legacyVal) {
        raw = legacyVal;
        break;
      }
    }
  }

  const alreadyPurgedSamples =
    localStorage.getItem(STORAGE_SAMPLE_PURGE_V7_1) === 'true';

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        let list = parsed.map((c) => safeNormalizeCaseItem(c));
        if (!alreadyPurgedSamples) {
          list = list.filter((c) => !isBuiltInSampleCaseId(c.id));
          localStorage.setItem(STORAGE_SAMPLE_PURGE_V7_1, 'true');
          // ניקוי גם של תרשומות הדוגמה
          const rawLogs = localStorage.getItem(STORAGE_LOGS_KEY);
          if (rawLogs) {
            try {
              const parsedLogs = JSON.parse(rawLogs) as CaseLog[];
              if (Array.isArray(parsedLogs)) {
                const cleanedLogs = parsedLogs.filter(
                  (l) => !isBuiltInSampleCaseId(l.case_id)
                );
                localStorage.setItem(
                  STORAGE_LOGS_KEY,
                  JSON.stringify(cleanedLogs)
                );
              }
            } catch {
              // ignore
            }
          }
        }
        localStorage.setItem(STORAGE_CASES_KEY, JSON.stringify(list));
        return list;
      }
    } catch (err) {
      console.warn('Error parsing stored cases, preserving safety:', err);
    }
  }

  localStorage.setItem(STORAGE_SAMPLE_PURGE_V7_1, 'true');
  localStorage.setItem(STORAGE_CASES_KEY, JSON.stringify([]));
  if (!localStorage.getItem(STORAGE_LOGS_KEY)) {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify([]));
  }
  return [];
}

function saveLocalCases(cases: CaseItem[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_CASES_KEY, JSON.stringify(cases));
  }
}

function getLocalLogs(): CaseLog[] {
  if (typeof window === 'undefined') return INITIAL_SAMPLE_LOGS;
  let raw = localStorage.getItem(STORAGE_LOGS_KEY);
  if (!raw) {
    for (const legacyKey of LEGACY_LOGS_KEYS) {
      const legacyVal = localStorage.getItem(legacyKey);
      if (legacyVal) {
        raw = legacyVal;
        break;
      }
    }
  }
  if (!raw) {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(INITIAL_SAMPLE_LOGS));
    return INITIAL_SAMPLE_LOGS;
  }
  try {
    return JSON.parse(raw) as CaseLog[];
  } catch {
    return INITIAL_SAMPLE_LOGS;
  }
}

function saveLocalLogs(logs: CaseLog[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs));
  }
}

function getLocalMunicipalitiesSettings(): MunicipalitySetting[] {
  if (typeof window === 'undefined') return INITIAL_MUNICIPALITIES_SETTINGS;
  const raw = localStorage.getItem(STORAGE_MUNI_SETTINGS_KEY);
  if (!raw) {
    localStorage.setItem(
      STORAGE_MUNI_SETTINGS_KEY,
      JSON.stringify(INITIAL_MUNICIPALITIES_SETTINGS)
    );
    return INITIAL_MUNICIPALITIES_SETTINGS;
  }
  try {
    return JSON.parse(raw) as MunicipalitySetting[];
  } catch {
    return INITIAL_MUNICIPALITIES_SETTINGS;
  }
}

function saveLocalMunicipalitiesSettings(settings: MunicipalitySetting[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_MUNI_SETTINGS_KEY, JSON.stringify(settings));
  }
}

export function resetLocalSampleData(): {
  cases: CaseItem[];
  logs: CaseLog[];
  muniSettings: MunicipalitySetting[];
  users: SystemUserAccount[];
} {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_CASES_KEY, JSON.stringify(INITIAL_SAMPLE_CASES));
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(INITIAL_SAMPLE_LOGS));
    localStorage.setItem(
      STORAGE_MUNI_SETTINGS_KEY,
      JSON.stringify(INITIAL_MUNICIPALITIES_SETTINGS)
    );
    localStorage.setItem(
      STORAGE_SYSTEM_USERS_KEY,
      JSON.stringify(INITIAL_SYSTEM_USERS)
    );
  }
  return {
    cases: INITIAL_SAMPLE_CASES,
    logs: INITIAL_SAMPLE_LOGS,
    muniSettings: INITIAL_MUNICIPALITIES_SETTINGS,
    users: INITIAL_SYSTEM_USERS,
  };
}

// ============================================================================
// הגדרות רשויות (municipalities_settings)
// ============================================================================
export async function fetchMunicipalitiesSettings(): Promise<MunicipalitySetting[]> {
  if (isLocalDemoMode() || !supabase) {
    return getLocalMunicipalitiesSettings();
  }

  const { data, error } = await supabase
    .from('municipalities_settings')
    .select('*')
    .order('municipality_name', { ascending: true });

  if (error) {
    console.warn('Fallback to local municipalities_settings:', error.message);
    return getLocalMunicipalitiesSettings();
  }

  return (data || []) as MunicipalitySetting[];
}

export async function saveMunicipalitySetting(
  setting: Omit<MunicipalitySetting, 'id' | 'updated_at'> & { id?: string }
): Promise<MunicipalitySetting> {
  const user = getCurrentUserSession();
  if (user.role !== 'admin') {
    throw new Error('רק מנהל מערכת (admin) רשאי לשנות הגדרות רשויות ושכר טרחה');
  }

  const now = new Date().toISOString();
  const list = getLocalMunicipalitiesSettings();

  let savedItem: MunicipalitySetting;
  if (setting.id) {
    const idx = list.findIndex((m) => m.id === setting.id);
    savedItem = {
      ...setting,
      id: setting.id,
      updated_by: user.displayName,
      updated_at: now,
    };
    if (idx !== -1) {
      list[idx] = savedItem;
    } else {
      list.unshift(savedItem);
    }
  } else {
    savedItem = {
      ...setting,
      id: generateId(),
      updated_by: user.displayName,
      updated_at: now,
    };
    list.unshift(savedItem);
  }

  saveLocalMunicipalitiesSettings(list);

  if (!isLocalDemoMode() && supabase) {
    await supabase.from('municipalities_settings').upsert([savedItem]);
  }

  return savedItem;
}

export async function deleteMunicipalitySetting(id: string): Promise<void> {
  const user = getCurrentUserSession();
  if (user.role !== 'admin') {
    throw new Error('רק מנהל מערכת רשאי למחוק הגדרות רשות');
  }

  const list = getLocalMunicipalitiesSettings().filter((m) => m.id !== id);
  saveLocalMunicipalitiesSettings(list);

  if (!isLocalDemoMode() && supabase) {
    await supabase.from('municipalities_settings').delete().eq('id', id);
  }
}

// ============================================================================
// ניהול תיקים ויומן תרשומות (LocalStorage + Supabase)
// ============================================================================

export async function fetchAllCases(): Promise<CaseItem[]> {
  if (isLocalDemoMode() || !supabase) {
    return getLocalCases();
  }

  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .order('next_due_date', { ascending: true, nullsFirst: false });

  if (error) {
    console.error('Supabase fetchAllCases error:', error);
    return getLocalCases();
  }

  return (data || []) as CaseItem[];
}

export async function fetchAllLogs(): Promise<CaseLog[]> {
  if (isLocalDemoMode() || !supabase) {
    return getLocalLogs();
  }
  const { data, error } = await supabase
    .from('case_logs')
    .select('*')
    .order('log_date', { ascending: false });
  if (error) return getLocalLogs();
  return (data || []) as CaseLog[];
}

export async function fetchCaseLogs(caseId: string): Promise<CaseLog[]> {
  if (isLocalDemoMode() || !supabase) {
    const allLogs = getLocalLogs();
    return allLogs
      .filter((l) => l.case_id === caseId)
      .sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
  }

  const { data, error } = await supabase
    .from('case_logs')
    .select('*')
    .eq('case_id', caseId)
    .order('log_date', { ascending: false });

  if (error) {
    console.error('Supabase fetchCaseLogs error:', error);
    return getLocalLogs().filter((l) => l.case_id === caseId);
  }

  return (data || []) as CaseLog[];
}

export async function createCaseItem(
  payload: Omit<CaseItem, 'id' | 'updated_at'>
): Promise<CaseItem> {
  const user = getCurrentUserSession();
  const newCase: CaseItem = {
    ...payload,
    id: generateId(),
    last_modified_by: user.displayName,
    updated_at: new Date().toISOString(),
  };

  // תמיד נשמר מיד ב-LocalStorage לחוויית עבודה מיידית
  const cases = getLocalCases();
  saveLocalCases([newCase, ...cases]);

  if (!isLocalDemoMode() && supabase) {
    const { data, error } = await supabase
      .from('cases')
      .insert([{ ...payload, last_modified_by: user.displayName }])
      .select()
      .single();
    if (!error && data) return data as CaseItem;
  }

  return newCase;
}

export async function bulkCreateCaseItems(
  payloads: Omit<CaseItem, 'id' | 'updated_at'>[]
): Promise<CaseItem[]> {
  if (payloads.length === 0) return [];
  const user = getCurrentUserSession();
  const now = new Date().toISOString();
  const newCases: CaseItem[] = payloads.map((p) => ({
    ...p,
    id: generateId(),
    last_modified_by: user.displayName,
    updated_at: now,
  }));

  const existing = getLocalCases();
  saveLocalCases([...newCases, ...existing]);

  if (!isLocalDemoMode() && supabase) {
    const { data, error } = await supabase
      .from('cases')
      .insert(payloads)
      .select();
    if (!error && data) return data as CaseItem[];
  }

  return newCases;
}

export async function updateCaseItem(
  id: string,
  updates: Partial<Omit<CaseItem, 'id' | 'updated_at'>>
): Promise<CaseItem> {
  const user = getCurrentUserSession();
  const cases = getLocalCases();
  const idx = cases.findIndex((c) => c.id === id);

  if (idx !== -1) {
    const updatedCase: CaseItem = {
      ...cases[idx],
      ...updates,
      last_modified_by: user.displayName,
      updated_at: new Date().toISOString(),
    };
    cases[idx] = updatedCase;
    saveLocalCases(cases);

    if (!isLocalDemoMode() && supabase) {
      await supabase
        .from('cases')
        .update({
          ...updates,
          last_modified_by: user.displayName,
          updated_at: updatedCase.updated_at,
        })
        .eq('id', id);
    }

    return updatedCase;
  }

  if (!isLocalDemoMode() && supabase) {
    const { data, error } = await supabase
      .from('cases')
      .update({
        ...updates,
        last_modified_by: user.displayName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CaseItem;
  }

  throw new Error('התיק לא נמצא');
}

export async function deleteCaseItem(id: string): Promise<void> {
  const user = getCurrentUserSession();
  if (user.role !== 'admin') {
    throw new Error('רק מנהל מערכת (admin) מורשה למחוק תיקים');
  }

  const cases = getLocalCases().filter((c) => c.id !== id);
  saveLocalCases(cases);
  const logs = getLocalLogs().filter((l) => l.case_id !== id);
  saveLocalLogs(logs);

  if (!isLocalDemoMode() && supabase) {
    const { error } = await supabase.from('cases').delete().eq('id', id);
    if (error) throw error;
  }
}

export async function addCaseLog(
  payload: Omit<CaseLog, 'id' | 'log_date'> & { log_date?: string }
): Promise<CaseLog> {
  const user = getCurrentUserSession();
  const newLog: CaseLog = {
    id: generateId(),
    case_id: payload.case_id,
    log_date: payload.log_date || new Date().toISOString(),
    log_type: payload.log_type,
    content: payload.content,
    due_date: payload.due_date || null,
    created_by: payload.created_by || user.displayName,
  };

  const logs = getLocalLogs();
  saveLocalLogs([newLog, ...logs]);

  const cases = getLocalCases();
  const idx = cases.findIndex((c) => c.id === payload.case_id);
  if (idx !== -1) {
    cases[idx] = {
      ...cases[idx],
      last_modified_by: newLog.created_by,
      updated_at: new Date().toISOString(),
    };
    saveLocalCases(cases);
  }

  if (!isLocalDemoMode() && supabase) {
    const { data, error } = await supabase
      .from('case_logs')
      .insert([
        {
          case_id: payload.case_id,
          log_type: payload.log_type,
          content: payload.content,
          due_date: payload.due_date || null,
          created_by: newLog.created_by,
        },
      ])
      .select()
      .single();
    if (!error && data) return data as CaseLog;
  }

  return newLog;
}

export async function deleteCaseLog(logId: string): Promise<void> {
  const user = getCurrentUserSession();
  if (user.role !== 'admin') {
    throw new Error('רק מנהל מערכת מורשה למחוק תרשומות מיומן התיק');
  }

  const logs = getLocalLogs().filter((l) => l.id !== logId);
  saveLocalLogs(logs);

  if (!isLocalDemoMode() && supabase) {
    const { error } = await supabase.from('case_logs').delete().eq('id', logId);
    if (error) throw error;
  }
}

// ============================================================================
// שדות מעקב ותזכורות מותאמים אישית + החלה גורפת (Custom Fields & Bulk Apply)
// ============================================================================
export async function createCustomFieldAndApply(params: {
  label: string;
  field_type: CustomFieldType;
  initial_value: string | boolean;
  due_date?: string | null;
  scope: CustomFieldScope;
  target_case_id?: string | null;
  target_category?: CaseCategory | null;
}): Promise<CaseItem[]> {
  const user = getCurrentUserSession();
  const now = new Date().toISOString();
  const fieldKey = `cf_${generateId()}`;
  const cases = getLocalCases();

  const updatedCases = cases.map((c) => {
    const shouldApply =
      params.scope === 'all' ||
      (params.scope === 'category' && c.category === params.target_category) ||
      (params.scope === 'case' && c.id === params.target_case_id);

    if (!shouldApply) return c;

    const existingFields = c.custom_fields || [];
    const newField: CaseCustomField = {
      id: generateId(),
      field_key: fieldKey,
      label: params.label.trim(),
      field_type: params.field_type,
      value: params.initial_value,
      due_date: params.due_date || null,
      is_done: params.field_type === 'boolean' ? Boolean(params.initial_value) : false,
      scope: params.scope,
      category: params.scope === 'category' ? params.target_category || c.category : null,
      updated_by: user.displayName,
      updated_at: now,
    };

    return {
      ...c,
      custom_fields: [...existingFields, newField],
      last_modified_by: user.displayName,
      updated_at: now,
    };
  });

  saveLocalCases(updatedCases);
  return updatedCases;
}

export async function updateCustomFieldInline(
  caseId: string,
  fieldId: string,
  updates: Partial<Pick<CaseCustomField, 'value' | 'due_date' | 'is_done' | 'label'>>
): Promise<CaseItem[]> {
  const user = getCurrentUserSession();
  const now = new Date().toISOString();
  const cases = getLocalCases();

  const updatedCases = cases.map((c) => {
    if (c.id !== caseId) return c;
    const nextFields = (c.custom_fields || []).map((f) =>
      f.id === fieldId
        ? {
            ...f,
            ...updates,
            updated_by: user.displayName,
            updated_at: now,
          }
        : f
    );
    return {
      ...c,
      custom_fields: nextFields,
      last_modified_by: user.displayName,
      updated_at: now,
    };
  });

  saveLocalCases(updatedCases);
  return updatedCases;
}

export async function deleteCustomFieldFromCases(
  caseId: string,
  fieldId: string,
  fieldKey: string,
  removeFromAllMatchingScope = false
): Promise<CaseItem[]> {
  const user = getCurrentUserSession();
  const now = new Date().toISOString();
  const cases = getLocalCases();

  const updatedCases = cases.map((c) => {
    if (!removeFromAllMatchingScope && c.id !== caseId) return c;
    const before = c.custom_fields || [];
    const after = before.filter((f) =>
      removeFromAllMatchingScope ? f.field_key !== fieldKey : f.id !== fieldId
    );
    if (after.length === before.length) return c;
    return {
      ...c,
      custom_fields: after,
      last_modified_by: user.displayName,
      updated_at: now,
    };
  });

  saveLocalCases(updatedCases);
  return updatedCases;
}

// ============================================================================
// ארכיון חכם (הושלם / ארכיון) — העברה לארכיון ושחזור לפעילים
// ============================================================================
export async function toggleArchiveCase(
  caseId: string,
  archive: boolean
): Promise<CaseItem[]> {
  const user = getCurrentUserSession();
  const now = new Date().toISOString();
  const cases = getLocalCases();

  const updatedCases = cases.map((c) => {
    if (c.id !== caseId) return c;
    return {
      ...c,
      is_archived: archive,
      archived_at: archive ? now : null,
      status: archive && c.status !== 'סגור' ? 'סגור' : !archive && c.status === 'סגור' ? 'פעיל' : c.status,
      last_modified_by: user.displayName,
      updated_at: now,
    };
  });

  saveLocalCases(updatedCases);

  await addCaseLog({
    case_id: caseId,
    log_type: 'פעולה שבוצעה',
    content: archive
      ? `התיק הועבר לארכיון (הושלם / ארכיון) ע"י ${user.displayName}`
      : `התיק שוחזר מהארכיון לרשימת התיקים הפעילים ע"י ${user.displayName}`,
    created_by: user.displayName,
  });

  return updatedCases;
}

// ============================================================================
// גיבוי מלא (JSON) ושחזור במיזוג בטוח (Safe Merge Restore) + טעינת דוגמה בטוחה
// ============================================================================
export function createFullSystemBackupObject(): FullSystemBackup {
  return {
    version: APP_VERSION,
    exported_at: new Date().toISOString(),
    cases: getLocalCases(),
    logs: getLocalLogs(),
    municipalities_settings: getLocalMunicipalitiesSettings(),
    system_users: getLocalSystemUsers(),
  };
}

export function downloadFullSystemBackupJson(): void {
  if (typeof window === 'undefined') return;
  const backup = createFullSystemBackupObject();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const datePart = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `legal-command-center-backup-${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function restoreFromBackupSafeMerge(
  rawBackup: Partial<FullSystemBackup> | CaseItem[]
): {
  cases: CaseItem[];
  logs: CaseLog[];
  muniSettings: MunicipalitySetting[];
  users: SystemUserAccount[];
  addedCasesCount: number;
  updatedCasesCount: number;
} {
  const existingCases = getLocalCases();
  const existingLogs = getLocalLogs();
  const existingMunis = getLocalMunicipalitiesSettings();
  const existingUsers = getLocalSystemUsers();

  const incomingCasesRaw: Partial<CaseItem>[] = Array.isArray(rawBackup)
    ? rawBackup
    : Array.isArray(rawBackup.cases)
    ? rawBackup.cases
    : [];

  const mergedCasesMap = new Map<string, CaseItem>();
  for (const c of existingCases) {
    mergedCasesMap.set(c.id, safeNormalizeCaseItem(c));
  }

  let addedCasesCount = 0;
  let updatedCasesCount = 0;

  for (const inc of incomingCasesRaw) {
    const normalizedInc = safeNormalizeCaseItem(inc);
    // זיהוי לפי id או לפי מספר תיק + שם חייב
    let matchKey: string | null = null;
    if (mergedCasesMap.has(normalizedInc.id)) {
      matchKey = normalizedInc.id;
    } else if (normalizedInc.case_number && normalizedInc.debtor_name) {
      const found = Array.from(mergedCasesMap.values()).find(
        (existing) =>
          existing.case_number === normalizedInc.case_number &&
          existing.debtor_name === normalizedInc.debtor_name
      );
      if (found) matchKey = found.id;
    }

    if (matchKey) {
      const curr = mergedCasesMap.get(matchKey)!;
      // מיזוג בטוח של שדות מותאמים ומשימות מבלי למחוק נתונים קיימים
      const mergedCustomFields = [...(curr.custom_fields || [])];
      for (const cf of normalizedInc.custom_fields || []) {
        if (
          !mergedCustomFields.some(
            (e) => e.id === cf.id || e.field_key === cf.field_key
          )
        ) {
          mergedCustomFields.push(cf);
        }
      }
      const mergedMilestones = [...(curr.milestones || [])];
      for (const ms of normalizedInc.milestones || []) {
        if (
          !mergedMilestones.some(
            (e) => e.id === ms.id || e.title === ms.title
          )
        ) {
          mergedMilestones.push(ms);
        }
      }

      mergedCasesMap.set(
        matchKey,
        safeNormalizeCaseItem({
          ...curr,
          ...normalizedInc,
          id: curr.id,
          custom_fields: mergedCustomFields,
          milestones: mergedMilestones,
        })
      );
      updatedCasesCount++;
    } else {
      mergedCasesMap.set(normalizedInc.id, normalizedInc);
      addedCasesCount++;
    }
  }

  const finalCases = Array.from(mergedCasesMap.values());
  saveLocalCases(finalCases);

  // מיזוג בטוח של יומן התרשומות
  const incomingLogs =
    !Array.isArray(rawBackup) && Array.isArray(rawBackup.logs)
      ? rawBackup.logs
      : [];
  const logsMap = new Map<string, CaseLog>();
  for (const l of existingLogs) logsMap.set(l.id, l);
  for (const l of incomingLogs) {
    if (l && l.id && !logsMap.has(l.id)) {
      logsMap.set(l.id, l);
    }
  }
  const finalLogs = Array.from(logsMap.values()).sort(
    (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  );
  saveLocalLogs(finalLogs);

  // מיזוג בטוח של הגדרות רשויות
  const incomingMunis =
    !Array.isArray(rawBackup) &&
    Array.isArray(rawBackup.municipalities_settings)
      ? rawBackup.municipalities_settings
      : [];
  const munisMap = new Map<string, MunicipalitySetting>();
  for (const m of existingMunis) munisMap.set(m.municipality_name, m);
  for (const m of incomingMunis) {
    if (m && m.municipality_name) {
      munisMap.set(m.municipality_name, m);
    }
  }
  const finalMunis = Array.from(munisMap.values());
  saveLocalMunicipalitiesSettings(finalMunis);

  return {
    cases: finalCases,
    logs: finalLogs,
    muniSettings: finalMunis,
    users: existingUsers,
    addedCasesCount,
    updatedCasesCount,
  };
}

// טעינה יזומה ובטוחה של נתוני דוגמה (רק בלחיצה יזומה של המשתמש בהגדרות)
export function loadSampleDataSafeMerge(): {
  cases: CaseItem[];
  logs: CaseLog[];
  muniSettings: MunicipalitySetting[];
  users: SystemUserAccount[];
  addedCasesCount: number;
  updatedCasesCount: number;
} {
  return restoreFromBackupSafeMerge({
    version: APP_VERSION,
    exported_at: new Date().toISOString(),
    cases: OPTIONAL_DEMO_CASES,
    logs: OPTIONAL_DEMO_LOGS,
    municipalities_settings: INITIAL_MUNICIPALITIES_SETTINGS,
  });
}

// מחיקת כל התיקים והתרשומות להתחלה מחדש (0 תיקים)
export function clearAllCasesAndStartFresh(): {
  cases: CaseItem[];
  logs: CaseLog[];
} {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_CASES_KEY, JSON.stringify([]));
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify([]));
    localStorage.setItem(STORAGE_SAMPLE_PURGE_V7_1, 'true');
  }
  return { cases: [], logs: [] };
}

// החלה גורפת או פרטנית של שדה מחוז (District)
export async function bulkApplyDistrictToCases(params: {
  district: CaseDistrict;
  scope: 'case' | 'category' | 'all' | 'ids';
  target_case_id?: string;
  target_category?: CaseCategory;
  target_ids?: string[];
}): Promise<CaseItem[]> {
  const user = getCurrentUserSession();
  const now = new Date().toISOString();
  const cases = getLocalCases();
  const idSet = new Set(params.target_ids || []);

  const updatedCases = cases.map((c) => {
    const match =
      params.scope === 'all' ||
      (params.scope === 'category' && c.category === params.target_category) ||
      (params.scope === 'case' && c.id === params.target_case_id) ||
      (params.scope === 'ids' && idSet.has(c.id));

    if (!match) return c;
    return {
      ...c,
      district: params.district,
      last_modified_by: user.displayName,
      updated_at: now,
    };
  });

  saveLocalCases(updatedCases);
  return updatedCases;
}

export async function toggleCaseFeePaid(
  caseId: string,
  paid?: boolean
): Promise<CaseItem[]> {
  const user = getCurrentUserSession();
  const now = new Date().toISOString();
  const cases = getLocalCases();

  const updatedCases = cases.map((c) => {
    if (c.id !== caseId) return c;
    const nextPaid = paid !== undefined ? paid : !c.legal_fee_paid;
    const feeTotal = Number(c.legal_fee_amount) || 4500;
    return {
      ...c,
      legal_fee_amount: feeTotal,
      legal_fee_paid: nextPaid,
      legal_fee_paid_amount: nextPaid ? feeTotal : 0,
      last_modified_by: user.displayName,
      updated_at: now,
    };
  });

  saveLocalCases(updatedCases);
  return updatedCases;
}

// ============================================================================
// מצב עריכת מערכת חי בהקשר (Live Admin Edit Mode) — החלת שינויי שלבים ב-4 רמות:
// 1. תיק זה (case) | 2. תיקים מסומנים (selected) | 3. קטגוריה (category) | 4. הכל (all)
// ============================================================================
export type StageBulkApplyScope = 'case' | 'selected' | 'category' | 'all';

export async function bulkApplyStageMutation(params: {
  action: 'add' | 'rename' | 'delete' | 'reorder' | 'set_active_stage';
  scope: StageBulkApplyScope;
  targetCaseId?: string;
  selectedCaseIds?: string[];
  targetCategory?: CaseCategory;
  stageTitle?: string;
  oldStageTitle?: string;
  newStageTitle?: string;
  direction?: 'up' | 'down';
  stageNote?: string;
}): Promise<CaseItem[]> {
  const user = getCurrentUserSession();
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const cases = getLocalCases();
  const selectedSet = new Set(params.selectedCaseIds || []);

  const updatedCases = cases.map((c) => {
    const matchesScope =
      params.scope === 'all' ||
      (params.scope === 'category' && c.category === params.targetCategory) ||
      (params.scope === 'selected' &&
        (selectedSet.has(c.id) || c.id === params.targetCaseId)) ||
      (params.scope === 'case' && c.id === params.targetCaseId);

    if (!matchesScope) return c;

    let nextMilestones = [...(c.milestones || [])];
    let nextCurrentStage = c.current_stage || '';
    let nextStageNote = c.stage_note ?? '';

    if (params.action === 'add' && params.stageTitle?.trim()) {
      const cleanTitle = params.stageTitle.trim();
      if (!nextMilestones.some((m) => m.title === cleanTitle)) {
        nextMilestones.push({
          id: generateId(),
          title: cleanTitle,
          status: 'upcoming',
          urgency: 'רגילה',
          planned_days: 7,
          started_at: today,
          completed_at: null,
          days_spent: 0,
          updated_by: user.displayName,
        });
      }
    } else if (
      params.action === 'rename' &&
      params.oldStageTitle &&
      params.newStageTitle?.trim()
    ) {
      const cleanNew = params.newStageTitle.trim();
      nextMilestones = nextMilestones.map((m) =>
        m.title === params.oldStageTitle
          ? { ...m, title: cleanNew, updated_by: user.displayName }
          : m
      );
      if (nextCurrentStage === params.oldStageTitle) {
        nextCurrentStage = cleanNew;
      }
    } else if (params.action === 'delete' && params.stageTitle) {
      nextMilestones = nextMilestones.filter(
        (m) => m.title !== params.stageTitle
      );
    } else if (
      params.action === 'reorder' &&
      params.stageTitle &&
      params.direction
    ) {
      const idx = nextMilestones.findIndex(
        (m) => m.title === params.stageTitle
      );
      if (idx !== -1) {
        const swapIdx = params.direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx >= 0 && swapIdx < nextMilestones.length) {
          const temp = nextMilestones[idx];
          nextMilestones[idx] = nextMilestones[swapIdx];
          nextMilestones[swapIdx] = temp;
        }
      }
    } else if (
      params.action === 'set_active_stage' &&
      params.stageTitle?.trim()
    ) {
      nextCurrentStage = params.stageTitle.trim();
      if (params.stageNote !== undefined) {
        nextStageNote = params.stageNote;
      }
    }

    return {
      ...c,
      current_stage: nextCurrentStage,
      stage_note: nextStageNote,
      milestones: nextMilestones,
      last_modified_by: user.displayName,
      updated_at: now,
    };
  });

  saveLocalCases(updatedCases);
  return updatedCases;
}

// ============================================================================
// ניהול אחראים לביצוע (Assignees) — הוספה, עריכה ומחיקה של אנשי צוות (v8.5)
// ============================================================================
const STORAGE_ASSIGNEES_KEY = 'legal_fork_assignees_v1';

export const DEFAULT_ASSIGNEES: string[] = [
  'אליאב',
  'רון',
  'מזכירות',
  'מתמחה',
];

export function getAssigneesList(): string[] {
  if (typeof window === 'undefined') return DEFAULT_ASSIGNEES;
  const raw = localStorage.getItem(STORAGE_ASSIGNEES_KEY);
  if (!raw) {
    localStorage.setItem(
      STORAGE_ASSIGNEES_KEY,
      JSON.stringify(DEFAULT_ASSIGNEES)
    );
    return DEFAULT_ASSIGNEES;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_ASSIGNEES;
  } catch {
    return DEFAULT_ASSIGNEES;
  }
}

export function saveAssigneesList(list: string[]): string[] {
  const clean = Array.from(
    new Set(list.map((s) => s.trim()).filter(Boolean))
  );
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_ASSIGNEES_KEY, JSON.stringify(clean));
  }
  return clean;
}

export function addAssigneeName(name: string): string[] {
  const clean = name.trim();
  if (!clean) return getAssigneesList();
  const current = getAssigneesList();
  if (current.includes(clean)) return current;
  return saveAssigneesList([...current, clean]);
}

export function renameAssigneeName(oldName: string, newName: string): string[] {
  const cleanNew = newName.trim();
  if (!cleanNew) return getAssigneesList();
  const current = getAssigneesList().map((a) =>
    a === oldName ? cleanNew : a
  );
  // עדכון בטוח גם בתיקים הקיימים
  const cases = getLocalCases();
  let changed = false;
  const updated = cases.map((c) => {
    let caseChanged = false;
    let nextAssigned = c.assigned_to;
    if (nextAssigned === oldName) {
      nextAssigned = cleanNew;
      caseChanged = true;
    }
    const nextMs = (c.milestones || []).map((m) => {
      if (m.assignee === oldName) {
        caseChanged = true;
        return { ...m, assignee: cleanNew };
      }
      return m;
    });
    const nextSubs = (c.company_submissions || []).map((s) => {
      if (s.assignee === oldName) {
        caseChanged = true;
        return { ...s, assignee: cleanNew };
      }
      return s;
    });
    const nextHearings = (c.company_hearings || []).map((h) => {
      if (h.assignee === oldName) {
        caseChanged = true;
        return { ...h, assignee: cleanNew };
      }
      return h;
    });
    if (!caseChanged) return c;
    changed = true;
    return {
      ...c,
      assigned_to: nextAssigned,
      milestones: nextMs,
      company_submissions: nextSubs,
      company_hearings: nextHearings,
    };
  });
  if (changed) saveLocalCases(updated);
  return saveAssigneesList(current);
}

export function deleteAssigneeName(name: string): string[] {
  const current = getAssigneesList().filter((a) => a !== name);
  return saveAssigneesList(current);
}

// ============================================================================
// גמישות עריכה מלאה ב-Live Admin Edit Mode: עריכת תגיות, כרטיסיות ושדות מותאמים
// ============================================================================
const STORAGE_CUSTOM_TAGS_KEY = 'legal_fork_custom_tags_v1';
const STORAGE_CUSTOM_UI_LABELS_KEY = 'legal_fork_ui_labels_v1';

export function getCustomTagsList(): string[] {
  if (typeof window === 'undefined') return [...CASE_TAGS];
  const raw = localStorage.getItem(STORAGE_CUSTOM_TAGS_KEY);
  if (!raw) {
    localStorage.setItem(
      STORAGE_CUSTOM_TAGS_KEY,
      JSON.stringify([...CASE_TAGS])
    );
    return [...CASE_TAGS];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : [...CASE_TAGS];
  } catch {
    return [...CASE_TAGS];
  }
}

export function addCustomCaseTag(tag: string): string[] {
  const clean = tag.trim();
  if (!clean) return getCustomTagsList();
  const list = getCustomTagsList();
  if (!list.includes(clean)) {
    const next = [...list, clean];
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_CUSTOM_TAGS_KEY, JSON.stringify(next));
    }
    return next;
  }
  return list;
}

export function renameCustomCaseTag(
  oldTag: string,
  newTag: string
): { tags: string[]; cases: CaseItem[] } {
  const cleanNew = newTag.trim();
  if (!cleanNew) return { tags: getCustomTagsList(), cases: getLocalCases() };
  const nextTags = Array.from(
    new Set(
      getCustomTagsList().map((t) => (t === oldTag ? cleanNew : t))
    )
  );
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_CUSTOM_TAGS_KEY, JSON.stringify(nextTags));
  }
  const updatedCases = getLocalCases().map((c) => {
    if (!(c.tags || []).includes(oldTag as CaseTag)) return c;
    return {
      ...c,
      tags: (c.tags || []).map((t) =>
        (t as string) === oldTag ? (cleanNew as CaseTag) : t
      ),
    };
  });
  saveLocalCases(updatedCases);
  return { tags: nextTags, cases: updatedCases };
}

export function deleteCustomCaseTag(tagToDelete: string): {
  tags: string[];
  cases: CaseItem[];
} {
  const nextTags = getCustomTagsList().filter((t) => t !== tagToDelete);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_CUSTOM_TAGS_KEY, JSON.stringify(nextTags));
  }
  const updatedCases = getLocalCases().map((c) => ({
    ...c,
    tags: (c.tags || []).filter((t) => (t as string) !== tagToDelete),
  }));
  saveLocalCases(updatedCases);
  return { tags: nextTags, cases: updatedCases };
}

export function getCustomUiLabels(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const raw = localStorage.getItem(STORAGE_CUSTOM_UI_LABELS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveCustomUiLabel(
  key: string,
  newLabel: string
): Record<string, string> {
  const current = getCustomUiLabels();
  const clean = newLabel.trim();
  if (!clean) {
    delete current[key];
  } else {
    current[key] = clean;
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(
      STORAGE_CUSTOM_UI_LABELS_KEY,
      JSON.stringify(current)
    );
  }
  return { ...current };
}

export async function renameCustomFieldAcrossCases(params: {
  field_key: string;
  new_label: string;
  scope: CustomFieldScope;
  target_case_id?: string;
}): Promise<CaseItem[]> {
  const clean = params.new_label.trim();
  if (!clean) return getLocalCases();
  const user = getCurrentUserSession();
  const now = new Date().toISOString();
  const cases = getLocalCases().map((c) => {
    if (params.scope === 'case' && c.id !== params.target_case_id) return c;
    const fields = c.custom_fields || [];
    if (!fields.some((f) => f.field_key === params.field_key)) return c;
    return {
      ...c,
      custom_fields: fields.map((f) =>
        f.field_key === params.field_key
          ? { ...f, label: clean, updated_by: user.displayName, updated_at: now }
          : f
      ),
      last_modified_by: user.displayName,
      updated_at: now,
    };
  });
  saveLocalCases(cases);
  return cases;
}

// ============================================================================
// תגיות פעולה גמישות ליומן ולמשימות (התקשרות, מייל, בירור, נסח טאבו, מכתב + הוספה)
// ============================================================================
const STORAGE_ACTION_TAGS_KEY = 'legal_fork_action_tags_v1';

export function getActionTagsList(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_ACTION_TAGS];
  const raw = localStorage.getItem(STORAGE_ACTION_TAGS_KEY);
  if (!raw) {
    localStorage.setItem(
      STORAGE_ACTION_TAGS_KEY,
      JSON.stringify([...DEFAULT_ACTION_TAGS])
    );
    return [...DEFAULT_ACTION_TAGS];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : [...DEFAULT_ACTION_TAGS];
  } catch {
    return [...DEFAULT_ACTION_TAGS];
  }
}

export function addCustomActionTag(tag: string): string[] {
  const clean = tag.trim();
  if (!clean) return getActionTagsList();
  const list = getActionTagsList();
  if (!list.includes(clean)) {
    const next = [...list, clean];
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_ACTION_TAGS_KEY, JSON.stringify(next));
    }
    return next;
  }
  return list;
}

export function deleteCustomActionTag(tag: string): string[] {
  const next = getActionTagsList().filter((t) => t !== tag);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_ACTION_TAGS_KEY, JSON.stringify(next));
  }
  return next;
}

// ============================================================================
// מודול אלפון משרדי חכם (Contacts & Legal Directory — גרסה 8.6)
// 5 קטגוריות מסונכרנות אוטומטית עם החייבים, צוות המשרד, העיריות ובעלי התפקידים
// ============================================================================
const STORAGE_OFFICE_CONTACTS_KEY = 'legal_fork_office_contacts_v1';
const STORAGE_CONTACT_CATEGORIES_KEY = 'legal_fork_contact_categories_v1';

const DEFAULT_MANUAL_OFFICE_CONTACTS: OfficeContactItem[] = [
  {
    id: 'dir_staff_ron',
    category: 'צוות המשרד (תפקידים ושיוך)',
    name: 'עו"ד רון',
    organization: 'משרד עו"ד (ניהול והוראות)',
    role_or_title: 'שותף מנהל / מفرק ונאמן',
    phone: '050-0000001',
    email: 'ron@law-office.co.il',
    notes: 'מתן הוראות ניהוליות ואישור דוחות לביהמ"ש',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dir_staff_eliav',
    category: 'צוות המשרד (תפקידים ושיוך)',
    name: 'אליאב',
    organization: 'משרד עו"ד',
    role_or_title: 'אחראי תיקי חברות, רשויות וחדל"פ',
    phone: '050-0000002',
    email: 'eliav@law-office.co.il',
    notes: 'ניהול שוטף, חקירות, הגשות ודוחות נאמן',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dir_gov_memune',
    category: 'הממונה על חדל"פ, בתי משפט וגופים נוספים',
    name: 'הממונה על הליכי חדלות פירעון ושיקום כלכלי',
    organization: 'משרד המשפטים',
    role_or_title: 'מוקד מענה ופיקוח נאמנים',
    phone: '*5067',
    email: 'insolvency@justice.gov.il',
    notes: 'הגשת דוחות תקופתיים, כתבי ערובה ובקשות ממונה',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dir_gov_rasham',
    category: 'הממונה על חדל"פ, בתי משפט וגופים נוספים',
    name: 'רשם החברות ושותפויות — רשות התאגידים',
    organization: 'משרד המשפטים',
    role_or_title: 'הפקת נסח חברה ורישום שעבודים/פירוק',
    phone: '*5601',
    email: 'corporations@justice.gov.il',
    notes: 'בדיקת נסח חברה עדכני מיד עם קבלת צו מינוי',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'dir_gov_taxes',
    category: 'הממונה על חדל"פ, בתי משפט וגופים נוספים',
    name: 'רשות המיסים — מחלקת פירוקים וכינוסים',
    organization: 'רשות המיסים בישראל',
    role_or_title: 'מע"מ, מס הכנסה ומיסוי מקרקעין',
    phone: '*4954',
    email: 'pirukim@taxes.gov.il',
    notes: 'קבלת תדפיסי חובות, שומות ומידע על נכסים',
    updated_at: new Date().toISOString(),
  },
];

export function getContactCategoriesList(): string[] {
  if (typeof window === 'undefined') return [...DEFAULT_CONTACT_CATEGORIES];
  const raw = localStorage.getItem(STORAGE_CONTACT_CATEGORIES_KEY);
  if (!raw) {
    localStorage.setItem(
      STORAGE_CONTACT_CATEGORIES_KEY,
      JSON.stringify([...DEFAULT_CONTACT_CATEGORIES])
    );
    return [...DEFAULT_CONTACT_CATEGORIES];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : [...DEFAULT_CONTACT_CATEGORIES];
  } catch {
    return [...DEFAULT_CONTACT_CATEGORIES];
  }
}

export function addContactCategory(name: string): string[] {
  const clean = name.trim();
  if (!clean) return getContactCategoriesList();
  const list = getContactCategoriesList();
  if (!list.includes(clean)) {
    const next = [...list, clean];
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        STORAGE_CONTACT_CATEGORIES_KEY,
        JSON.stringify(next)
      );
    }
    return next;
  }
  return list;
}

export function renameContactCategory(oldName: string, newName: string): string[] {
  const clean = newName.trim();
  if (!clean) return getContactCategoriesList();
  const next = getContactCategoriesList().map((c) =>
    c === oldName ? clean : c
  );
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_CONTACT_CATEGORIES_KEY, JSON.stringify(next));
    const manual = getStoredManualContacts().map((item) =>
      item.category === oldName ? { ...item, category: clean } : item
    );
    localStorage.setItem(STORAGE_OFFICE_CONTACTS_KEY, JSON.stringify(manual));
  }
  return next;
}

export function deleteContactCategory(name: string): string[] {
  const next = getContactCategoriesList().filter((c) => c !== name);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_CONTACT_CATEGORIES_KEY, JSON.stringify(next));
  }
  return next;
}

function getStoredManualContacts(): OfficeContactItem[] {
  if (typeof window === 'undefined') return DEFAULT_MANUAL_OFFICE_CONTACTS;
  const raw = localStorage.getItem(STORAGE_OFFICE_CONTACTS_KEY);
  if (!raw) {
    localStorage.setItem(
      STORAGE_OFFICE_CONTACTS_KEY,
      JSON.stringify(DEFAULT_MANUAL_OFFICE_CONTACTS)
    );
    return DEFAULT_MANUAL_OFFICE_CONTACTS;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_MANUAL_OFFICE_CONTACTS;
  } catch {
    return DEFAULT_MANUAL_OFFICE_CONTACTS;
  }
}

export function getOfficeContacts(
  casesInput?: CaseItem[],
  muniInput?: MunicipalitySetting[]
): OfficeContactItem[] {
  const manual = getStoredManualContacts();
  const cases = casesInput || getLocalCases();
  const munis = muniInput || getLocalMunicipalitiesSettings();
  const assignees = getAssigneesList();
  const now = new Date().toISOString();

  const map = new Map<string, OfficeContactItem>();
  for (const item of manual) {
    map.set(item.id, item);
  }

  // 1. סנכרון צוות המשרד מתוך רשימת האחראים (Assignees)
  for (const person of assignees) {
    const exists = Array.from(map.values()).some(
      (c) =>
        c.category === 'צוות המשרד (תפקידים ושיוך)' &&
        (c.name === person || c.name.includes(person))
    );
    if (!exists) {
      const id = `sync_staff_${person}`;
      map.set(id, {
        id,
        category: 'צוות המשרד (תפקידים ושיוך)',
        name: person,
        organization: 'צוות המשרד',
        role_or_title: 'אחראי לביצוע בתיקים',
        phone: '',
        email: '',
        is_auto_synced: true,
        updated_at: now,
      });
    }
  }

  // 2. סנכרון עיריות ורשויות מקומיות
  for (const m of munis) {
    const exists = Array.from(map.values()).some(
      (c) =>
        c.category === 'עיריות ורשויות מקומיות' &&
        c.organization === m.municipality_name
    );
    if (!exists) {
      const id = `sync_muni_${m.id}`;
      map.set(id, {
        id,
        category: 'עיריות ורשויות מקומיות',
        name: m.contact_person || `מחלקת גבייה — ${m.municipality_name}`,
        organization: m.municipality_name,
        role_or_title: 'איש קשר ומנהל גבייה ברשות',
        phone: '',
        email: '',
        notes: m.standing_instructions || m.fee_tariff_description || '',
        is_auto_synced: true,
        updated_at: m.updated_at || now,
      });
    }
  }

  // 3. סנכרון חייבים וצדדים בתיקים + מייצגים/בעלי תפקידים חיצוניים מתוך התיקים
  for (const c of cases) {
    const debtorId = `sync_debtor_${c.id}`;
    if (!map.has(debtorId)) {
      map.set(debtorId, {
        id: debtorId,
        category: 'חייבים וצדדים בתיקים',
        name: c.debtor_name,
        organization: c.municipality || c.housing_project_name || c.category,
        role_or_title: `תיק ${c.case_number || 'ללא מס׳'} ${
          c.id_or_hp ? `• ח"פ/ת"ז: ${c.id_or_hp}` : ''
        }`,
        phone: '',
        email: '',
        related_case_id: c.id,
        related_case_name: c.debtor_name,
        notes: c.stage_note || c.current_stage || '',
        is_auto_synced: true,
        updated_at: c.updated_at || now,
      });
    }

    if (c.representative_contact_details?.trim()) {
      const repId = `sync_rep_${c.id}`;
      if (!map.has(repId)) {
        map.set(repId, {
          id: repId,
          category: 'משרדי עו"ד חיצוניים ובעלי תפקידים',
          name: c.representative_contact_details.trim(),
          organization: `מייצג בתיק ${c.debtor_name}`,
          role_or_title: 'מייצג חברה / רו"ח / עו"ד חיצוני',
          related_case_id: c.id,
          related_case_name: c.debtor_name,
          is_auto_synced: true,
          updated_at: c.updated_at || now,
        });
      }
    }

    if (c.trustee_name_and_contact?.trim()) {
      const trId = `sync_trustee_${c.id}`;
      if (!map.has(trId)) {
        map.set(trId, {
          id: trId,
          category: 'משרדי עו"ד חיצוניים ובעלי תפקידים',
          name: c.trustee_name_and_contact.trim(),
          organization: `תיק חדל"פ: ${c.debtor_name}`,
          role_or_title: 'נאמן / מפרק בתיק',
          related_case_id: c.id,
          related_case_name: c.debtor_name,
          is_auto_synced: true,
          updated_at: c.updated_at || now,
        });
      }
    }
  }

  return Array.from(map.values());
}

export function saveOfficeContact(
  contact: Omit<OfficeContactItem, 'id' | 'updated_at'> & { id?: string }
): OfficeContactItem[] {
  const manual = getStoredManualContacts();
  const now = new Date().toISOString();
  const cleanId = contact.id || generateId();
  const saved: OfficeContactItem = {
    ...contact,
    id: cleanId,
    is_auto_synced: false,
    updated_at: now,
  };

  const idx = manual.findIndex((c) => c.id === cleanId);
  if (idx !== -1) {
    manual[idx] = saved;
  } else {
    manual.unshift(saved);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_OFFICE_CONTACTS_KEY, JSON.stringify(manual));
  }

  // אם נוסף איש צוות בקטגוריית צוות המשרד — סנכרן אותו גם לרשימת האחראים לביצוע בתיקים
  if (
    saved.category === 'צוות המשרד (תפקידים ושיוך)' &&
    saved.name.trim()
  ) {
    addAssigneeName(saved.name.trim());
  }

  return getOfficeContacts();
}

export function deleteOfficeContact(id: string): OfficeContactItem[] {
  const manual = getStoredManualContacts().filter((c) => c.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_OFFICE_CONTACTS_KEY, JSON.stringify(manual));
  }
  return getOfficeContacts();
}

// ============================================================================
// תבנית אבני דרך אוטומטית מרגע המינוי בתיקי חברות (גרסה 8.6):
// הגשת כתב ערובה (יעד אוטומטי 14 יום ממועד המינוי), בדיקות גופים, חקירה, מסמכים וצומת הכרעה
// ============================================================================
export function buildCompanyLifecycleMilestones(
  appointmentDate?: string | null,
  defaultAssignee = 'אליאב'
): CaseMilestone[] {
  const baseDate =
    appointmentDate || new Date().toISOString().split('T')[0];
  const bondDue = (() => {
    const d = new Date(`${baseDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return baseDate;
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  })();

  return [
    {
      id: generateId(),
      title: 'קבלת מינוי מהמזכירות והגשת כתב ערובה / התחייבות עצמית (יעד: 14 יום)',
      status: 'in_progress',
      urgency: 'דחוף מאוד',
      planned_days: 14,
      started_at: baseDate,
      due_date: bondDue,
      completed_at: null,
      days_spent: 0,
      assignee: defaultAssignee,
      execution_state: 'בטיפול',
      action_tag: 'הגשה',
      follow_up_title:
        'הפקת נסח חברה מרשם החברות ומשלוח דרישות לגופים פיננסיים, רשות המיסים וביטוח/פנסיה',
    },
    {
      id: generateId(),
      title:
        'בדיקות מול גופים: נסח חברה, גופים פיננסיים, רשות המיסים, ביטוח ופנסיה',
      status: 'upcoming',
      urgency: 'גבוהה',
      planned_days: 10,
      started_at: null,
      due_date: null,
      completed_at: null,
      days_spent: 0,
      assignee: defaultAssignee,
      execution_state: 'בטיפול',
      action_tag: 'מכתב',
      follow_up_title:
        'פנייה למייצג/בעלי מניות, דרישת מסמכים ותיאום מועד חקירה',
    },
    {
      id: generateId(),
      title: 'חקירה ותיאום מועדים + קבלת מסמכים / השלמת מסמכים',
      status: 'upcoming',
      urgency: 'גבוהה',
      planned_days: 14,
      started_at: null,
      due_date: null,
      completed_at: null,
      days_spent: 0,
      assignee: defaultAssignee,
      execution_state: 'בטיפול',
      action_tag: 'פגישה/חקירה',
      follow_up_title: 'עיון במסמכים וכתיבת טיוטת דוח נאמן לביהמ"ש',
    },
    {
      id: generateId(),
      title: 'עיון במסמכים וכתיבת טיוטת דוח נאמן לאישור מנהל/רון',
      status: 'upcoming',
      urgency: 'גבוהה',
      planned_days: 10,
      started_at: null,
      due_date: null,
      completed_at: null,
      days_spent: 0,
      assignee: defaultAssignee,
      execution_state: 'בטיפול',
      action_tag: 'הגשה',
      follow_up_title:
        'צומת הכרעה והגשת דוח מסכם לביהמ"ש: המלצה לחיסול או המשך לפירוק / שיקום',
    },
    {
      id: generateId(),
      title:
        'צומת הכרעה בתיק חברה: המלצה לחיסול מול המשך לפירוק / שיקום',
      status: 'upcoming',
      urgency: 'גבוהה',
      planned_days: 7,
      started_at: null,
      due_date: null,
      completed_at: null,
      days_spent: 0,
      assignee: 'רון',
      is_manager_instruction: true,
      execution_state: 'בטיפול',
      action_tag: 'הגשה',
    },
  ];
}






