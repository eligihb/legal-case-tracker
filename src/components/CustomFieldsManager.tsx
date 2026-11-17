'use client';

import React, { useEffect, useState } from 'react';
import {
  Bell,
  Calendar,
  CheckSquare,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Type,
  X,
  Globe,
  FileCheck2,
} from 'lucide-react';
import {
  CASE_CATEGORIES,
  CATEGORY_LABELS,
  CaseCategory,
  CaseCustomField,
  CaseItem,
  CustomFieldScope,
  CustomFieldType,
} from '@/types/database';
import {
  createCustomFieldAndApply,
  deleteCustomFieldFromCases,
  updateCustomFieldInline,
} from '@/lib/dataService';

interface AddCustomFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory: CaseCategory;
  targetCase?: CaseItem | null;
  allCases: CaseItem[];
  onCasesUpdated: (updatedCases: CaseItem[]) => void;
}

const QUICK_FIELD_PRESETS: {
  label: string;
  type: CustomFieldType;
}[] = [
  { label: 'תזכורת מעקב בתיק', type: 'reminder' },
  { label: 'אישור לקוח / רשות', type: 'boolean' },
  { label: 'מועד בדיקה הבא', type: 'date' },
  { label: 'סטטוס טיפול מיוחד', type: 'text' },
  { label: 'הוגשה תגובה לביהמ"ש', type: 'boolean' },
  { label: 'תזכורת הגשת מסמכים', type: 'reminder' },
];

export function AddCustomFieldModal({
  isOpen,
  onClose,
  defaultCategory,
  targetCase,
  allCases,
  onCasesUpdated,
}: AddCustomFieldModalProps) {
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('reminder');
  const [textValue, setTextValue] = useState('');
  const [boolValue, setBoolValue] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [scope, setScope] = useState<CustomFieldScope>(
    targetCase ? 'case' : 'category'
  );
  const [selectedCategory, setSelectedCategory] =
    useState<CaseCategory>(defaultCategory);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    targetCase?.id || ''
  );

  useEffect(() => {
    if (!isOpen) return;
    setLabel('');
    setFieldType('reminder');
    setTextValue('');
    setBoolValue(false);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    setDueDate(tomorrow.toISOString().split('T')[0]);
    setSelectedCategory(targetCase?.category || defaultCategory);
    if (targetCase) {
      setSelectedCaseId(targetCase.id);
      setScope('case');
    } else {
      const firstInCat = allCases.find((c) => c.category === defaultCategory);
      setSelectedCaseId(firstInCat?.id || allCases[0]?.id || '');
      setScope('category');
    }
  }, [isOpen, targetCase, defaultCategory, allCases]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    let initialVal: string | boolean = '';
    if (fieldType === 'boolean') {
      initialVal = boolValue;
    } else if (fieldType === 'date') {
      initialVal = dueDate;
    } else {
      initialVal = textValue.trim();
    }

    const updatedCases = await createCustomFieldAndApply({
      label: label.trim(),
      field_type: fieldType,
      initial_value: initialVal,
      due_date:
        fieldType === 'reminder' || fieldType === 'date'
          ? dueDate || null
          : null,
      scope,
      target_case_id:
        scope === 'case' ? targetCase?.id || selectedCaseId : null,
      target_category:
        scope === 'category'
          ? selectedCategory
          : targetCase?.category || defaultCategory,
    });

    onCasesUpdated(updatedCases);
    onClose();
  };

  const categoryCasesCount = allCases.filter(
    (c) => c.category === selectedCategory
  ).length;

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 no-print"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="px-5 py-4 bg-gradient-to-l from-indigo-950 via-blue-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold">
                + הוסף שדה מעקב / תזכורת מותאמת אישית
              </h3>
              <p className="text-xs text-blue-200">
                עריכה מהירה מתוך הרשימה והכרטיסייה (Inline Quick-Edit) + החלה גורפת בקליק
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* תבניות מהירות בקליק */}
          <div>
            <span className="block text-xs font-extrabold text-slate-600 mb-1.5">
              בחירה מהירה מתבנית מוכנה (או הקלד חופשי למטה):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_FIELD_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setLabel(preset.label);
                    setFieldType(preset.type);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 transition"
                >
                  + {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* 1. שם השדה / התזכורת */}
          <div>
            <label className="block text-sm font-extrabold text-slate-800 mb-1">
              שם שדה המעקב או התזכורת *
            </label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="למשל: בדיקת ערבות בנקאית / תזכורת להגשת תגובה / אושר ע״י גזבר..."
              className="w-full p-2.5 text-[15px] rounded-xl border border-slate-300 focus:border-blue-600 outline-none font-bold"
              autoFocus
            />
          </div>

          {/* 2. סוג השדה */}
          <div>
            <label className="block text-sm font-extrabold text-slate-800 mb-1.5">
              סוג השדה לעריכה מהירה (Inline Quick-Edit):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFieldType('reminder')}
                className={`p-2.5 rounded-xl border text-xs font-extrabold flex flex-col items-center gap-1 transition ${
                  fieldType === 'reminder'
                    ? 'bg-amber-50 border-amber-500 text-amber-950 ring-2 ring-amber-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Bell className="w-4 h-4 text-amber-600" />
                <span>תזכורת עם מועד</span>
              </button>

              <button
                type="button"
                onClick={() => setFieldType('text')}
                className={`p-2.5 rounded-xl border text-xs font-extrabold flex flex-col items-center gap-1 transition ${
                  fieldType === 'text'
                    ? 'bg-blue-50 border-blue-600 text-blue-950 ring-2 ring-blue-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Type className="w-4 h-4 text-blue-600" />
                <span>שדה טקסט</span>
              </button>

              <button
                type="button"
                onClick={() => setFieldType('date')}
                className={`p-2.5 rounded-xl border text-xs font-extrabold flex flex-col items-center gap-1 transition ${
                  fieldType === 'date'
                    ? 'bg-indigo-50 border-indigo-600 text-indigo-950 ring-2 ring-indigo-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>שדה תאריך</span>
              </button>

              <button
                type="button"
                onClick={() => setFieldType('boolean')}
                className={`p-2.5 rounded-xl border text-xs font-extrabold flex flex-col items-center gap-1 transition ${
                  fieldType === 'boolean'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-950 ring-2 ring-emerald-200'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                <span>כן / לא (מתג)</span>
              </button>
            </div>
          </div>

          {/* 3. ערך התחלתי / מועד יעד */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            {fieldType === 'text' && (
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  ערך התחלתי (אופציונלי — ניתן לערוך ישירות מהטבלה/כרטיסייה):
                </label>
                <input
                  type="text"
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  placeholder="הקלד תוכן התחלתי..."
                  className="w-full p-2 text-sm rounded-lg border border-slate-300 bg-white font-bold"
                />
              </div>
            )}

            {fieldType === 'boolean' && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-700">
                  מצב התחלתי של המתג (ניתן להחליף בקליק מהרשימה):
                </span>
                <button
                  type="button"
                  onClick={() => setBoolValue(!boolValue)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                    boolValue
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {boolValue ? 'כן ✓' : 'לא'}
                </button>
              </div>
            )}

            {fieldType === 'date' && (
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  תאריך:
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-2 text-sm rounded-lg border border-slate-300 bg-white font-bold"
                />
              </div>
            )}

            {fieldType === 'reminder' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    מועד התזכורת:
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-2 text-sm rounded-lg border border-amber-400 bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    הערה / פירוט לתזכורת:
                  </label>
                  <input
                    type="text"
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder="פרטים נוספים לביצוע..."
                    className="w-full p-2 text-sm rounded-lg border border-slate-300 bg-white font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. בחירת היקף ההחלה בלחיצה (Scope) */}
          <div>
            <label className="block text-sm font-extrabold text-slate-900 mb-1.5">
              בחר בלחיצה את היקף ההחלה של השדה / התזכורת:
            </label>
            <div className="grid grid-cols-1 gap-2">
              {/* אפשרות א: רק על התיק הספציפי הזה */}
              <div
                onClick={() => setScope('case')}
                className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-center justify-between gap-2 ${
                  scope === 'case'
                    ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-100'
                    : 'bg-white border-slate-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <FileCheck2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-slate-900">
                      1. החלה רק על התיק הספציפי הזה
                    </div>
                    {targetCase ? (
                      <div className="text-xs text-blue-800 font-bold truncate">
                        תיק נבחר: {targetCase.debtor_name} (
                        {targetCase.case_number || 'ללא מס׳'})
                      </div>
                    ) : (
                      <select
                        value={selectedCaseId}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          setSelectedCaseId(e.target.value);
                          setScope('case');
                        }}
                        className="mt-1 w-full p-1.5 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                      >
                        {allCases.map((c) => (
                          <option key={c.id} value={c.id}>
                            [{c.category}] {c.debtor_name} ({c.case_number})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 shrink-0">
                  תיק 1
                </span>
              </div>

              {/* אפשרות ב: על כל התיקים באותה קטגוריה */}
              <div
                onClick={() => setScope('category')}
                className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-center justify-between gap-2 ${
                  scope === 'category'
                    ? 'bg-purple-50/80 border-purple-600 ring-2 ring-purple-100'
                    : 'bg-white border-slate-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Layers className="w-5 h-5 text-purple-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-slate-900">
                      2. החלה אוטומטית על כל התיקים באותה קטגוריה
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-600 font-bold">
                        קטגוריה:
                      </span>
                      <select
                        value={selectedCategory}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          setSelectedCategory(e.target.value as CaseCategory);
                          setScope('category');
                        }}
                        className="p-1 text-xs rounded-lg border border-purple-300 bg-white font-extrabold text-purple-900"
                      >
                        {CASE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {CATEGORY_LABELS[cat].shortTitle}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 shrink-0">
                  {categoryCasesCount} תיקים
                </span>
              </div>

              {/* אפשרות ג: על כלל התיקים במערכת */}
              <div
                onClick={() => setScope('all')}
                className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-center justify-between gap-2 ${
                  scope === 'all'
                    ? 'bg-emerald-50/80 border-emerald-600 ring-2 ring-emerald-100'
                    : 'bg-white border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Globe className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">
                      3. החלה גורפת על כלל התיקים במערכת
                    </div>
                    <div className="text-xs text-slate-600 font-semibold">
                      יוסיף את השדה/התזכורת לכל התיקים בכל 4 התחומים במערכת
                    </div>
                  </div>
                </div>
                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 shrink-0">
                  כל {allCases.length} התיקים
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-extrabold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              {scope === 'case'
                ? 'הוסף לתיק זה'
                : scope === 'category'
                ? `החל על כל תיקי ${selectedCategory} (${categoryCasesCount})`
                : `החל על כלל התיקים במערכת (${allCases.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// רכיב עריכה מהירה (Inline Quick-Edit) של שדות מעקב ותזכורות בתוך שורת תיק / כרטיסייה
// ============================================================================
interface InlineCustomFieldsListProps {
  caseItem: CaseItem;
  onCasesUpdated: (updatedCases: CaseItem[]) => void;
  onOpenAddModal: (targetCase: CaseItem) => void;
  compact?: boolean;
}

export function InlineCustomFieldsList({
  caseItem,
  onCasesUpdated,
  onOpenAddModal,
  compact = false,
}: InlineCustomFieldsListProps) {
  const fields = caseItem.custom_fields || [];

  const handleFieldUpdate = async (
    e: React.SyntheticEvent,
    fieldId: string,
    updates: Partial<
      Pick<CaseCustomField, 'value' | 'due_date' | 'is_done' | 'label'>
    >
  ) => {
    e.stopPropagation();
    const updated = await updateCustomFieldInline(
      caseItem.id,
      fieldId,
      updates
    );
    onCasesUpdated(updated);
  };

  const handleFieldDelete = async (
    e: React.MouseEvent,
    field: CaseCustomField
  ) => {
    e.stopPropagation();
    let removeAll = false;
    if (field.scope === 'category' || field.scope === 'all') {
      removeAll = window.confirm(
        `שדה "${field.label}" הוחל באופן גורף. ללחוץ "אישור" למחיקה מכל התיקים, או "ביטול" למחיקה מתיק זה בלבד.`
      );
    }
    const updated = await deleteCustomFieldFromCases(
      caseItem.id,
      field.id,
      field.field_key,
      removeAll
    );
    onCasesUpdated(updated);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 mt-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {fields.map((f) => {
        if (f.field_type === 'boolean') {
          const isTrue = Boolean(f.value);
          return (
            <div
              key={f.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-extrabold transition ${
                isTrue
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              <button
                type="button"
                onClick={(e) => handleFieldUpdate(e, f.id, { value: !isTrue })}
                className="inline-flex items-center gap-1 hover:opacity-80"
                title="לחץ להחלפת כן/לא (Inline Quick-Edit)"
              >
                <span>{f.label}:</span>
                <span
                  className={`px-1.5 py-0.2 rounded ${
                    isTrue
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {isTrue ? 'כן ✓' : 'לא'}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => handleFieldDelete(e, f)}
                className="text-slate-400 hover:text-red-600 mr-0.5"
                title="מחק שדה"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        }

        if (f.field_type === 'date') {
          return (
            <div
              key={f.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-indigo-200 bg-indigo-50/70 text-indigo-950 text-xs font-bold"
            >
              <Calendar className="w-3 h-3 text-indigo-600 shrink-0" />
              <span className="font-extrabold">{f.label}:</span>
              <input
                type="date"
                value={String(f.value || f.due_date || '')}
                onChange={(e) =>
                  handleFieldUpdate(e, f.id, {
                    value: e.target.value,
                    due_date: e.target.value,
                  })
                }
                className="bg-white border border-indigo-200 rounded px-1 py-0.5 text-[11px] font-bold outline-none"
              />
              <button
                type="button"
                onClick={(e) => handleFieldDelete(e, f)}
                className="text-slate-400 hover:text-red-600"
                title="מחק שדה"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        }

        if (f.field_type === 'reminder') {
          const done = Boolean(f.is_done);
          return (
            <div
              key={f.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-bold transition ${
                done
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 line-through opacity-80'
                  : 'bg-amber-50 border-amber-300 text-amber-950'
              }`}
            >
              <button
                type="button"
                onClick={(e) => handleFieldUpdate(e, f.id, { is_done: !done })}
                className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] font-extrabold shrink-0 ${
                  done
                    ? 'bg-emerald-600 border-emerald-700 text-white'
                    : 'bg-white border-amber-400 text-amber-700'
                }`}
                title="סמן תזכורת כבוצעה"
              >
                {done ? '✓' : '⏰'}
              </button>
              <span className="font-extrabold">{f.label}:</span>
              <input
                type="text"
                value={String(f.value || '')}
                onChange={(e) =>
                  handleFieldUpdate(e, f.id, { value: e.target.value })
                }
                placeholder="הערה..."
                className="bg-white/90 border border-amber-200 rounded px-1.5 py-0.5 text-[11px] font-bold w-24 outline-none focus:w-36 transition-all"
              />
              <input
                type="date"
                value={f.due_date || ''}
                onChange={(e) =>
                  handleFieldUpdate(e, f.id, { due_date: e.target.value })
                }
                className="bg-white/90 border border-amber-200 rounded px-1 py-0.5 text-[11px] font-bold outline-none"
              />
              <button
                type="button"
                onClick={(e) => handleFieldDelete(e, f)}
                className="text-slate-400 hover:text-red-600"
                title="מחק תזכורת"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        }

        // default: 'text'
        return (
          <div
            key={f.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-blue-200 bg-blue-50/60 text-blue-950 text-xs font-bold"
          >
            <span className="font-extrabold">{f.label}:</span>
            <input
              type="text"
              value={String(f.value || '')}
              onChange={(e) =>
                handleFieldUpdate(e, f.id, { value: e.target.value })
              }
              placeholder="הקלד..."
              className="bg-white border border-blue-200 rounded px-1.5 py-0.5 text-[11px] font-bold w-24 focus:w-40 outline-none transition-all"
            />
            <button
              type="button"
              onClick={(e) => handleFieldDelete(e, f)}
              className="text-slate-400 hover:text-red-600"
              title="מחק שדה"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenAddModal(caseItem);
        }}
        className={`inline-flex items-center gap-1 rounded-lg border border-dashed border-indigo-400 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-900 font-extrabold transition no-print ${
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        }`}
        title="הוסף שדה מעקב או תזכורת (לתיק זה, לכל הקטגוריה או לכל התיקים)"
      >
        <Plus className="w-3 h-3 text-indigo-700" />
        <span>+ שדה מעקב / תזכורת</span>
      </button>
    </div>
  );
}
