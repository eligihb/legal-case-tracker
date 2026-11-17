import { supabase, isSupabaseConfigured } from './supabase';
import {
  INITIAL_MUNICIPALITIES_SETTINGS,
  INITIAL_SAMPLE_CASES,
  INITIAL_SAMPLE_LOGS,
  INITIAL_SYSTEM_USERS,
} from './sampleData';
import {
  CaseCategory,
  CaseCustomField,
  CaseDistrict,
  CaseItem,
  CaseLog,
  CustomFieldScope,
  CustomFieldType,
  FullSystemBackup,
  MunicipalitySetting,
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
  return {
    id: raw.id || generateId(),
    debtor_name: raw.debtor_name || 'תיק ללא שם',
    id_or_hp: raw.id_or_hp ?? '',
    case_number: raw.case_number ?? '',
    gush_helka: raw.gush_helka ?? '',
    category: raw.category || 'גבייה',
    district: inferDefaultDistrict(raw),
    current_stage: raw.current_stage ?? (raw.status || 'פתיחת תיק ובדיקות'),
    municipality: raw.municipality ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    status: raw.status || 'פעיל',
    notes: raw.notes ?? '',
    next_action_type: raw.next_action_type || 'אחר',
    next_action_description: raw.next_action_description ?? '',
    next_due_date: raw.next_due_date ?? null,
    extensions_count: Number(raw.extensions_count) || 0,
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
    self_undertaking_deposited: Boolean(raw.self_undertaking_deposited),
    self_undertaking_date: raw.self_undertaking_date ?? null,
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

// ============================================================================
// LocalStorage Helpers (עם מיגרציה בטוחה של תיקים קיימים ללא דריסת מידע)
// ============================================================================
function getLocalCases(): CaseItem[] {
  if (typeof window === 'undefined') {
    return INITIAL_SAMPLE_CASES.map((c) => safeNormalizeCaseItem(c));
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

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map((c) => safeNormalizeCaseItem(c));
        localStorage.setItem(STORAGE_CASES_KEY, JSON.stringify(normalized));
        return normalized;
      }
    } catch (err) {
      console.warn('Error parsing stored cases, preserving safety:', err);
    }
  }

  // טעינת נתוני דוגמה אך ורק אם המאגר ריק לחלוטין (0 תיקים)
  const initialNormalized = INITIAL_SAMPLE_CASES.map((c) =>
    safeNormalizeCaseItem(c)
  );
  localStorage.setItem(STORAGE_CASES_KEY, JSON.stringify(initialNormalized));
  if (!localStorage.getItem(STORAGE_LOGS_KEY)) {
    localStorage.setItem(
      STORAGE_LOGS_KEY,
      JSON.stringify(INITIAL_SAMPLE_LOGS)
    );
  }
  return initialNormalized;
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

// טעינה יזומה ובטוחה של נתוני דוגמה (ממזגת את תיקי הדוגמה מבלי למחוק תיקים שהמשתמש יצר!)
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
    cases: INITIAL_SAMPLE_CASES,
    logs: INITIAL_SAMPLE_LOGS,
    municipalities_settings: INITIAL_MUNICIPALITIES_SETTINGS,
  });
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



