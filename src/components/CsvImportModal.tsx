'use client';

import React, { useRef, useState } from 'react';
import { X, Upload, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { CaseItem } from '@/types/database';
import { parseCsvToCases } from '@/lib/dateUtils';
import { bulkCreateCaseItems } from '@/lib/dataService';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (newCases: CaseItem[]) => void;
}

export default function CsvImportModal({
  isOpen,
  onClose,
  onImported,
}: CsvImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [parsedPayload, setParsedPayload] = useState<
    Omit<CaseItem, 'id' | 'updated_at'>[]
  >([]);
  const [fileName, setFileName] = useState('');

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const sampleCsv =
      '\uFEFFשם חייב,ת"ז / ח"פ,מספר תיק,סוג הליך,עירייה,תגיות,סטטוס,סוג פעולה,פעולה הבאה,תאריך יעד,הערות\r\n' +
      'משה כהן,012345678,חדל"פ 11223-05-25,חדל"פ,עיריית תל אביב-יפו,עיזבון; ייצוג נושה,פעיל,תגובה,הגשת תגובה לבקשת הנאמן,2026-11-20,חוב ארנונה בגין נכס מסחרי\r\n' +
      'בניית הארץ בע"מ,512345679,פר"ק 44556-02-25,חברות,עיריית חולון,חברה משכנת,בהסדר,מעקב הסדר,בדיקת פירעון תשלום שלישי,2026-11-25,פרויקט מגורים\r\n';

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'תבנית_ייבוא_תיקים_משפטיים.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseCsvToCases(text);
    setParsedPayload(parsed);
    setPreviewCount(parsed.length);
  };

  const handleConfirmImport = async () => {
    if (parsedPayload.length === 0) return;
    setImporting(true);
    try {
      const created = await bulkCreateCaseItems(parsedPayload);
      onImported(created);
      setParsedPayload([]);
      setPreviewCount(null);
      setFileName('');
      onClose();
    } catch (err) {
      console.error('CSV import failed:', err);
      alert('שגיאה בייבוא התיקים מהקובץ');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        dir="rtl"
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            ייבוא מהיר של רשימת תיקים מקובץ CSV (אקסל / שיטס)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            ניתן לייבא מאות או אלפי תיקים בלחיצה אחת מתוך קובץ CSV (שנשמר מאקסל או
            Google Sheets). המערכת מזהה אוטומטית עמודות בעברית כגון:{' '}
            <strong>
              שם חייב, ת&quot;ז / ח&quot;פ, מספר תיק, סוג הליך, עירייה, תגיות, סטטוס,
              פעולה הבאה, תאריך יעד, הערות
            </strong>
            .
          </p>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">
                רוצה תבנית מוכנה לאקסל?
              </div>
              <div className="text-[11px] text-slate-500">
                הורד קובץ CSV לדוגמה בעברית עם כל העמודות המומלצות
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              הורד תבנית CSV
            </button>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/40 rounded-xl p-6 text-center cursor-pointer transition"
          >
            <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-800">
              {fileName ? `נבחר הקובץ: ${fileName}` : 'לחץ לבחירת קובץ CSV מהמחשב'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              תומך בקידוד UTF-8 וקבצי CSV מאקסל וגוגל שיטס
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {previewCount !== null && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-900 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>זוהו {previewCount} תיקים תקינים המוכנים לייבוא מיידי!</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              ביטול
            </button>
            <button
              type="button"
              disabled={importing || parsedPayload.length === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-xs transition flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {importing
                ? 'מייבא תיקים...'
                : `ייבא כעת ${parsedPayload.length || ''} תיקים`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
