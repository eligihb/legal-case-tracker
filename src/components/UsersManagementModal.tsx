'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Users,
  Plus,
  Save,
  Trash2,
  ShieldCheck,
  UserCheck,
  KeyRound,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import { SystemUserAccount } from '@/types/database';
import {
  deleteSystemUserAccount,
  saveSystemUserAccount,
} from '@/lib/dataService';
import { formatDateTimeHe } from '@/lib/dateUtils';

interface UsersManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: SystemUserAccount[];
  onUsersChanged: (nextUsers: SystemUserAccount[]) => void;
  isAdmin: boolean;
}

export default function UsersManagementModal({
  isOpen,
  onClose,
  users,
  onUsersChanged,
  isAdmin,
}: UsersManagementModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [password, setPassword] = useState('');
  const [title, setTitle] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    if (isOpen && users.length > 0 && !selectedId) {
      selectUser(users[0]);
    }
  }, [isOpen, users]);

  if (!isOpen) return null;

  const selectUser = (u: SystemUserAccount) => {
    setSelectedId(u.id);
    setUsername(u.username);
    setDisplayName(u.displayName);
    setRole(u.role);
    setPassword(u.password);
    setTitle(u.title || '');
    setActive(u.active);
  };

  const handleStartNew = () => {
    setSelectedId(null);
    setUsername('');
    setDisplayName('');
    setRole('user');
    setPassword('');
    setTitle('');
    setActive(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !username.trim() || !displayName.trim() || !password.trim())
      return;

    setSaving(true);
    try {
      const saved = await saveSystemUserAccount({
        id: selectedId || undefined,
        username: username.trim(),
        displayName: displayName.trim(),
        role,
        password: password.trim(),
        title: title.trim(),
        active,
      });

      const exists = users.some((u) => u.id === saved.id);
      const next = exists
        ? users.map((u) => (u.id === saved.id ? saved : u))
        : [...users, saved];

      onUsersChanged(next);
      setSelectedId(saved.id);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 2500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בשמירת משתמש');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!window.confirm(`האם למחוק את המשתמש "${name}"?`)) return;
    try {
      await deleteSystemUserAccount(id);
      const next = users.filter((u) => u.id !== id);
      onUsersChanged(next);
      if (next.length > 0) selectUser(next[0]);
      else handleStartNew();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה במחיקת משתמש');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div
        dir="rtl"
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              ניהול משתמשים, הרשאות וסיסמאות (`admin` מול `user`)
            </h2>
            <p className="text-sm text-slate-300 mt-0.5">
              כל פעולה, הערה, תרשומת או הפחתה נחתמת אוטומטית בשם העובד המחובר ובתאריך/שעה
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isAdmin && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-900 flex items-center gap-2 font-bold">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            מצב צפייה בלבד: רק מנהל מערכת (`admin`) רשאי לערוך משתמשים, סיסמאות והרשאות.
          </div>
        )}

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* רשימת משתמשים */}
          <div className="md:col-span-4 border-l border-slate-200 bg-slate-50 p-4 overflow-y-auto space-y-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-extrabold text-slate-800">
                משתמשי המשרד ({users.length})
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  עובד חדש
                </button>
              )}
            </div>

            {users.map((u) => {
              const isSelected = selectedId === u.id;
              return (
                <div
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-sm truncate">
                      {u.displayName}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : u.role === 'admin'
                          ? 'bg-indigo-100 text-indigo-900'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {u.role === 'admin' ? 'מנהל (admin)' : 'עובד (user)'}
                    </span>
                  </div>
                  <div
                    className={`text-xs truncate mt-1 ${
                      isSelected ? 'text-indigo-100' : 'text-slate-500'
                    }`}
                  >
                    משתמש: {u.username} • {u.title || 'צוות משרד'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* טופס עריכת משתמש */}
          <form
            onSubmit={handleSave}
            className="md:col-span-8 p-6 overflow-y-auto space-y-4 bg-white"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {selectedId
                  ? `עריכת פרטי משתמש וסיסמה: ${displayName}`
                  : 'הקמת משתמש / עובד חדש במערכת'}
              </h3>
              {savedBanner && (
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" />
                  נשמר בהצלחה!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  שם מלא לחתימה אוטומטית ביומן התיק *
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="לדוגמה: עו״ד דניאל כהן"
                  className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-indigo-600 disabled:bg-slate-100 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  שם משתמש לכניסה (באנגלית) *
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin || username === 'admin'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  dir="ltr"
                  placeholder="daniel"
                  className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-indigo-600 disabled:bg-slate-100 outline-none font-mono text-left"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  סוג הרשאה במערכת *
                </label>
                <select
                  disabled={!isAdmin || username === 'admin'}
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                  className="w-full p-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:border-indigo-600 disabled:bg-slate-100 outline-none font-bold"
                >
                  <option value="user">
                    עובד (user) — עריכה וחתימה אוטומטית (ללא מחיקת תיקים/הגדרות)
                  </option>
                  <option value="admin">
                    מנהל מערכת (admin) — שליטה מלאה במשתמשים, שכ&quot;ט ומחיקה
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  סיסמת כניסה אישית *
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-indigo-600 disabled:bg-slate-100 outline-none font-mono font-bold text-left"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                תפקיד / מחלקה במשרד
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="למשל: מחלקת גביית רשויות והוצל״פ"
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-indigo-600 disabled:bg-slate-100 outline-none"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 space-y-1">
              <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                {role === 'admin' ? (
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                ) : (
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                )}
                פירוט הרשאות לתפקיד שנבחר:
              </div>
              {role === 'admin' ? (
                <p>
                  <strong>מנהל (`admin`):</strong> שליטה מלאה בהוספת/עריכת משתמשים וסיסמאות, קביעת תעריפי שכר טרחה וריבית לכל רשות מקומית, ומחיקת תיקים או תרשומות.
                </p>
              ) : (
                <p>
                  <strong>עובד (`user`):</strong> כניסה עם סיסמה אישית, הוספת תרשומות שיחה, הערות, תזכורות, ארכות ודיווחי הפחתות שנחתמים אוטומטית בשמו ובתאריך/שעה — ללא יכולת למחוק תיקים או לשנות הגדרות מנהל.
                </p>
              )}
            </div>

            {selectedId && (
              <div className="text-xs text-slate-400">
                עודכן לאחרונה:{' '}
                {formatDateTimeHe(
                  users.find((u) => u.id === selectedId)?.updated_at
                )}
              </div>
            )}

            {isAdmin && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                {selectedId && username !== 'admin' ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedId, displayName)}
                    className="px-3.5 py-2 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-1.5 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    מחק משתמש
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    סגור
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !username.trim() || !displayName.trim()}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-extrabold flex items-center gap-2 shadow-xs transition"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'שומר...' : 'שמור משתמש וסיסמה'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
