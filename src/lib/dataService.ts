import { supabase, isSupabaseConfigured } from './supabase';
import {
  INITIAL_MUNICIPALITIES_SETTINGS,
  INITIAL_SAMPLE_CASES,
  INITIAL_SAMPLE_LOGS,
  INITIAL_SYSTEM_USERS,
} from './sampleData';
import {
  CaseItem,
  CaseLog,
  MunicipalitySetting,
  SystemUserAccount,
  UserSession,
} from '@/types/database';

const STORAGE_CASES_KEY = 'legal_fork_cases_v4';
const STORAGE_LOGS_KEY = 'legal_fork_logs_v4';
const STORAGE_MUNI_SETTINGS_KEY = 'legal_fork_muni_settings_v4';
const STORAGE_SYSTEM_USERS_KEY = 'legal_fork_system_users_v4';
const STORAGE_DEMO_AUTH_KEY = 'legal_fork_demo_authenticated';
const STORAGE_USER_SESSION_KEY = 'legal_fork_user_session_v3';

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

// ============================================================================
// LocalStorage Helpers
// ============================================================================
function getLocalCases(): CaseItem[] {
  if (typeof window === 'undefined') return INITIAL_SAMPLE_CASES;
  const raw = localStorage.getItem(STORAGE_CASES_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_CASES_KEY, JSON.stringify(INITIAL_SAMPLE_CASES));
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(INITIAL_SAMPLE_LOGS));
    return INITIAL_SAMPLE_CASES;
  }
  try {
    return JSON.parse(raw) as CaseItem[];
  } catch {
    return INITIAL_SAMPLE_CASES;
  }
}

function saveLocalCases(cases: CaseItem[]): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_CASES_KEY, JSON.stringify(cases));
  }
}

function getLocalLogs(): CaseLog[] {
  if (typeof window === 'undefined') return INITIAL_SAMPLE_LOGS;
  const raw = localStorage.getItem(STORAGE_LOGS_KEY);
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
