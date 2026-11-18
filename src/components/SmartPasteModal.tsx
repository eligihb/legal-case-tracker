'use client';

import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  ClipboardPaste,
  FileText,
  Gavel,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  CASE_CATEGORIES,
  CASE_STATUSES,
  CATEGORY_LABELS,
  CaseCategory,
  CaseItem,
  CaseMilestone,
  CaseStatus,
  LogType,
  NET_HAMISHPAT_STATUSES,
  NEXT_ACTION_TYPES,
  NetHaMishpatStatus,
  NextActionType,
} from '@/types/database';
import {
  addCaseLog,
  createCaseItem,
  generateId,
  updateCaseItem,
} from '@/lib/dataService';
import { addDaysToDateStr, formatDateHe } from '@/lib/dateUtils';

interface SmartPasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseItem[];
  onCaseUpdatedOrCreated: (updatedOrNewCase: CaseItem, isNew: boolean) => void;
}

interface ParsedPasteResult {
  caseNumber: string;
  detectedDate: string; // YYYY-MM-DD
  detectedPartyName: string;
  subjectSummary: string;
  nextActionType: NextActionType;
  netStatus: NetHaMishpatStatus;
  suggestedStatus: CaseStatus;
  logType: LogType;
  isPostponedHearing: boolean;
  prepDays: number;
}

function parseHebrewLegalText(rawText: string): ParsedPasteResult {
  const text = rawText.trim();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. זיהוי מספר תיק (למשל 12345-06-26, 54321-11-25, הוצל"פ 501234-05-24)
  let caseNumber = '';
  const caseRegex =
    /(?:ת"א|תא"מ|חדל"פ|פש"ר|פר"ק|הוצל"פ|תיק|מס['׳]?)\s*[:\-]?\s*(\d{3,7}-\d{2}-\d{2,4})|(\b\d{4,7}-\d{2}-\d{2,4}\b)/;
  const caseMatch = text.match(caseRegex);
  if (caseMatch) {
    caseNumber = (caseMatch[1] || caseMatch[2] || '').trim();
  }

  // 2. זיהוי תאריך מפורש (DD/MM/YYYY או DD.MM.YYYY) או "תוך X ימים"
  let detectedDate = '';
  const dateRegex = /\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2}|\d{2})\b/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year =
      dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) <= 31) {
      detectedDate = `${year}-${month}-${day}`;
    }
  }

  if (!detectedDate) {
    const withinDaysRegex = /תוך\s+(\d{1,3})\s+ימים/;
    const withinMatch = text.match(withinDaysRegex);
    if (withinMatch) {
      const days = Number(withinMatch[1]) || 7;
      detectedDate = addDaysToDateStr(todayStr, days) || '';
    }
  }

  // 3. זיהוי סוג פעולה וסטטוס נט המשפט
  let nextActionType: NextActionType = 'הגשה לביהמ"ש';
  let netStatus: NetHaMishpatStatus = 'התקבלה החלטה';
  let suggestedStatus: CaseStatus = 'פעיל';
  let logType: LogType = 'החלטת ביהמ"ש';
  let isPostponedHearing = false;
  let prepDays = 7;

  if (
    text.includes('נדחה') ||
    text.includes('דחיית דיון') ||
    text.includes('בוטל הדיון')
  ) {
    nextActionType = 'דיון שנדחה';
    suggestedStatus = 'דיון נדחה';
    netStatus = 'התקבלה החלטה';
    logType = 'בקשת ארכה / דחיית דיון';
    isPostponedHearing = true;
  } else if (
    text.includes('דיון') ||
    text.includes('מועד דיון') ||
    text.includes('ישיבת')
  ) {
    nextActionType = 'דיון';
    suggestedStatus = 'דיון קבוע';
    netStatus = 'התקבלה החלטה';
    logType = 'החלטת ביהמ"ש';
    prepDays = 7;
  } else if (
    text.includes('תגובה') ||
    text.includes('להגיב') ||
    text.includes('תגובת')
  ) {
    nextActionType = 'תגובה';
    suggestedStatus = 'הגשה ממתינה לביהמ"ש';
    netStatus = text.includes('צד שכנגד') || text.includes('המשיב')
      ? 'נדרשת תגובת צד שכנגד'
      : 'התקבלה החלטה';
    logType = 'החלטת ביהמ"ש';
    prepDays = 5;
  } else if (
    text.includes('תביעת חוב') ||
    text.includes('נאמן') ||
    text.includes('דו"ח')
  ) {
    nextActionType = text.includes('תביעת חוב')
      ? 'תביעת חוב'
      : 'דו"ח עדכון נאמן';
    suggestedStatus = 'פעיל';
    netStatus = 'ממתין להחלטת שופט/רשם';
  } else if (text.includes('הוגשה בקשה') || text.includes('בקשה ל')) {
    nextActionType = 'בקשה ממתינה';
    suggestedStatus = 'ממתין להחלטה';
    netStatus = 'ממתין להחלטת שופט/רשם';
  }

  // 4. זיהוי שם צד / לקוח / עניין מתוך הטקסט
  let detectedPartyName = '';
  const partyRegex =
    /(?:בעניין|החייב|התובע|הנתבע|המבקש|המשיב|חברת|נגד)\s*[:\-]?\s*([א-ת0-9"״'׳\s().-]{3,40})/;
  const partyMatch = text.match(partyRegex);
  if (partyMatch && partyMatch[1]) {
    detectedPartyName = partyMatch[1].split(/[\n,.]/)[0].trim();
  }

  const firstLine =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 3) || '';
  const subjectSummary =
    firstLine.length > 95 ? `${firstLine.slice(0, 95)}...` : firstLine;

  return {
    caseNumber,
    detectedDate,
    detectedPartyName,
    subjectSummary,
    nextActionType,
    netStatus,
    suggestedStatus,
    logType,
    isPostponedHearing,
    prepDays,
  };
}

export default function SmartPasteModal({
  isOpen,
  onClose,
  cases,
  onCaseUpdatedOrCreated,
}: SmartPasteModalProps) {
  const [rawText, setRawText] = useState('');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [caseSearchQuery, setCaseSearchQuery] = useState('');

  // שדות הניתנים לעריכה מהירה לאחר הזיהוי האוטומטי
  const [debtorName, setDebtorName] = useState('');
  const [subject, setSubject] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [category, setCategory] = useState<CaseCategory>('גבייה');
  const [nextActionType, setNextActionType] =
    useState<NextActionType>('הגשה לביהמ"ש');
  const [nextDueDate, setNextDueDate] = useState('');
  const [netStatus, setNetStatus] =
    useState<NetHaMishpatStatus>('התקבלה החלטה');
  const [status, setStatus] = useState<CaseStatus>('פעיל');
  const [addAsTask, setAddAsTask] = useState(true);
  const [markPostponed, setMarkPostponed] = useState(false);
  const [prepDaysNeeded, setPrepDaysNeeded] = useState(7);
  const [saving, setSaving] = useState(false);

  const handlePasteTextChange = (text: string) => {
    setRawText(text);
    if (!text.trim()) return;

    const parsed = parseHebrewLegalText(text);
    if (parsed.caseNumber) setCaseNumber(parsed.caseNumber);
    if (parsed.detectedDate) setNextDueDate(parsed.detectedDate);
    if (parsed.subjectSummary) setSubject(parsed.subjectSummary);
    setNextActionType(parsed.nextActionType);
    setNetStatus(parsed.netStatus);
    setStatus(parsed.suggestedStatus);
    setMarkPostponed(parsed.isPostponedHearing);
    setPrepDaysNeeded(parsed.prepDays);

    // חיפוש התאמה אוטומטית לתיק קיים לפי מספר תיק או שם צד
    const matched = cases.find((c) => {
      if (
        parsed.caseNumber &&
        c.case_number &&
        c.case_number.includes(parsed.caseNumber)
      ) {
        return true;
      }
      if (
        c.debtor_name &&
        c.debtor_name.length >= 3 &&
        text.includes(c.debtor_name)
      ) {
        return true;
      }
      return false;
    });

    if (matched) {
      setMode('existing');
      setSelectedCaseId(matched.id);
      setDebtorName(matched.debtor_name);
      setCategory(matched.category);
    } else {
      if (parsed.detectedPartyName && !debtorName) {
        setDebtorName(parsed.detectedPartyName);
      }
      if (cases.length === 0) {
        setMode('new');
      }
    }
  };

  const filteredExistingCases = useMemo(() => {
    const q = caseSearchQuery.trim().toLowerCase();
    const active = cases.filter((c) => !c.is_archived);
    if (!q) return active.slice(0, 15);
    return active
      .filter(
        (c) =>
          c.debtor_name.toLowerCase().includes(q) ||
          (c.case_number || '').toLowerCase().includes(q) ||
          (c.subject || '').toLowerCase().includes(q) ||
          (c.id_or_hp || '').toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [cases, caseSearchQuery]);

  if (!isOpen) return null;

  const selectedCase = cases.find((c) => c.id === selectedCaseId) || null;

  const handleConfirmCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const taskTitle =
        subject.trim() ||
        rawText.trim().split('\n')[0]?.slice(0, 90) ||
        `${nextActionType} בתיק`;

      if (mode === 'existing' && selectedCase) {
        const currentMilestones: CaseMilestone[] = Array.isArray(
          selectedCase.milestones
        )
          ? [...selectedCase.milestones]
          : [];

        if (addAsTask && taskTitle) {
          currentMilestones.unshift({
            id: generateId(),
            title: taskTitle,
            status: 'in_progress',
            urgency:
              nextActionType === 'דיון' || nextActionType === 'תגובה'
                ? 'דחוף מאוד'
                : 'גבוהה',
            due_date: nextDueDate || selectedCase.next_due_date || null,
            started_at: today,
            completed_at: null,
          });
        }

        const updated = await updateCaseItem(selectedCase.id, {
          case_number: caseNumber.trim() || selectedCase.case_number,
          subject: subject.trim() || selectedCase.subject || '',
          status,
          net_hamishpat_status: netStatus,
          next_action_type: nextActionType,
          next_action_description: taskTitle,
          next_due_date: nextDueDate || selectedCase.next_due_date || null,
          is_hearing_postponed:
            markPostponed || selectedCase.is_hearing_postponed,
          extensions_count: markPostponed
            ? (Number(selectedCase.extensions_count) || 0) + 1
            : selectedCase.extensions_count,
          postponed_reason: markPostponed
            ? taskTitle
            : selectedCase.postponed_reason,
          prep_days_needed: prepDaysNeeded,
          milestones: currentMilestones,
        });

        await addCaseLog({
          case_id: selectedCase.id,
          log_type: markPostponed ? 'בקשת ארכה / דחיית דיון' : 'החלטת ביהמ"ש',
          content: `[נקלט מנט המשפט / מייל] ${
            rawText.trim() || taskTitle
          }`,
          due_date: nextDueDate || null,
        });

        onCaseUpdatedOrCreated(updated, false);
        onClose();
      } else {
        // יצירת תיק חדש בקליק אחד (גם ללא מספר תיק!)
        const finalName =
          debtorName.trim() || subject.trim() || 'תיק חדש מקליטת נט המשפט';
        const initialMilestones: CaseMilestone[] = addAsTask
          ? [
              {
                id: generateId(),
                title: taskTitle,
                status: 'in_progress',
                urgency: 'דחוף מאוד',
                due_date: nextDueDate || null,
                started_at: today,
                completed_at: null,
              },
            ]
          : [];

        const created = await createCaseItem({
          debtor_name: finalName,
          subject: subject.trim() || taskTitle,
          id_or_hp: '',
          case_number: caseNumber.trim(), // רשות - יכול להיות ריק
          category,
          status,
          net_hamishpat_status: netStatus,
          tags: markPostponed ? ['דיון נדחה'] : [],
          notes: rawText.trim() || taskTitle,
          next_action_type: nextActionType,
          next_action_description: taskTitle,
          next_due_date: nextDueDate || null,
          is_hearing_postponed: markPostponed,
          extensions_count: markPostponed ? 1 : 0,
          postponed_reason: markPostponed ? taskTitle : '',
          prep_days_needed: prepDaysNeeded,
          milestones: initialMilestones,
        });

        await addCaseLog({
          case_id: created.id,
          log_type: 'החלטת ביהמ"ש',
          content: `[פתיחת תיק מקליטת מייל / נט המשפט] ${
            rawText.trim() || taskTitle
          }`,
          due_date: nextDueDate || null,
        });

        onCaseUpdatedOrCreated(created, true);
        onClose();
      }
    } catch (err) {
      console.error('Smart Paste error:', err);
      alert('שגיאה בקליטת הטקסט');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 no-print"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90dvh]"
      >
        {/* כותרת */}
        <div className="px-6 py-4 bg-[#0F172A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <ClipboardPaste className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold flex items-center gap-2">
                <span>קליטה חכמה ממייל / נט המשפט (Ctrl+V)</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  זיהוי תאריכים ותיק אוטומטי
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                הדבק הודעת מייל, החלטת שופט או עדכון מנט המשפט — המערכת תזהה מועד דיון, מועד תגובה ומספר תיק ותשייך בקליק אחד.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleConfirmCapture}
          className="p-5 space-y-4 overflow-y-auto flex-1"
        >
          {/* תיבת הדבקה מרכזית */}
          <div>
            <label className="block text-xs font-extrabold text-slate-800 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                הדבק כאן טקסט ממייל או מהודעת נט המשפט:
              </span>
              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  className="text-xs text-slate-500 hover:text-red-600 font-bold"
                >
                  נקה טקסט
                </button>
              )}
            </label>
            <textarea
              rows={4}
              autoFocus
              value={rawText}
              onChange={(e) => handlePasteTextChange(e.target.value)}
              placeholder='לדוגמה: "תיק 45812-06-26 בעניין כהן נכסים בע"מ — נקבע דיון ליום 28/11/2026. על המבקש להגיש תגובה תוך 14 ימים..."'
              className="w-full p-3 rounded-xl border-2 border-blue-300 focus:border-blue-600 bg-blue-50/30 text-sm text-slate-900 font-medium outline-none transition"
            />
          </div>

          {/* בחירה: שיוך לתיק קיים או פתיחת תיק חדש */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition ${
                mode === 'existing'
                  ? 'bg-[#0F172A] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              שייך ועדכן תיק קיים ({cases.filter((c) => !c.is_archived).length})
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1 ${
                mode === 'new'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>פתח תיק חדש מהודעה זו (גם ללא מספר תיק)</span>
            </button>
          </div>

          {mode === 'existing' ? (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-extrabold text-slate-800">
                  בחר תיק לשיוך ההחלטה / העדכון:
                </label>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={caseSearchQuery}
                    onChange={(e) => setCaseSearchQuery(e.target.value)}
                    placeholder="חפש תיק לפי שם, נושא או מספר..."
                    className="w-full pr-8 pl-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {filteredExistingCases.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 flex items-center justify-between">
                  <span>לא נמצאו תיקים קיימים במערכת.</span>
                  <button
                    type="button"
                    onClick={() => setMode('new')}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-extrabold"
                  >
                    עבור לפתיחת תיק חדש ➔
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                  {filteredExistingCases.map((c) => {
                    const isSelected = c.id === selectedCaseId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCaseId(c.id);
                          setCategory(c.category);
                        }}
                        className={`p-2 rounded-lg border text-right text-xs transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 text-blue-950 font-extrabold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="truncate">
                          <span className="font-extrabold">{c.debtor_name}</span>
                          {c.case_number ? (
                            <span className="text-[11px] font-mono text-slate-500 mr-1.5">
                              ({c.case_number})
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 mr-1.5">
                              (ללא מס׳ תיק)
                            </span>
                          )}
                        </div>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold shrink-0">
                          {c.category}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  שם לקוח / חייב / עניין *
                </label>
                <input
                  type="text"
                  required={mode === 'new'}
                  value={debtorName}
                  onChange={(e) => setDebtorName(e.target.value)}
                  placeholder="למשל: כהן נכסים בע״מ"
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  קטגוריה *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CaseCategory)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                >
                  {CASE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat].shortTitle}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-800 mb-1">
                  מספר תיק (רשות — זוהה אוטומטית)
                </label>
                <input
                  type="text"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="ניתן להשאיר ריק ולהשלים בהמשך"
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                />
              </div>
            </div>
          )}

          {/* פרטי הזיהוי שנשלפו מהטקסט */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Gavel className="w-4 h-4 text-blue-700" />
                נתונים שזוהו לעדכון בתיק וביומן:
              </span>
              {nextDueDate && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-extrabold flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5" />
                  מועד שזוהה: {formatDateHe(nextDueDate)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  נושא ההחלטה / המשימה לביצוע
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="תמצית ההחלטה או הפעולה הנדרשת"
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  סוג פעולה (דיון / הגשה / תגובה)
                </label>
                <select
                  value={nextActionType}
                  onChange={(e) =>
                    setNextActionType(e.target.value as NextActionType)
                  }
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                >
                  {NEXT_ACTION_TYPES.map((act) => (
                    <option key={act} value={act}>
                      {act}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  תאריך יעד / מועד דיון
                </label>
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  סטטוס מעקב נט המשפט
                </label>
                <select
                  value={netStatus}
                  onChange={(e) =>
                    setNetStatus(e.target.value as NetHaMishpatStatus)
                  }
                  className="w-full p-2 text-xs rounded-lg border border-indigo-300 bg-indigo-50/50 text-indigo-950 font-extrabold"
                >
                  {NET_HAMISHPAT_STATUSES.map((ns) => (
                    <option key={ns} value={ns}>
                      {ns}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  סטטוס תיק
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CaseStatus)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                >
                  {CASE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ימי היערכות מראש
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={prepDaysNeeded}
                  onChange={(e) =>
                    setPrepDaysNeeded(Number(e.target.value) || 0)
                  }
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addAsTask}
                  onChange={(e) => setAddAsTask(e.target.checked)}
                  className="rounded text-blue-600"
                />
                <span>הוסף אוטומטית לרשימת &quot;משימות לביצוע&quot; בתיק</span>
              </label>

              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markPostponed}
                  onChange={(e) => setMarkPostponed(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>סמן כדיון שנדחה / בוטל (מעדכן מונה דחיות והיסטוריה)</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={
                saving ||
                (mode === 'existing' && !selectedCase) ||
                (mode === 'new' && !debtorName.trim() && !subject.trim())
              }
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition"
            >
              <Check className="w-4 h-4" />
              <span>
                {mode === 'existing'
                  ? 'אשר ושייך לתיק + רשום ביומן הכרונולוגי'
                  : 'פתח תיק חדש ושמור ביומן הכרונולוגי'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
