'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Scale,
  Lock,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Building2,
} from 'lucide-react';
import {
  fetchSystemUsers,
  setCurrentUserSession,
  setDemoAuthenticated,
} from '@/lib/dataService';
import { INITIAL_SYSTEM_USERS } from '@/lib/sampleData';
import { SystemUserAccount } from '@/types/database';
import { APP_VERSION, APP_UPDATED_AT } from '@/lib/version';

export default function LoginPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SystemUserAccount[]>(
    INITIAL_SYSTEM_USERS
  );
  const [selectedUser, setSelectedUser] = useState<SystemUserAccount>(
    INITIAL_SYSTEM_USERS[0]
  );
  const [customDisplayName, setCustomDisplayName] = useState(
    INITIAL_SYSTEM_USERS[0].displayName
  );
  const [password, setPassword] = useState(INITIAL_SYSTEM_USERS[0].password);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSystemUsers().then((loaded) => {
      if (loaded.length > 0) {
        setAccounts(loaded);
        setSelectedUser(loaded[0]);
        setCustomDisplayName(loaded[0].displayName);
        setPassword(loaded[0].password);
      }
    });
  }, []);

  const handleSelectProfile = (acc: SystemUserAccount) => {
    setSelectedUser(acc);
    setCustomDisplayName(acc.displayName);
    setPassword(acc.password);
    setErrorMsg(null);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!password.trim()) {
      setErrorMsg('נא להזין סיסמת כניסה');
      return;
    }

    if (password.trim() !== selectedUser.password) {
      setErrorMsg(
        `סיסמה שגויה עבור ${selectedUser.displayName} (סיסמת ברירת מחדל: ${selectedUser.password})`
      );
      return;
    }

    setCurrentUserSession({
      username: selectedUser.username,
      displayName: customDisplayName.trim() || selectedUser.displayName,
      role: selectedUser.role,
      loggedInAt: new Date().toISOString(),
    });
    setDemoAuthenticated(true);
    router.push('/');
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
        <div className="bg-slate-900 text-white p-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-400/30 text-blue-400 mb-3">
            <Scale className="w-7 h-7" />
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold tracking-tight">
              מערכת ניהול תיקים משפטיים — 4 תחומי המשרד
            </h1>
            <span
              title={`עודכן לאחרונה: ${APP_UPDATED_AT}`}
              className="text-xs px-2.5 py-0.5 rounded-full font-extrabold font-mono bg-amber-400/20 text-amber-300 border border-amber-400/40"
            >
              גרסה {APP_VERSION}
            </span>
          </div>
          <p className="text-sm text-slate-300 mt-1">
            הפרדת הרשאות מלאה (`admin` מול `user`) וחתימה אוטומטית בשם ותאריך/שעה על כל פעולה
          </p>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-extrabold text-slate-800 mb-2">
              1. בחר משתמש לכניסה (מנהל `admin` או עובד `user`):
            </label>
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {accounts.map((acc) => {
                const active = selectedUser.username === acc.username;
                return (
                  <div
                    key={acc.id}
                    onClick={() => handleSelectProfile(acc)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      active
                        ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-100'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {acc.role === 'admin' ? (
                          <ShieldCheck className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-emerald-600" />
                        )}
                        <span className="text-sm font-extrabold text-slate-900">
                          {acc.displayName}
                        </span>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
                          acc.role === 'admin'
                            ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}
                      >
                        {acc.role === 'admin' ? 'מנהל מערכת (admin)' : 'עובד (user)'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {acc.title ||
                        (acc.role === 'admin'
                          ? 'הרשאות מלאות: ניהול משתמשים, הגדרות שכ"ט רשויות ומחיקת תיקים.'
                          : 'הרשאת עובד: הוספת תרשומות, הערות ותזכורות חתומות בשמו ללא מחיקת תיקים.')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                שם העובד לחתימה אוטומטית ביומן
              </label>
              <input
                type="text"
                required
                value={customDisplayName}
                onChange={(e) => setCustomDisplayName(e.target.value)}
                className="w-full p-2.5 text-sm rounded-lg border border-slate-300 focus:border-blue-600 outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1">
                <KeyRound className="w-4 h-4 text-slate-400" />
                סיסמת כניסה אישית
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  className="w-full pr-9 pl-3 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-blue-600 outline-none text-left font-mono font-bold"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <Building2 className="w-5 h-5" />
            היכנס למערכת כ-{customDisplayName || selectedUser.displayName} (
            {selectedUser.role})
          </button>
        </form>
      </div>
    </div>
  );
}
