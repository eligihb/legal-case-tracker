'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Building2,
  Plus,
  Save,
  Trash2,
  ShieldAlert,
  Percent,
  FileText,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import {
  FEE_CALCULATION_METHODS,
  FeeCalculationMethod,
  MunicipalitySetting,
} from '@/types/database';
import {
  deleteMunicipalitySetting,
  saveMunicipalitySetting,
} from '@/lib/dataService';
import { formatDateTimeHe } from '@/lib/dateUtils';

interface MunicipalitiesSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: MunicipalitySetting[];
  onSettingsChanged: (updatedList: MunicipalitySetting[]) => void;
  isAdmin: boolean;
}

export default function MunicipalitiesSettingsModal({
  isOpen,
  onClose,
  settings,
  onSettingsChanged,
  isAdmin,
}: MunicipalitiesSettingsModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [municipalityName, setMunicipalityName] = useState('');
  const [feeMethod, setFeeMethod] = useState<FeeCalculationMethod>('אחוזים');
  const [feeRateValue, setFeeRateValue] = useState<number>(15);
  const [feeTariffDescription, setFeeTariffDescription] = useState('');
  const [interestRules, setInterestRules] = useState('');
  const [standingInstructions, setStandingInstructions] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);

  useEffect(() => {
    if (isOpen && settings.length > 0 && !selectedId) {
      selectItem(settings[0]);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const selectItem = (item: MunicipalitySetting) => {
    setSelectedId(item.id);
    setMunicipalityName(item.municipality_name);
    setFeeMethod(item.fee_calculation_method);
    setFeeRateValue(item.fee_rate_value);
    setFeeTariffDescription(item.fee_tariff_description);
    setInterestRules(item.interest_and_expenses_rules);
    setStandingInstructions(item.standing_instructions);
    setContactPerson(item.contact_person || '');
  };

  const handleStartNew = () => {
    setSelectedId(null);
    setMunicipalityName('');
    setFeeMethod('אחוזים');
    setFeeRateValue(0);
    setFeeTariffDescription('');
    setInterestRules('');
    setStandingInstructions('');
    setContactPerson('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !municipalityName.trim()) return;
    setSaving(true);
    try {
      const saved = await saveMunicipalitySetting({
        id: selectedId || undefined,
        municipality_name: municipalityName.trim(),
        fee_calculation_method: feeMethod,
        fee_rate_value: Number(feeRateValue) || 0,
        fee_tariff_description: feeTariffDescription.trim(),
        interest_and_expenses_rules: interestRules.trim(),
        standing_instructions: standingInstructions.trim(),
        contact_person: contactPerson.trim(),
      });

      const exists = settings.some((s) => s.id === saved.id);
      const nextList = exists
        ? settings.map((s) => (s.id === saved.id ? saved : s))
        : [saved, ...settings];

      onSettingsChanged(nextList);
      setSelectedId(saved.id);
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 2500);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בשמירת הגדרות רשות');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!window.confirm(`האם למחוק את הגדרות הרשות "${name}"?`)) return;
    try {
      await deleteMunicipalitySetting(id);
      const nextList = settings.filter((s) => s.id !== id);
      onSettingsChanged(nextList);
      if (nextList.length > 0) {
        selectItem(nextList[0]);
      } else {
        handleStartNew();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה במחיקת רשות');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        dir="rtl"
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              הגדרות שכר טרחה, ריבית והנחיות עבודה לפי רשות (`municipalities_settings`)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              הגדרות אלו מוצגות אוטומטית בתוך כל כרטיס תיק של אותה רשות ומשמשות לחישוב שכר טרחה אוטומטי
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
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-900 flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            מצב צפייה בלבד (משתמש `user`): רק מנהל מערכת (`admin`) מורשה לערוך או להוסיף הגדרות רשויות ושכר טרחה.
          </div>
        )}

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* רשימת רשויות מימין */}
          <div className="md:col-span-4 border-l border-slate-200 bg-slate-50 p-4 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold text-slate-700">
                רשויות מוגדרות ({settings.length})
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  רשות חדשה
                </button>
              )}
            </div>

            {settings.map((item) => {
              const active = selectedId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => selectItem(item)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    active
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs truncate">
                      {item.municipality_name}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}
                    >
                      {item.fee_calculation_method} (
                      {item.fee_calculation_method === 'סכום קבוע'
                        ? `₪${item.fee_rate_value}`
                        : `${item.fee_rate_value}%`}
                      )
                    </span>
                  </div>
                  <div
                    className={`text-[11px] truncate mt-1 ${
                      active ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {item.standing_instructions || item.fee_tariff_description}
                  </div>
                </div>
              );
            })}
          </div>

          {/* טופס עריכת רשות משמאל */}
          <form
            onSubmit={handleSave}
            className="md:col-span-8 p-6 overflow-y-auto space-y-4 bg-white"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                {selectedId
                  ? `עריכת כללי רשות: ${municipalityName}`
                  : 'הגדרת רשות מקומית / עירייה חדשה'}
              </h3>
              {savedBanner && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  נשמר בהצלחה!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  שם הרשות המקומית / העירייה *
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={municipalityName}
                  onChange={(e) => setMunicipalityName(e.target.value)}
                  placeholder="למשל: עיריית נתניה"
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:border-blue-600 disabled:bg-slate-100 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  שיטת חישוב שכר טרחה *
                </label>
                <select
                  disabled={!isAdmin}
                  value={feeMethod}
                  onChange={(e) =>
                    setFeeMethod(e.target.value as FeeCalculationMethod)
                  }
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 bg-white focus:border-blue-600 disabled:bg-slate-100 outline-none font-semibold"
                >
                  {FEE_CALCULATION_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-blue-600" />
                  {feeMethod === 'סכום קבוע'
                    ? 'סכום שכ"ט קבוע (בש"ח)'
                    : 'שיעור שכ"ט באחוזים (%)'}
                </label>
                <input
                  type="number"
                  step="0.5"
                  disabled={!isAdmin}
                  value={feeRateValue}
                  onChange={(e) => setFeeRateValue(Number(e.target.value))}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:border-blue-600 disabled:bg-slate-100 outline-none font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                פירוט תעריף שכר טרחה ומדרגות הוצל&quot;פ
              </label>
              <textarea
                rows={2}
                disabled={!isAdmin}
                value={feeTariffDescription}
                onChange={(e) => setFeeTariffDescription(e.target.value)}
                placeholder="פרט את כללי שכר הטרחה במכתב התראה, בתביעה ובהוצל״פ..."
                className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:border-blue-600 disabled:bg-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                כללי ריבית, הצמדה והוצאות גבייה של הרשות
              </label>
              <textarea
                rows={2}
                disabled={!isAdmin}
                value={interestRules}
                onChange={(e) => setInterestRules(e.target.value)}
                placeholder="כללי חיוב או הפחתת ריבית, אישור גזבר, הוצאות מסירה ואיתור..."
                className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:border-blue-600 disabled:bg-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                הנחיות עבודה קבועות לאותה רשות (מוצגות אוטומטית בכל כרטיס תיק)
              </label>
              <textarea
                rows={3}
                disabled={!isAdmin}
                value={standingInstructions}
                onChange={(e) => setStandingInstructions(e.target.value)}
                placeholder="הנחיות קבועות לעובדים: בדיקת גח״לת, רישום משכון, מדיניות הסדרי תשלומים והשארת עיקולים..."
                className="w-full p-2.5 text-xs rounded-lg border border-indigo-200 bg-indigo-50/30 focus:border-indigo-600 disabled:bg-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                איש קשר ברשות / מנהל גבייה
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="שם ותפקיד ברשות..."
                className="w-full p-2 text-xs rounded-lg border border-slate-300 focus:border-blue-600 disabled:bg-slate-100 outline-none"
              />
            </div>

            {selectedId && (
              <div className="text-[11px] text-slate-400">
                עודכן לאחרונה ע&quot;י:{' '}
                {settings.find((s) => s.id === selectedId)?.updated_by || 'מנהל'}{' '}
                •{' '}
                {formatDateTimeHe(
                  settings.find((s) => s.id === selectedId)?.updated_at
                )}
              </div>
            )}

            {isAdmin && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                {selectedId ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedId, municipalityName)}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    מחק רשות
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    סגור
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !municipalityName.trim()}
                    className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'שומר...' : 'שמור הגדרות רשות'}
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
