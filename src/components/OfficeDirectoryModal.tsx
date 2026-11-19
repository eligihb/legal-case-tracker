'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BookUser,
  Building2,
  Check,
  Copy,
  FileSpreadsheet,
  Gavel,
  Mail,
  Pencil,
  Phone,
  Plus,
  Printer,
  Search,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  CaseItem,
  MunicipalitySetting,
  OfficeContactItem,
} from '@/types/database';
import {
  addContactCategory,
  deleteContactCategory,
  deleteOfficeContact,
  getContactCategoriesList,
  getOfficeContacts,
  renameContactCategory,
  saveOfficeContact,
} from '@/lib/dataService';
import { downloadXlsxFile } from '@/lib/xlsxExporter';

interface OfficeDirectoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseItem[];
  municipalitiesSettings: MunicipalitySetting[];
  systemEditMode?: boolean;
  onSelectCase?: (caseItem: CaseItem) => void;
  onPickContactForCase?: (contact: OfficeContactItem) => void;
  onAssigneesChanged?: () => void;
}

export default function OfficeDirectoryModal({
  isOpen,
  onClose,
  cases,
  municipalitiesSettings,
  systemEditMode = false,
  onSelectCase,
  onPickContactForCase,
  onAssigneesChanged,
}: OfficeDirectoryModalProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [contacts, setContacts] = useState<OfficeContactItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('הכל');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // טופס הוספה / עריכה של איש קשר באלפון
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCategory, setFormCategory] = useState<string>(
    'עיריות ורשויות מקומיות'
  );
  const [formName, setFormName] = useState('');
  const [formOrganization, setFormOrganization] = useState('');
  const [formRoleTitle, setFormRoleTitle] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // הוספת קטגוריית אלפון חדשה
  const [newCategoryInput, setNewCategoryInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const cats = getContactCategoriesList();
    setCategories(cats);
    setContacts(getOfficeContacts(cases, municipalitiesSettings));
  }, [isOpen, cases, municipalitiesSettings]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return contacts.filter((c) => {
      if (activeCategory !== 'הכל' && c.category !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.organization || '').toLowerCase().includes(q) ||
        (c.role_or_title || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q)
      );
    });
  }, [contacts, activeCategory, searchQuery]);

  if (!isOpen) return null;

  const openAddForm = () => {
    setEditingId(null);
    setFormCategory(
      activeCategory !== 'הכל'
        ? activeCategory
        : categories[2] || 'עיריות ורשויות מקומיות'
    );
    setFormName('');
    setFormOrganization('');
    setFormRoleTitle('');
    setFormPhone('');
    setFormEmail('');
    setFormNotes('');
    setIsFormOpen(true);
  };

  const openEditForm = (item: OfficeContactItem) => {
    setEditingId(item.id);
    setFormCategory(item.category);
    setFormName(item.name);
    setFormOrganization(item.organization || '');
    setFormRoleTitle(item.role_or_title || '');
    setFormPhone(item.phone || '');
    setFormEmail(item.email || '');
    setFormNotes(item.notes || '');
    setIsFormOpen(true);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    const updated = saveOfficeContact({
      id: editingId || undefined,
      category: formCategory,
      name: formName.trim(),
      organization: formOrganization.trim(),
      role_or_title: formRoleTitle.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim(),
      notes: formNotes.trim(),
    });
    setContacts(updated);
    setIsFormOpen(false);
    setEditingId(null);
    if (onAssigneesChanged) onAssigneesChanged();
  };

  const handleDeleteContact = (item: OfficeContactItem) => {
    if (!window.confirm(`למחוק את "${item.name}" מהאלפון המשרדי?`)) return;
    const updated = deleteOfficeContact(item.id);
    setContacts(updated);
  };

  const handleCopyContact = (item: OfficeContactItem) => {
    const text = [
      item.name,
      item.role_or_title ? `(${item.role_or_title})` : '',
      item.organization ? `| ${item.organization}` : '',
      item.phone ? `| טל: ${item.phone}` : '',
      item.email ? `| מייל: ${item.email}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExportDirectoryToXlsx = () => {
    downloadXlsxFile(
      `אלפון_משרדי_${new Date().toISOString().split('T')[0]}.xlsx`,
      [
        {
          name: 'אלפון משרדי חכם',
          headers: [
            'קטגוריה',
            'שם איש קשר / עובד / צד',
            'ארגון / רשות מקומית / משרד',
            'תפקיד מדויק / שיוך',
            'טלפון',
            'דוא"ל',
            'הערות / תיק משויך',
          ],
          columnWidths: [28, 26, 26, 28, 18, 26, 34],
          rows: filteredContacts.map((c) => [
            c.category,
            c.name,
            c.organization || '',
            c.role_or_title || '',
            c.phone || '',
            c.email || '',
            c.notes || c.related_case_name || '',
          ]),
        },
      ]
    );
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 no-print"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col h-[92dvh] overflow-hidden"
      >
        {/* כותרת אלפון משרדי חכם */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#0F172A] text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-inner">
              <BookUser className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold">
                אלפון משרדי חכם (Contacts &amp; Legal Directory)
              </h2>
              <p className="text-xs text-slate-300">
                5 קטגוריות מסונכרנות: חייבים וצדדים • צוות המשרד • עיריות ורשויות • משרדי עו&quot;ד ובעלי תפקידים • הממונה ובתי משפט
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              type="button"
              onClick={openAddForm}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ איש קשר חדש</span>
            </button>

            <button
              type="button"
              onClick={handleExportDirectoryToXlsx}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>ייצוא לאקסל ({filteredContacts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4" />
              <span>הדפסה</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* שורת חיפוש מיידי + לשוניות 5 הקטגוריות (עם אפשרות עריכה/הוספה) */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[230px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש מהיר באלפון לפי שם, רשות, תפקיד, טלפון או מייל..."
                className="w-full pr-10 pl-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white font-bold text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                placeholder="קטגוריית אלפון חדשה..."
                className="p-2 text-xs rounded-xl border border-slate-300 bg-white font-bold w-40"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newCategoryInput.trim()) return;
                  const next = addContactCategory(newCategoryInput.trim());
                  setCategories(next);
                  setActiveCategory(newCategoryInput.trim());
                  setNewCategoryInput('');
                }}
                className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold"
              >
                + קטגוריה
              </button>
            </div>
          </div>

          {/* כרטיסיות 5 הקטגוריות */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveCategory('הכל')}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                activeCategory === 'הכל'
                  ? 'bg-[#0F172A] text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              הכל ({contacts.length})
            </button>

            {categories.map((cat) => {
              const count = contacts.filter((c) => c.category === cat).length;
              const active = activeCategory === cat;
              return (
                <div key={cat} className="inline-flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                      active
                        ? 'bg-indigo-700 text-white border-indigo-800 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat} ({count})
                  </button>
                  {systemEditMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const nextName = window.prompt(
                            `ערוך שם קטגוריה "${cat}":`,
                            cat
                          );
                          if (!nextName || !nextName.trim()) return;
                          const nextCats = renameContactCategory(
                            cat,
                            nextName.trim()
                          );
                          setCategories(nextCats);
                          setContacts(
                            getOfficeContacts(cases, municipalitiesSettings)
                          );
                          if (activeCategory === cat) {
                            setActiveCategory(nextName.trim());
                          }
                        }}
                        className="text-xs text-slate-400 hover:text-blue-600"
                        title="ערוך שם קטגוריה"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextCats = deleteContactCategory(cat);
                          setCategories(nextCats);
                          if (activeCategory === cat) setActiveCategory('הכל');
                        }}
                        className="text-xs text-slate-400 hover:text-red-600"
                        title="מחק קטגוריה"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* טופס הוספה / עריכה של איש קשר */}
        {isFormOpen && (
          <form
            onSubmit={handleSaveContact}
            className="p-4 bg-blue-50/70 border-b-2 border-blue-200 space-y-3 shrink-0"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-blue-950">
                {editingId ? 'עריכת פרטי איש קשר באלפון' : '+ הוספת איש קשר חדש לאלפון המשרדי'}
              </h4>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-xs font-extrabold text-slate-600 hover:text-slate-900"
              >
                סגור טופס ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-0.5">
                  קטגוריה באלפון *
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-extrabold"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-0.5">
                  שם עובד / מנהל / איש קשר *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="למשל: יוסי כהן / עו״ד דנה לוי"
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-0.5">
                  שם רשות / ארגון / משרד עו&quot;ד
                </label>
                <input
                  type="text"
                  value={formOrganization}
                  onChange={(e) => setFormOrganization(e.target.value)}
                  placeholder="למשל: עיריית נתניה / משרד המשפטים"
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-0.5">
                  תפקיד מדויק / שיוך
                </label>
                <input
                  type="text"
                  value={formRoleTitle}
                  onChange={(e) => setFormRoleTitle(e.target.value)}
                  placeholder="למשל: מנהל אגף גבייה / נאמן"
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-0.5">
                  טלפון / נייד
                </label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="050-0000000 / 09-0000000"
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-700 mb-0.5">
                  דוא&quot;ל (Email)
                </label>
                <input
                  type="text"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="name@domain.co.il"
                  className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="הערות נוספות / שעות מענה / שלוחה ישירה..."
                className="flex-1 min-w-[240px] p-2 text-xs rounded-lg border border-slate-300 bg-white"
              />
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-2xs transition"
              >
                שמור באלפון המשרדי ✓
              </button>
            </div>
          </form>
        )}

        {/* רשימת אנשי הקשר */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/60">
          {filteredContacts.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-bold text-sm">
              לא נמצאו אנשי קשר התואמים לחיפוש או לקטגוריה שנבחרה.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredContacts.map((item) => {
                const linkedCase = item.related_case_id
                  ? cases.find((c) => c.id === item.related_case_id)
                  : null;

                return (
                  <div
                    key={item.id}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-2xs flex flex-col justify-between gap-2.5 transition"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-50 text-indigo-900 border border-indigo-200">
                          {item.category}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditForm(item)}
                            title="ערוך איש קשר"
                            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!item.is_auto_synced && (
                            <button
                              type="button"
                              onClick={() => handleDeleteContact(item)}
                              title="מחק איש קשר"
                              className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-extrabold text-slate-900">
                          {item.name}
                        </div>
                        {item.role_or_title && (
                          <div className="text-xs font-bold text-indigo-800">
                            {item.role_or_title}
                          </div>
                        )}
                        {item.organization && (
                          <div className="text-xs text-slate-600 font-semibold flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{item.organization}</span>
                          </div>
                        )}
                      </div>

                      {(item.phone || item.email) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
                          {item.phone && (
                            <a
                              href={`tel:${item.phone}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold hover:bg-emerald-100"
                            >
                              <Phone className="w-3 h-3 text-emerald-700" />
                              <span>{item.phone}</span>
                            </a>
                          )}
                          {item.email && (
                            <a
                              href={`mailto:${item.email}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 font-bold hover:bg-blue-100 truncate max-w-full"
                            >
                              <Mail className="w-3 h-3 text-blue-700 shrink-0" />
                              <span className="truncate">{item.email}</span>
                            </a>
                          )}
                        </div>
                      )}

                      {item.notes && (
                        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {item.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleCopyContact(item)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold inline-flex items-center gap-1 transition"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>הועתק ✓</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>העתק פרטים</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1.5">
                        {onPickContactForCase && (
                          <button
                            type="button"
                            onClick={() => {
                              onPickContactForCase(item);
                              onClose();
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold inline-flex items-center gap-1 transition"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>שלוף לתיעוד בתיק</span>
                          </button>
                        )}

                        {linkedCase && onSelectCase && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onSelectCase(linkedCase);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#0F172A] hover:bg-blue-700 text-white text-xs font-extrabold transition"
                          >
                            פתח תיק ➔
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
