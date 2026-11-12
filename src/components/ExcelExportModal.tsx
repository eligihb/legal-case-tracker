'use client';

import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  CheckSquare,
  Square,
  Layers,
  Filter,
} from 'lucide-react';
import { CATEGORY_LABELS, CaseItem, CaseLog } from '@/types/database';
import {
  calculateTotalDebt,
  formatDateHe,
  formatDateTimeHe,
  generateCsvContent,
} from '@/lib/dateUtils';
import { downloadXlsxFile, XlsxSheetData } from '@/lib/xlsxExporter';

interface ExcelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allCases: CaseItem[];
  filteredCases: CaseItem[];
  singleCase?: CaseItem | null;
  singleCaseLogs?: CaseLog[];
}

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  getValue: (c: CaseItem) => string | number;
}

export const AVAILABLE_COLUMNS: ColumnDef[] = [
  {
    key: 'debtor_name',
    label: 'שם חייב / חברה / פרויקט',
    width: 30,
    getValue: (c) => c.debtor_name,
  },
  {
    key: 'id_or_hp',
    label: 'ת"ז / ח"פ',
    width: 15,
    getValue: (c) => c.id_or_hp || '',
  },
  {
    key: 'case_number',
    label: 'מספר תיק',
    width: 22,
    getValue: (c) => c.case_number || '',
  },
  {
    key: 'gush_helka',
    label: 'גוש / חלקה',
    width: 24,
    getValue: (c) => c.gush_helka || c.property_details || '',
  },
  {
    key: 'category',
    label: 'תחום התיק',
    width: 28,
    getValue: (c) => CATEGORY_LABELS[c.category]?.title || c.category,
  },
  {
    key: 'current_stage',
    label: 'שלב נוכחי בתיק',
    width: 32,
    getValue: (c) => c.current_stage || '',
  },
  {
    key: 'municipality',
    label: 'עירייה / רשות / פרויקט',
    width: 22,
    getValue: (c) => c.municipality || c.housing_project_name || '',
  },
  {
    key: 'status',
    label: 'סטטוס',
    width: 20,
    getValue: (c) =>
      c.is_hearing_postponed ? `${c.status} (נדחה)` : c.status,
  },
  {
    key: 'extensions_count',
    label: 'מונה דחיות/ארכות',
    width: 15,
    getValue: (c) => Number(c.extensions_count) || 0,
  },
  {
    key: 'next_action_type',
    label: 'סוג פעולה הבאה',
    width: 20,
    getValue: (c) => c.next_action_type || '',
  },
  {
    key: 'next_action_description',
    label: 'תיאור פעולה הבאה',
    width: 36,
    getValue: (c) => c.next_action_description || '',
  },
  {
    key: 'next_due_date',
    label: 'תאריך יעד קרוב',
    width: 16,
    getValue: (c) => formatDateHe(c.next_due_date),
  },
  {
    key: 'trustee_report_due_date',
    label: 'יעד דו"ח נאמן',
    width: 16,
    getValue: (c) => formatDateHe(c.trustee_report_due_date),
  },
  {
    key: 'total_debt',
    label: 'סה"כ חוב / תביעה (₪)',
    width: 18,
    getValue: (c) => calculateTotalDebt(c),
  },
  {
    key: 'debt_years',
    label: 'שנות חוב',
    width: 14,
    getValue: (c) => c.debt_years || '',
  },
  {
    key: 'gachlat_status',
    label: 'גח"לת',
    width: 16,
    getValue: (c) => c.gachlat_status || '',
  },
  {
    key: 'delivery_confirmation_date',
    label: 'תאריך אישור מסירה',
    width: 16,
    getValue: (c) => formatDateHe(c.delivery_confirmation_date),
  },
  {
    key: 'execution_target_date',
    label: 'יעד הוצל"פ (+30 יום)',
    width: 18,
    getValue: (c) => formatDateHe(c.execution_target_date),
  },
  {
    key: 'insolvency_info',
    label: 'נושה מהותי / נאמן (חדל"פ)',
    width: 28,
    getValue: (c) =>
      c.category === 'חדל"פ'
        ? `${c.is_material_creditor ? 'נושה מהותי | ' : ''}${
            c.insolvency_debtor_type || ''
          } | ${c.trustee_name_and_contact || ''}`
        : '',
  },
  {
    key: 'company_info',
    label: 'התחייבות עצמית / חקירה / הכרעה (חברות)',
    width: 30,
    getValue: (c) =>
      c.category === 'חברות'
        ? `התחייבות 100א׳: ${
            c.self_undertaking_deposited ? 'הופקדה' : 'טרם'
          } | חקירה: ${c.investigation_outcome || ''} | הכרעה: ${
            c.company_resolution_decision || ''
          }`
        : '',
  },
  {
    key: 'housing_info',
    label: 'תצ"ר / בית משותף / העברת זכויות (חברה משכנת)',
    width: 34,
    getValue: (c) =>
      c.category === 'חברה משכנת'
        ? `בית משותף: ${c.condominium_registration_fit || ''} | ${
            c.seller_buyer_names || ''
          }`
        : '',
  },
  {
    key: 'notes',
    label: 'הערות ליבה',
    width: 38,
    getValue: (c) => c.notes || '',
  },
  {
    key: 'last_modified_by',
    label: 'עודכן ע"י',
    width: 18,
    getValue: (c) => c.last_modified_by || '',
  },
];

/**
 * ייצוא מיידי בקליק אחד של הנתונים המסוננים כרגע לקובץ .xlsx
 */
export function quickExportFilteredCasesToXlsx(
  filteredCases: CaseItem[],
  label = 'תיקים_מסוננים'
): void {
  const sheets: XlsxSheetData[] = [
    {
      name: 'תיקים מסוננים',
      headers: AVAILABLE_COLUMNS.map((c) => c.label),
      columnWidths: AVAILABLE_COLUMNS.map((c) => c.width),
      rows: filteredCases.map((item) =>
        AVAILABLE_COLUMNS.map((col) => col.getValue(item))
      ),
    },
  ];

  // הוספת גיליון משימות וצ'ק-ליסט של התיקים המסוננים
  const taskRows: (string | number)[][] = [];
  filteredCases.forEach((c) => {
    (c.milestones || []).forEach((m) => {
      taskRows.push([
        c.debtor_name,
        c.case_number || '',
        CATEGORY_LABELS[c.category]?.shortTitle || c.category,
        m.title,
        m.urgency || 'רגילה',
        m.status === 'done'
          ? 'נעשה ✓'
          : m.status === 'in_progress'
          ? 'בתהליך כעת ⏳'
          : 'יבוצע בהמשך ➔',
        Number(m.planned_days) || 0,
        Number(m.days_spent) || 0,
        formatDateHe(m.started_at),
        formatDateHe(m.completed_at),
        m.updated_by || '',
      ]);
    });
  });

  if (taskRows.length > 0) {
    sheets.push({
      name: 'משימות ומדידת זמנים',
      headers: [
        'שם חייב / תיק',
        'מספר תיק',
        'תחום',
        'משימה / שלב בצ׳ק-ליסט',
        'דחיפות',
        'סטטוס ביצוע',
        'משך מתוכנן (ימים)',
        'ימים בפועל',
        'תאריך התחלה',
        'תאריך סגירה',
        'עודכן ע"י',
      ],
      columnWidths: [26, 18, 22, 36, 14, 16, 16, 14, 15, 15, 18],
      rows: taskRows,
    });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const cleanLabel = label.replace(/[\\/?*[\]:\s]+/g, '_');
  downloadXlsxFile(`ייצוא_${cleanLabel}_${todayStr}.xlsx`, sheets);
}

export default function ExcelExportModal({
  isOpen,
  onClose,
  allCases,
  filteredCases,
}: ExcelExportModalProps) {
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered');
  const [selectedCols, setSelectedCols] = useState<string[]>(
    AVAILABLE_COLUMNS.map((c) => c.key)
  );
  const [includeSummarySheet, setIncludeSummarySheet] = useState(true);
  const [includeReductionsSheet, setIncludeReductionsSheet] = useState(true);

  if (!isOpen) return null;

  const targetCases = scope === 'filtered' ? filteredCases : allCases;

  const toggleCol = (key: string) => {
    setSelectedCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleExportXlsx = () => {
    const activeColDefs = AVAILABLE_COLUMNS.filter((c) =>
      selectedCols.includes(c.key)
    );
    if (activeColDefs.length === 0) {
      alert('יש לבחור לפחות עמודה אחת לייצוא');
      return;
    }

    const sheets: XlsxSheetData[] = [];

    // 1. גיליון רשימת תיקים מרכזית
    sheets.push({
      name: 'רשימת תיקים',
      headers: activeColDefs.map((c) => c.label),
      columnWidths: activeColDefs.map((c) => c.width),
      rows: targetCases.map((item) =>
        activeColDefs.map((col) => col.getValue(item))
      ),
    });

    // 2. גיליון דוח מסכם לפי 4 התחומים והרשויות
    if (includeSummarySheet) {
      const byCategoryMap = new Map<
        string,
        { count: number; totalDebt: number; inArr: number; postponed: number }
      >();
      const byMuniMap = new Map<
        string,
        { count: number; principal: number; totalDebt: number; reductionsSum: number }
      >();

      for (const c of targetCases) {
        const catName = CATEGORY_LABELS[c.category]?.title || c.category;
        const catStat = byCategoryMap.get(catName) || {
          count: 0,
          totalDebt: 0,
          inArr: 0,
          postponed: 0,
        };
        catStat.count += 1;
        catStat.totalDebt += calculateTotalDebt(c);
        if (c.status === 'בהסדר' || c.status === 'בהסדר תשלומים') catStat.inArr += 1;
        if (c.is_hearing_postponed || (c.extensions_count || 0) > 0)
          catStat.postponed += 1;
        byCategoryMap.set(catName, catStat);

        if (c.municipality) {
          const muniName = c.municipality;
          const muniStat = byMuniMap.get(muniName) || {
            count: 0,
            principal: 0,
            totalDebt: 0,
            reductionsSum: 0,
          };
          muniStat.count += 1;
          muniStat.principal += Number(c.principal_amount) || 0;
          muniStat.totalDebt += calculateTotalDebt(c);
          const redSum = (c.monthly_reductions || []).reduce(
            (acc, r) => acc + (Number(r.reported_amount) || 0),
            0
          );
          muniStat.reductionsSum += redSum;
          byMuniMap.set(muniName, muniStat);
        }
      }

      const summaryRows: (string | number)[][] = [];
      summaryRows.push(['=== סיכום לפי 4 תחומי המערכת ===', '', '', '', '']);
      Array.from(byCategoryMap.entries()).forEach(([catName, st]) => {
        summaryRows.push([
          catName,
          st.count,
          st.totalDebt,
          st.inArr,
          `תיקים עם דחיות/ארכות: ${st.postponed}`,
        ]);
      });
      summaryRows.push(['', '', '', '', '']);
      summaryRows.push([
        '=== סיכום לפי עיריות ורשויות ===',
        'מספר תיקים',
        'סה"כ קרן חוב (₪)',
        'סה"כ חוב כולל שכ"ט (₪)',
        'סה"כ הפחתות שדווחו (₪)',
      ]);
      Array.from(byMuniMap.entries()).forEach(([mName, st]) => {
        summaryRows.push([
          mName,
          st.count,
          st.principal,
          st.totalDebt,
          st.reductionsSum,
        ]);
      });

      sheets.push({
        name: 'דוח מסכם 4 תחומים ורשויות',
        headers: [
          'תחום / רשות מקומית',
          'כמות תיקים',
          'סה"כ חוב / קרן (₪)',
          'תיקים בהסדר / סה"כ חוב (₪)',
          'דחיות / הפחתות שדווחו (₪)',
        ],
        columnWidths: [34, 16, 22, 26, 28],
        rows: summaryRows,
      });
    }

    // 3. גיליון יומן הפחתות חודשי מרוכז
    if (includeReductionsSheet) {
      const reductionRows: (string | number)[][] = [];
      targetCases.forEach((c) => {
        (c.monthly_reductions || []).forEach((r) => {
          reductionRows.push([
            c.debtor_name,
            c.case_number || '',
            c.municipality || '',
            r.month_year,
            r.report_received ? 'כן' : 'לא',
            Number(r.reported_amount) || 0,
            r.reduced_in_execution ? 'בוצעה הפחתה ✓' : 'טרם הופחת בהוצל"פ',
            formatDateHe(r.reduction_date),
            r.performed_by || '',
            r.notes || '',
          ]);
        });
      });

      if (reductionRows.length > 0) {
        sheets.push({
          name: 'יומן הפחתות חודשי',
          headers: [
            'שם חייב',
            'מספר תיק הוצל"פ',
            'עירייה / רשות',
            'חודש דיווח',
            'התקבל דיווח?',
            'סכום שדווח (₪)',
            'בוצעה הפחתה בהוצל"פ?',
            'תאריך ביצוע',
            'שם המבצע',
            'הערות',
          ],
          columnWidths: [24, 18, 20, 14, 14, 16, 20, 15, 18, 30],
          rows: reductionRows,
        });
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    downloadXlsxFile(`דוח_תיקים_משפטיים_${todayStr}.xlsx`, sheets);
    onClose();
  };

  const handleExportCsvFallback = () => {
    const csv = generateCsvContent(targetCases);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `תיקים_משפטיים_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div
        dir="rtl"
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              ייצוא לאקסל (`.xlsx`) — נתונים מסוננים ודוחות
            </h2>
            <p className="text-sm text-slate-300 mt-0.5">
              מייצא את הנתונים המסוננים כרגע או את כלל התיקים לקובץ אקסל בעברית מלאה
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          <div className="space-y-2">
            <label className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-blue-600" />
              1. בחר אילו תיקים לייצא:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScope('filtered')}
                className={`p-3.5 rounded-xl border text-right transition ${
                  scope === 'filtered'
                    ? 'bg-blue-50 border-blue-600 text-blue-950 ring-2 ring-blue-100'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-sm font-extrabold">
                  הנתונים המסוננים כרגע ({filteredCases.length} תיקים)
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  מייצא בדיוק את התיקים המוצגים בטבלה לפי הלשונית ומסנני העמודות
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-3.5 rounded-xl border text-right transition ${
                  scope === 'all'
                    ? 'bg-blue-50 border-blue-600 text-blue-950 ring-2 ring-blue-100'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-sm font-extrabold">
                  כל התיקים במערכת ({allCases.length} תיקים)
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  מייצא את כלל התיקים מכל 4 התחומים
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              2. גיליונות נוספים בקובץ ה-`.xlsx`:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSummarySheet}
                  onChange={(e) => setIncludeSummarySheet(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    גיליון &quot;דוח מסכם 4 תחומים ורשויות&quot;
                  </div>
                  <div className="text-xs text-slate-500">
                    ריכוז כמויות תיקים, סכומים, הסדרים ודחיות
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeReductionsSheet}
                  onChange={(e) => setIncludeReductionsSheet(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    גיליון &quot;יומן הפחתות חודשי&quot;
                  </div>
                  <div className="text-xs text-slate-500">
                    פירוט כל דיווחי התשלומים מהרשות וביצוע הפחתות
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-extrabold text-slate-800">
                3. בחירת עמודות ({selectedCols.length} מתוך{' '}
                {AVAILABLE_COLUMNS.length}):
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCols(AVAILABLE_COLUMNS.map((c) => c.key))
                  }
                  className="text-blue-600 hover:underline font-bold"
                >
                  בחר הכל
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedCols([
                      'debtor_name',
                      'id_or_hp',
                      'case_number',
                      'gush_helka',
                      'category',
                      'current_stage',
                      'status',
                      'next_action_description',
                      'next_due_date',
                    ])
                  }
                  className="text-slate-600 hover:underline font-bold"
                >
                  עמודות ליבה בלבד
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50/60">
              {AVAILABLE_COLUMNS.map((col) => {
                const checked = selectedCols.includes(col.key);
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleCol(col.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-right border transition ${
                      checked
                        ? 'bg-white border-blue-400 text-blue-950 shadow-2xs'
                        : 'bg-transparent border-transparent text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span className="truncate">{col.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleExportCsvFallback}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-bold flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4 text-slate-500" />
            הורד גם כ-CSV
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-200/60 transition"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleExportXlsx}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold flex items-center gap-2 shadow-sm transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              הורד קובץ אקסל (.xlsx)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ייצוא מלא של כרטיס תיק בודד לאקסל (.xlsx) מותאם לסוג התיק
 */
export function exportSingleCaseToXlsx(
  caseItem: CaseItem,
  logs: CaseLog[]
): void {
  const sheets: XlsxSheetData[] = [];
  const totalDebt = calculateTotalDebt(caseItem);

  const baseRows: (string | number)[][] = [
    ['שם חייב / חברה / פרויקט', caseItem.debtor_name],
    ['ת"ז / ח"פ', caseItem.id_or_hp || ''],
    ['מספר תיק', caseItem.case_number || ''],
    ['גוש / חלקה', caseItem.gush_helka || caseItem.property_details || ''],
    ['תחום התיק', CATEGORY_LABELS[caseItem.category]?.title || caseItem.category],
    ['השלב הנוכחי בתיק', caseItem.current_stage || ''],
    ['סטטוס תיק', caseItem.status],
    ['דיון נדחה?', caseItem.is_hearing_postponed ? 'כן (נדחה)' : 'לא'],
    ['מונה דחיות / ארכות', Number(caseItem.extensions_count) || 0],
    ['סיבת דחייה / ארכה אחרונה', caseItem.postponed_reason || ''],
    ['הפעולה הבאה', `${caseItem.next_action_type}: ${caseItem.next_action_description}`],
    ['תאריך יעד קרוב', formatDateHe(caseItem.next_due_date)],
    ['מועד עדכון דו"ח נאמן', formatDateHe(caseItem.trustee_report_due_date)],
    ['הערות ליבה', caseItem.notes || ''],
    ['עודכן לאחרונה ע"י', caseItem.last_modified_by || ''],
  ];

  if (caseItem.category === 'גבייה') {
    baseRows.push(
      ['--- שדות ייעודיים: תיקי רשויות (גבייה והוצל"פ) ---', ''],
      ['רשות מקומית / עירייה', caseItem.municipality || ''],
      ['שנות החוב', caseItem.debt_years || ''],
      ['קרן חוב (₪)', Number(caseItem.principal_amount) || 0],
      ['ריבית והצמדה (₪)', Number(caseItem.interest_amount) || 0],
      ['הוצאות (₪)', Number(caseItem.expenses_amount) || 0],
      ['שכר טרחה (₪)', Number(caseItem.legal_fee_amount) || 0],
      ['סה"כ חוב מחושב (₪)', totalDebt],
      ['סטטוס גח"לת', caseItem.gachlat_status || ''],
      ['קיים נכס?', caseItem.has_property ? 'כן' : 'לא'],
      ['פירוט נכס ומשכון', caseItem.property_details || ''],
      ['תאריך מכתב התראה', formatDateHe(caseItem.warning_letter_sent_date)],
      ['תאריך אישור מסירה', formatDateHe(caseItem.delivery_confirmation_date)],
      ['יעד פתיחת הוצל"פ (+30 יום)', formatDateHe(caseItem.execution_target_date)],
      ['מעקב הליכי הוצל"פ', caseItem.execution_proceedings_notes || ''],
      ['מחיקת חוב ישן?', caseItem.is_old_debt_writeoff ? 'כן' : 'לא'],
      ['סיווג מחיקה', caseItem.writeoff_classification || ''],
      ['חוות דעת משפטית למחיקה', caseItem.legal_opinion_summary || '']
    );
  } else if (caseItem.category === 'חדל"פ') {
    baseRows.push(
      ['--- שדות ייעודיים: תיקי חדל"פ (ייצוג נושה / פירוק) ---', ''],
      ['נושה מהותי בתיק?', caseItem.is_material_creditor ? 'כן — נושה מהותי!' : 'לא'],
      ['סיווג חייב', caseItem.insolvency_debtor_type || 'חייב יחיד'],
      ['פרטי נאמן / מפרק', caseItem.trustee_name_and_contact || ''],
      ['מועד אחרון להגשת תביעת חוב', formatDateHe(caseItem.debt_claim_deadline)],
      ['האם הוגשה תביעת חוב?', caseItem.debt_claim_submitted ? 'כן ✓' : 'טרם הוגשה'],
      ['סכום תביעת החוב (₪)', Number(caseItem.debt_claim_amount) || 0],
      ['תגובות נושה', caseItem.creditor_responses_notes || ''],
      ['מעקב חובות חדשים', caseItem.new_debts_tracking || '']
    );
  } else if (caseItem.category === 'חברות') {
    baseRows.push(
      ['--- שדות ייעודיים: תיקי חברות (נאמן / מפרק) ---', ''],
      [
        'הפקדת התחייבות עצמית (100,000 ₪)',
        caseItem.self_undertaking_deposited ? 'הופקדה ✓' : 'טרם הופקדה!',
      ],
      ['תאריך הפקדת התחייבות', formatDateHe(caseItem.self_undertaking_date)],
      ['מכתבים לחברות ביטוח ואיתור נכסים', caseItem.insurance_and_assets_letters_status || ''],
      ['פרטי מייצג החברה', caseItem.representative_contact_details || ''],
      ['שם הנאמן החוקר', caseItem.investigating_trustee_name || ''],
      ['מועד חקירה מתואם', formatDateHe(caseItem.investigation_scheduled_date)],
      ['סט מסמכים נדרש', caseItem.required_documents_checklist || ''],
      ['תוצאות חקירה', caseItem.investigation_outcome || 'טרם נחקר'],
      ['מעקב השלמות מסמכים', caseItem.missing_documents_details || ''],
      ['תקציר דו"ח נאמן וממצאים', caseItem.trustee_findings_summary || ''],
      ['הכרעה בתיק (שיקום / פירוק)', caseItem.company_resolution_decision || 'טרם הוכרע']
    );
  } else if (caseItem.category === 'חברה משכנת') {
    baseRows.push(
      ['--- שדות ייעודיים: חברה משכנת (רישום וזכויות) ---', ''],
      ['שם הפרויקט / מתחם', caseItem.housing_project_name || ''],
      ['אישור מפרקים למכירת זכויות', caseItem.liquidators_sale_approval ? 'אושר ✓' : 'טרם'],
      ['מיקום תיקים פיזיים', caseItem.physical_files_location || ''],
      ['הנפקת אישור זכויות', caseItem.rights_certificate_issued ? 'הונפק ✓' : 'טרם'],
      ['שם המודד', caseItem.surveyor_name || ''],
      ['מעקב תצ"רים מול מודד', caseItem.tazar_status || ''],
      ['טופל תצ"ר חניות?', caseItem.parking_tazar_handled ? 'כן ✓' : 'לא'],
      ['הערות תצ"ר חניות', caseItem.parking_tazar_notes || ''],
      ['התאמת תצ"ר לרישום בית משותף', caseItem.condominium_registration_fit || 'בבדיקה'],
      ['בקרת חשבוניות מול אישור ביהמ"ש', caseItem.invoices_court_control || ''],
      ['העברת זכויות (מוכר ➔ קונה)', caseItem.seller_buyer_names || ''],
      ['סט מסמכי חתימה מלא?', caseItem.transfer_signing_docs_complete ? 'כן ✓' : 'טרם'],
      ['אישור המפרק להעברת זכויות?', caseItem.transfer_liquidator_approved ? 'אושר ✓' : 'טרם'],
      ['שלב ביצוע העברת זכויות', caseItem.transfer_process_stage || ''],
      ['הופק אישור זכויות על שם הקונה החדש?', caseItem.new_buyer_certificate_issued ? 'כן ✓' : 'טרם']
    );
  }

  sheets.push({
    name: 'כרטיס תיק מלא',
    headers: ['שדה', 'ערך'],
    columnWidths: [34, 58],
    rows: baseRows,
  });

  if (caseItem.milestones && caseItem.milestones.length > 0) {
    sheets.push({
      name: 'משימות, צ׳ק-ליסט וזמנים',
      headers: [
        'משימה / שלב',
        'מידת דחיפות',
        'סטטוס ביצוע',
        'משך מתוכנן (ימים)',
        'ימים בפועל',
        'תאריך התחלה',
        'תאריך סגירה',
        'עודכן ע"י',
      ],
      columnWidths: [38, 15, 18, 18, 15, 15, 15, 18],
      rows: caseItem.milestones.map((m) => [
        m.title,
        m.urgency || 'רגילה',
        m.status === 'done'
          ? 'נעשה ✓'
          : m.status === 'in_progress'
          ? 'בתהליך כעת ⏳'
          : 'יבוצע בהמשך ➔',
        Number(m.planned_days) || 0,
        Number(m.days_spent) || 0,
        formatDateHe(m.started_at),
        formatDateHe(m.completed_at),
        m.updated_by || '',
      ]),
    });
  }

  if (caseItem.monthly_reductions && caseItem.monthly_reductions.length > 0) {
    sheets.push({
      name: 'יומן הפחתות חודשי',
      headers: [
        'חודש דיווח',
        'התקבל דיווח?',
        'סכום התשלום שדווח (₪)',
        'בוצעה הפחתה בהוצל"פ?',
        'תאריך ביצוע ההפחתה',
        'שם המבצע',
        'הערות',
      ],
      columnWidths: [15, 18, 22, 22, 18, 18, 30],
      rows: caseItem.monthly_reductions.map((r) => [
        r.month_year,
        r.report_received ? 'כן' : 'לא',
        Number(r.reported_amount) || 0,
        r.reduced_in_execution ? 'בוצעה הפחתה ✓' : 'טרם בוצע',
        formatDateHe(r.reduction_date),
        r.performed_by || '',
        r.notes || '',
      ]),
    });
  }

  if (logs.length > 0) {
    sheets.push({
      name: 'תרשומות, הערות וארכות',
      headers: [
        'תאריך ושעה',
        'סוג רישום',
        'תוכן התרשומת / ההערה / ההחלטה',
        'תאריך יעד / תזכורת',
        'נחתם אוטומטית ע"י',
      ],
      columnWidths: [18, 22, 52, 16, 20],
      rows: logs.map((l) => [
        formatDateTimeHe(l.log_date),
        l.log_type,
        l.content,
        formatDateHe(l.due_date),
        l.created_by || '',
      ]),
    });
  }

  const safeDebtor = caseItem.debtor_name.replace(/[\\/?*[\]:]/g, '_');
  downloadXlsxFile(`תיק_${safeDebtor}.xlsx`, sheets);
}
