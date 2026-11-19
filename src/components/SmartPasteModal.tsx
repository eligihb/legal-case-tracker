'use client';

import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  ClipboardPaste,
  Gavel,
  HelpCircle,
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
  enableNetHaMishpat: boolean;
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
  let matchedCaseToken = '';
  const caseRegex =
    /(?:ת"א|תא"מ|חדל"פ|פש"ר|פר"ק|הוצל"פ|תיק|מס['׳]?)\s*[:\-]?\s*(\d{3,7}-\d{2}-\d{2,4})|(\b\d{4,7}-\d{2}-\d{2,4}\b)/;
  const caseMatch = text.match(caseRegex);
  if (caseMatch) {
    caseNumber = (caseMatch[1] || caseMatch[2] || '').trim();
    matchedCaseToken = caseMatch[0];
  }

  // 2. זיהוי תאריך מפורש (DD/MM/YYYY או DD.MM.YYYY) או ביטויי זמן יחסיים בעברית:
  // "לעוד X ימים" / "בעוד X ימים" / "תוך X ימים" / "מחר" / "מחרתיים" / "בעוד שבוע" / "בעוד שבועיים" / "בעוד חודש"
  let detectedDate = '';
  let matchedDateToken = '';
  const dateRegex = /\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2}|\d{2})\b/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year =
      dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) <= 31) {
      detectedDate = `${year}-${month}-${day}`;
      matchedDateToken = dateMatch[0];
    }
  }

  if (!detectedDate) {
    const relDaysRegex = /(?:לעוד|בעוד|תוך)\s+(\d{1,3})\s+(?:יום|ימים)/;
    const relDaysMatch = text.match(relDaysRegex);
    if (relDaysMatch) {
      const days = Number(relDaysMatch[1]) || 7;
      detectedDate = addDaysToDateStr(todayStr, days) || '';
      matchedDateToken = relDaysMatch[0];
    } else if (/(?:לעוד|בעוד)\s+שבועיים/.test(text)) {
      const m = text.match(/(?:לעוד|בעוד)\s+שבועיים/);
      detectedDate = addDaysToDateStr(todayStr, 14) || '';
      matchedDateToken = m ? m[0] : '';
    } else if (/(?:לעוד|בעוד)\s+שבוע\b/.test(text)) {
      const m = text.match(/(?:לעוד|בעוד)\s+שבוע\b/);
      detectedDate = addDaysToDateStr(todayStr, 7) || '';
      matchedDateToken = m ? m[0] : '';
    } else if (/(?:לעוד|בעוד)\s+חודש\b/.test(text)) {
      const m = text.match(/(?:לעוד|בעוד)\s+חודש\b/);
      detectedDate = addDaysToDateStr(todayStr, 30) || '';
      matchedDateToken = m ? m[0] : '';
    } else if (/\bמחרתיים\b/.test(text)) {
      detectedDate = addDaysToDateStr(todayStr, 2) || '';
      matchedDateToken = 'מחרתיים';
    } else if (/\bמחר\b/.test(text)) {
      detectedDate = addDaysToDateStr(todayStr, 1) || '';
      matchedDateToken = 'מחר';
    }
  }

  // 3. זיהוי הקשר נט המשפט / בית משפט (מופעל אך ורק כשמזוהה הקשר של נט המשפט / בית משפט)
  const isCourtOrNetContext =
    /נט המשפט|ביהמ"ש|בית המשפט|כבוד השופט|השופט|הרשם|החלטת|החלטה|פסק דין|צו|דיון/.test(
      text
    );

  // 4. הפרדה אוטומטית בין סוגי פעולות: דיון | הגשה לביהמ"ש / תגובה | תזכורת | משימת מעקב
  let nextActionType: NextActionType = 'משימת מעקב';
  let netStatus: NetHaMishpatStatus = 'ללא מעקב פעיל';
  let suggestedStatus: CaseStatus = 'פעיל';
  let logType: LogType = 'הערה';
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
    netStatus =
      text.includes('צד שכנגד') || text.includes('המשיב')
        ? 'נדרשת תגובת צד שכנגד'
        : 'התקבלה החלטה';
    logType = 'החלטת ביהמ"ש';
    prepDays = 5;
  } else if (
    text.includes('הגשה') ||
    text.includes('הגשת') ||
    text.includes('ביהמ"ש')
  ) {
    nextActionType = 'הגשה לביהמ"ש';
    suggestedStatus = 'הגשה ממתינה לביהמ"ש';
    netStatus = 'הוגשה בקשה בנט המשפט';
    logType = 'החלטת ביהמ"ש';
  } else if (text.includes('תזכורת')) {
    nextActionType = 'תזכורת';
    logType = 'תזכורת אישית/מועד';
  } else if (text.includes('משימת') || text.includes('מעקב')) {
    nextActionType = 'משימת מעקב';
    logType = 'תזכורת אישית/מועד';
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

  if (text.includes('ממתין להחלטת') || text.includes('נט המשפט')) {
    netStatus = 'ממתין להחלטת שופט/רשם';
    if (suggestedStatus === 'פעיל') {
      suggestedStatus = 'ממתין להחלטה';
    }
  }

  if (!isCourtOrNetContext) {
    netStatus = 'ללא מעקב פעיל';
  }

  // 5. חילוץ שם מדויק (Strict Name Boundary):
  // עוצר מיד ברגע שמופיעה מילת פעולה, סטטוס או פיסוק (משימת, מעקב, תזכורת, דיון, הגשה, תגובה, ממתין, בתיק, לעוד, בעוד, או פסיק/מקף)
  // למשל: "שם אלפוסו מאיר משימת מעקב לעוד 14 ימים" -> "אלפוסו מאיר"
  let detectedPartyName = '';
  let matchedPartyPrefixToken = '';
  const partyRegex =
    /(?:שם(?:\s+הלקוח|\s+החייב)?|חייב|לקוח|בעניין|החייב|התובע|הנתבע|המבקש|המשיב|חברת|נגד)\s*[:\-]?\s*([א-ת0-9"״'׳\s().-]{2,60})/;
  const partyMatch = text.match(partyRegex);
  if (partyMatch && partyMatch[1]) {
    const rawCandidate = partyMatch[1];
    const stoppedCandidate = rawCandidate
      .split(
        /(?:\s+(?:משימת|משימה|מעקב|תזכורת|דיון|הגשה|הגשת|תגובה|תשובה|ממתין|ממתינה|בתיק|תיק|לעוד|בעוד|תוך|מחר|מחרתיים|נט)\b|[,\n.;–—\-])/
      )[0]
      .trim();
    if (stoppedCandidate.length >= 2) {
      detectedPartyName = stoppedCandidate;
      const prefixOnly = partyMatch[0].split(rawCandidate)[0] || '';
      matchedPartyPrefixToken = `${prefixOnly}${stoppedCandidate}`;
    }
  }

  // 6. ניקוי תיאור המשימה ("נושא ההחלטה / המשימה לביצוע"):
  // מסיר את השם, מספר התיק וביטוי הזמן שכבר חולצו לשדות הייעודיים
  const firstLine =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 2) || '';

  let cleanedSubject = firstLine;
  if (matchedCaseToken) {
    cleanedSubject = cleanedSubject.replace(matchedCaseToken, ' ');
  }
  if (caseNumber) {
    cleanedSubject = cleanedSubject.replace(caseNumber, ' ');
  }
  if (matchedDateToken) {
    cleanedSubject = cleanedSubject.replace(matchedDateToken, ' ');
  }
  if (matchedPartyPrefixToken) {
    cleanedSubject = cleanedSubject.replace(matchedPartyPrefixToken, ' ');
  }
  cleanedSubject = cleanedSubject
    .replace(/^(?:תיק|בתיק|מס['׳]?)\s*[:\-]?\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,\-–—:.]+|[\s,\-–—:.]+$/g, '')
    .trim();

  if (!cleanedSubject) {
    cleanedSubject = nextActionType;
  }

  const subjectSummary =
    cleanedSubject.length > 95
      ? `${cleanedSubject.slice(0, 95)}...`
      : cleanedSubject;

  return {
    caseNumber,
    detectedDate,
    detectedPartyName,
    subjectSummary,
    nextActionType,
    netStatus,
    enableNetHaMishpat: isCourtOrNetContext,
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
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [caseSearchQuery, setCaseSearchQuery] = useState('');

  // שדות תצוגה מקדימה הניתנים לעריכה לפני שמירה
  const [debtorName, setDebtorName] = useState('');
  const [subject, setSubject] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [category, setCategory] = useState<CaseCategory>('גבייה');
  const [nextActionType, setNextActionType] =
    useState<NextActionType>('משימת מעקב');
  const [nextDueDate, setNextDueDate] = useState('');
  const [netTrackingEnabled, setNetTrackingEnabled] = useState<boolean>(false);
  const [netStatus, setNetStatus] =
    useState<NetHaMishpatStatus>('ללא מעקב פעיל');
  const [status, setStatus] = useState<CaseStatus>('פעיל');
  const [addAsTask, setAddAsTask] = useState(true);
  const [markPostponed, setMarkPostponed] = useState(false);
  const [prepDaysNeeded, setPrepDaysNeeded] = useState(7);
  const [saving, setSaving] = useState(false);

  const handlePasteTextChange = (text: string) => {
    setRawText(text);
    if (!text.trim()) return;

    const parsed = parseHebrewLegalText(text);
    setCaseNumber(parsed.caseNumber);
    if (parsed.detectedDate) setNextDueDate(parsed.detectedDate);
    if (parsed.subjectSummary) setSubject(parsed.subjectSummary);
    setNextActionType(parsed.nextActionType);
    setNetTrackingEnabled(parsed.enableNetHaMishpat);
    setNetStatus(
      parsed.enableNetHaMishpat ? parsed.netStatus : 'ללא מעקב פעיל'
    );
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
        parsed.detectedPartyName &&
        c.debtor_name &&
        c.debtor_name.includes(parsed.detectedPartyName)
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
      if (parsed.detectedPartyName) {
        setDebtorName(parsed.detectedPartyName);
      }
      setMode('new');
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
          (c.stage_note || c.subject || '').toLowerCase().includes(q) ||
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
      const effectiveNetStatus: NetHaMishpatStatus = netTrackingEnabled
        ? netStatus
        : 'ללא מעקב פעיל';

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
          stage_note: taskTitle,
          status,
          net_hamishpat_status: effectiveNetStatus,
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
          log_type: markPostponed
            ? 'בקשת ארכה / דחיית דיון'
            : netTrackingEnabled
            ? 'החלטת ביהמ"ש'
            : 'תזכורת אישית/מועד',
          content: `[קליטה חכמה] ${rawText.trim() || taskTitle}`,
          due_date: nextDueDate || null,
        });

        onCaseUpdatedOrCreated(updated, false);
        onClose();
      } else {
        const finalName =
          debtorName.trim() || subject.trim() || 'תיק חדש מקליטה חכמה';
        const initialMilestones: CaseMilestone[] = addAsTask
          ? [
              {
                id: generateId(),
                title: taskTitle,
                status: 'in_progress',
                urgency: 'גבוהה',
                due_date: nextDueDate || null,
                started_at: today,
                completed_at: null,
              },
            ]
          : [];

        const created = await createCaseItem({
          debtor_name: finalName,
          current_stage: `${nextActionType} — בטיפול`,
          stage_note: taskTitle,
          id_or_hp: '',
          case_number: caseNumber.trim(),
          category,
          status,
          net_hamishpat_status: effectiveNetStatus,
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
          log_type: netTrackingEnabled ? 'החלטת ביהמ"ש' : 'תזכורת אישית/מועד',
          content: `[פתיחת תיק מקליטה חכמה] ${rawText.trim() || taskTitle}`,
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
        {/* כותרת נקייה עם אייקון ? להסבר ודוגמאות */}
        <div className="px-5 py-3.5 bg-[#0F172A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <ClipboardPaste className="w-4 h-4" />
            </div>
            <h2 className="text-base font-extrabold">
              קליטה חכמה (מייל / נט המשפט)
            </h2>
            <button
              type="button"
              onClick={() => setShowHelpTooltip((v) => !v)}
              title="הצג הנחיות ודוגמאות לקליטה חכמה"
              className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/25 text-sky-300 flex items-center justify-center text-xs font-extrabold transition"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* חלונית עזרה קומפקטית שנפתחת רק בלחיצה על ? */}
        {showHelpTooltip && (
          <div className="px-5 py-3 bg-blue-950 text-blue-100 text-xs space-y-1 border-b border-blue-800">
            <div className="font-extrabold text-white">
              איך עובדת הקליטה החכמה?
            </div>
            <p>
              הדבק שורה חופשית או הודעה מנט המשפט/מייל. המערכת מחלצת אוטומטית את{' '}
              <strong>שם הלקוח/החייב</strong> (ועוצרת במילת המשימה),{' '}
              <strong>מספר תיק</strong>, <strong>סוג פעולה</strong> ו-
              <strong>תאריך יחסי או מפורש</strong> (`לעוד 14 ימים`, `מחר`, `בעוד שבוע`, `28/11/2026`).
            </p>
            <div className="text-sky-300 font-mono text-[11px]">
              דוגמה 1: &quot;שם אלפוסו מאיר משימת מעקב לעוד 14 ימים&quot; • דוגמה 2: &quot;תיק 45812-06-26 בעניין כהן נכסים — נקבע דיון ליום 28/11/2026&quot;
            </div>
          </div>
        )}

        <form
          onSubmit={handleConfirmCapture}
          className="p-5 space-y-4 overflow-y-auto flex-1"
        >
          {/* תיבת הדבקה מרכזית */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>הדבק טקסט (Ctrl+V):</span>
              </label>
              {rawText && (
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  className="text-xs text-slate-500 hover:text-red-600 font-bold"
                >
                  נקה
                </button>
              )}
            </div>
            <textarea
              rows={3}
              autoFocus
              value={rawText}
              onChange={(e) => handlePasteTextChange(e.target.value)}
              placeholder='הדבק או הקלד כאן (למשל: "שם אלפוסו מאיר משימת מעקב לעוד 14 ימים")...'
              className="w-full p-3 rounded-xl border-2 border-blue-300 focus:border-blue-600 bg-blue-50/30 text-sm text-slate-900 font-medium outline-none transition"
            />
          </div>

          {/* בחירה קצרה ונקייה: שיוך לתיק קיים או פתיחת תיק חדש */}
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
              שיוך לתיק קיים ({cases.filter((c) => !c.is_archived).length})
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
              <span>פתיחת תיק חדש</span>
            </button>
          </div>

          {mode === 'existing' ? (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-extrabold text-slate-800">
                  בחר תיק:
                </label>
                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={caseSearchQuery}
                    onChange={(e) => setCaseSearchQuery(e.target.value)}
                    placeholder="סינון לפי שם או מספר תיק..."
                    className="w-full pr-8 pl-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {filteredExistingCases.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 flex items-center justify-between">
                  <span>לא נמצאו תיקים תואמים.</span>
                  <button
                    type="button"
                    onClick={() => setMode('new')}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-extrabold"
                  >
                    פתיחת תיק חדש ➔
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                  {filteredExistingCases.map((c) => {
                    const isSelected = c.id === selectedCaseId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCaseId(c.id);
                          setDebtorName(c.debtor_name);
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
                          ) : null}
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
                  שם לקוח / חייב *
                </label>
                <input
                  type="text"
                  required={mode === 'new'}
                  value={debtorName}
                  onChange={(e) => setDebtorName(e.target.value)}
                  placeholder="למשל: אלפוסו מאיר"
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
                  מספר תיק (רשות)
                </label>
                <input
                  type="text"
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="אופציונלי"
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                />
              </div>
            </div>
          )}

          {/* תצוגה מקדימה ברורה לעריכה לפני שמירה */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                <Gavel className="w-4 h-4 text-blue-700" />
                תצוגה מקדימה של הנתונים שזוהו (ניתן לערוך לפני שמירה):
              </span>
              {nextDueDate && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-extrabold flex items-center gap-1">
                  <CalendarClock className="w-3.5 h-3.5" />
                  תאריך יעד: {formatDateHe(nextDueDate)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  תיאור המשימה / ההחלטה (נוקה אוטומטית)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="תמצית המשימה או ההחלטה"
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  סוג פעולה
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

              {/* סטטוס מעקב נט המשפט — כבוי כברירת מחדל במייל רגיל, נדלק רק בהקשר בימ"ש/נט המשפט או בסימון יזום */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-indigo-950 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={netTrackingEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setNetTrackingEnabled(checked);
                        if (checked && netStatus === 'ללא מעקב פעיל') {
                          setNetStatus('ממתין להחלטת שופט/רשם');
                        } else if (!checked) {
                          setNetStatus('ללא מעקב פעיל');
                        }
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span>הפעל מעקב נט המשפט / ביהמ&quot;ש</span>
                  </label>
                  {!netTrackingEnabled && (
                    <span className="text-[10px] text-slate-400 font-bold">
                      (כבוי למייל/משימה רגילה)
                    </span>
                  )}
                </div>
                <select
                  disabled={!netTrackingEnabled}
                  value={netTrackingEnabled ? netStatus : 'ללא מעקב פעיל'}
                  onChange={(e) =>
                    setNetStatus(e.target.value as NetHaMishpatStatus)
                  }
                  className={`w-full p-2 text-xs rounded-lg border font-extrabold transition ${
                    netTrackingEnabled
                      ? 'border-indigo-300 bg-indigo-50/50 text-indigo-950'
                      : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
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
                <span>הוסף למשימות לביצוע בתיק</span>
              </label>

              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markPostponed}
                  onChange={(e) => setMarkPostponed(e.target.checked)}
                  className="rounded text-rose-600"
                />
                <span>סמן כדיון שנדחה / בוטל</span>
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
                {mode === 'existing' ? 'שמור ועדכן תיק' : 'פתיחת תיק חדש'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
