-- ============================================================================
-- מערכת ניהול תיקים משפטיים - סכמת מסד נתונים מלאה (PostgreSQL / Supabase)
-- מותאם ל-4 עולמות התוכן:
-- 1. תיקי רשויות (גבייה והוצל"פ) — כחול/אינדיגו
-- 2. תיקי חדל"פ (ייצוג נושה / פירוק) — סגול
-- 3. תיקי חברות (נאמן / מפרק) — טורקיז/אמרלד
-- 4. חברה משכנת (רישום וזכויות) — ענבר/כתום
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. טבלת משתמשים והרשאות (system_users) - הפרדה בין מנהל (admin) לעובד (user)
CREATE TABLE IF NOT EXISTS public.system_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE CHECK (char_length(trim(username)) > 0),
    display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) > 0),
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    password TEXT NOT NULL DEFAULT '1111',
    title TEXT DEFAULT 'עורך דין / צוות משרד',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. טבלת הגדרות שכר טרחה וכללים לפי רשות (municipalities_settings)
CREATE TABLE IF NOT EXISTS public.municipalities_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    municipality_name TEXT NOT NULL UNIQUE CHECK (char_length(trim(municipality_name)) > 0),
    fee_calculation_method TEXT NOT NULL DEFAULT 'אחוזים' CHECK (
        fee_calculation_method IN ('אחוזים', 'סכום קבוע', 'מדרגות הוצל"פ')
    ),
    fee_rate_value NUMERIC(12, 2) NOT NULL DEFAULT 15.00,
    fee_tariff_description TEXT NOT NULL DEFAULT '',
    interest_and_expenses_rules TEXT NOT NULL DEFAULT '',
    standing_instructions TEXT NOT NULL DEFAULT '',
    contact_person TEXT DEFAULT '',
    updated_by TEXT DEFAULT 'מנהל מערכת',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. טבלת תיקים משפטיים (cases) - מאוחדת לכל 4 התחומים עם שדות ייעודיים לכל תחום
CREATE TABLE IF NOT EXISTS public.cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debtor_name TEXT NOT NULL CHECK (char_length(trim(debtor_name)) > 0), -- שם חייב / חברה / פרויקט
    id_or_hp TEXT DEFAULT '',                                            -- ת"ז / ח"פ
    case_number TEXT DEFAULT '',                                         -- מספר תיק ביהמ"ש / הוצל"פ / ממונה
    gush_helka TEXT DEFAULT '',                                          -- גוש / חלקה / תת-חלקה
    category TEXT NOT NULL CHECK (
        category IN ('גבייה', 'חדל"פ', 'חברות', 'חברה משכנת')
    ),
    current_stage TEXT NOT NULL DEFAULT 'פתיחת תיק ובדיקות מקדמיות',
    municipality TEXT,                                                   -- שם עירייה / רשות מקומית
    tags TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'פעיל' CHECK (
        status IN (
            'פעיל',
            'לפני תביעה',
            'בהוצל"פ',
            'בהסדר',
            'בהסדר תשלומים',
            'ממתין להחלטה',
            'הגשה ממתינה לביהמ"ש',
            'דיון קבוע',
            'דיון נדחה',
            'סיום הסדר / סילוק חוב',
            'מחיקת חוב ישן',
            'סגור'
        )
    ),
    notes TEXT DEFAULT '',
    next_action_type TEXT DEFAULT 'אחר' CHECK (
        next_action_type IS NULL OR next_action_type IN (
            'דיון',
            'דיון שנדחה',
            'הגשה לביהמ"ש',
            'דו"ח עדכון נאמן',
            'בקשה ממתינה',
            'תגובה',
            'תשובה',
            'תביעת חוב',
            'בקשת צו הבאה',
            'השלמת מסמכים',
            'מעקב הסדר',
            'פתיחת תביעה בהוצל"פ',
            'רישום משכון',
            'שחרור עיקולים וסגירה',
            'חוות דעת למחיקת חוב',
            'בדיקת תצ"ר / מודד',
            'העברת זכויות והנפקת אישור',
            'בקשת חיסול',
            'אחר'
        )
    ),
    next_action_description TEXT DEFAULT '',
    next_due_date DATE,
    extensions_count INTEGER NOT NULL DEFAULT 0,                         -- מונה ארכות / דחיות דיון
    is_hearing_postponed BOOLEAN NOT NULL DEFAULT FALSE,                 -- האם הדיון נדחה (מסומן ב-'נדחה')
    postponed_reason TEXT DEFAULT '',                                    -- סיבת הדחייה / הארכה האחרונה
    trustee_report_due_date DATE,                                        -- מועד עדכון דו"ח נאמן (עוד X ימים)

    -- ========================================================================
    -- תחום 1: תיקי רשויות (גבייה והוצל"פ)
    -- ========================================================================
    debt_years TEXT DEFAULT '',
    principal_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    interest_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expenses_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    legal_fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_debt_amount NUMERIC(12, 2) GENERATED ALWAYS AS (
        COALESCE(principal_amount, 0) + COALESCE(interest_amount, 0) + COALESCE(expenses_amount, 0) + COALESCE(legal_fee_amount, 0)
    ) STORED,

    gachlat_status TEXT DEFAULT 'חסר גח"לת' CHECK (
        gachlat_status IS NULL OR gachlat_status IN ('התקבל ואומת', 'חסר גח"לת', 'נדרש בירור')
    ),
    has_property BOOLEAN NOT NULL DEFAULT FALSE,
    property_details TEXT DEFAULT '',
    warning_letter_sent_date DATE,
    delivery_confirmation_date DATE,
    execution_target_date DATE,                                          -- מחושב אוטומטית: אישור מסירה + 30 ימים

    execution_proceedings_notes TEXT DEFAULT '',
    monthly_reductions JSONB NOT NULL DEFAULT '[]'::jsonb,               -- יומן הפחתות חודשי
    milestones JSONB NOT NULL DEFAULT '[]'::jsonb,                       -- משימות, צ'ק-ליסט, דחיפות ומדידת זמנים

    is_old_debt_writeoff BOOLEAN NOT NULL DEFAULT FALSE,
    writeoff_classification TEXT CHECK (
        writeoff_classification IS NULL OR writeoff_classification IN (
            'התיישנות',
            'חוסר כדאיות כלכלית',
            'היעדר נכסים/איתור',
            'חדל"פ/פטור',
            'אחר'
        )
    ),
    legal_opinion_summary TEXT DEFAULT '',

    -- ========================================================================
    -- תחום 2: תיקי חדל"פ (ייצוג נושה / פירוק)
    -- ========================================================================
    is_material_creditor BOOLEAN NOT NULL DEFAULT FALSE,                 -- מתג בולט: נושה מהותי בתיק (כן/לא)
    insolvency_debtor_type TEXT DEFAULT 'חייב יחיד' CHECK (
        insolvency_debtor_type IS NULL OR insolvency_debtor_type IN ('חייב יחיד', 'חברה בפירוק')
    ),
    trustee_name_and_contact TEXT DEFAULT '',                            -- פרטי נאמן / מפרק
    debt_claim_deadline DATE,                                            -- מועד אחרון להגשת תביעת חוב
    debt_claim_submitted BOOLEAN NOT NULL DEFAULT FALSE,                 -- האם הוגשה תביעת חוב
    debt_claim_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,                 -- סכום תביעת החוב
    creditor_responses_notes TEXT DEFAULT '',                            -- תגובות נושה (מודגש בתיק מהותי)
    new_debts_tracking TEXT DEFAULT '',                                  -- מעקב חובות חדשים (בדיקה מול נאמן / בקשה לביטול הליכים)

    -- ========================================================================
    -- תחום 3: תיקי חברות (נאמן / מפרק)
    -- ========================================================================
    self_undertaking_deposited BOOLEAN NOT NULL DEFAULT FALSE,           -- הפקדת התחייבות עצמית (100,000 ₪)
    self_undertaking_date DATE,
    insurance_and_assets_letters_status TEXT DEFAULT '',                 -- מכתבים לחברות ביטוח ואיתור נכסים
    representative_contact_details TEXT DEFAULT '',                      -- פנייה למייצג ותיאום מועד פנוי של הנאמן החוקר
    investigating_trustee_name TEXT DEFAULT '',                          -- שם הנאמן החוקר
    investigation_scheduled_date DATE,                                   -- מועד חקירה מתואם
    required_documents_checklist TEXT DEFAULT '',                        -- סט מסמכים נדרש
    investigation_outcome TEXT DEFAULT 'טרם נחקר' CHECK (
        investigation_outcome IS NULL OR investigation_outcome IN (
            'טרם נחקר',
            'התייצב ונחקר',
            'לא התייצב לחקירה',
            'חסרים מסמכים'
        )
    ),
    missing_documents_details TEXT DEFAULT '',                           -- מעקב השלמות מסמכים
    trustee_findings_summary TEXT DEFAULT '',                            -- דו"ח נאמן ועדכון ממצאים
    company_resolution_decision TEXT DEFAULT 'טרם הוכרע' CHECK (
        company_resolution_decision IS NULL OR company_resolution_decision IN (
            'טרם הוכרע',
            'שיקום כלכלי',
            'פירוק חברה'
        )
    ),

    -- ========================================================================
    -- תחום 4: פרויקטים של "חברה משכנת" (רישום וזכויות)
    -- ========================================================================
    housing_project_name TEXT DEFAULT '',                                -- שם הפרויקט / מתחם
    liquidators_sale_approval BOOLEAN NOT NULL DEFAULT FALSE,            -- אישור מפרקים למכירת זכויות
    physical_files_location TEXT DEFAULT '',                             -- ניהול תיקים פיזיים (ארכיב/מדף)
    rights_certificate_issued BOOLEAN NOT NULL DEFAULT FALSE,            -- הנפקת אישור זכויות
    surveyor_name TEXT DEFAULT '',                                       -- שם המודד
    tazar_status TEXT DEFAULT '',                                        -- מעקב מול מודד על תצ"רים
    parking_tazar_handled BOOLEAN NOT NULL DEFAULT FALSE,                -- סימון/טיפול בתצ"ר חניות
    parking_tazar_notes TEXT DEFAULT '',
    condominium_registration_fit TEXT DEFAULT 'בבדיקה' CHECK (
        condominium_registration_fit IS NULL OR condominium_registration_fit IN (
            'תקין ומתאים לרישום',
            'דורש תיקון מודד',
            'בבדיקה'
        )
    ),
    invoices_court_control TEXT DEFAULT '',                              -- בקרת חשבוניות מול אישור ביהמ"ש, ההסכם, צורת התשלום והמועדים
    seller_buyer_names TEXT DEFAULT '',                                  -- העברת זכויות מרוכש לקונה
    transfer_signing_docs_complete BOOLEAN NOT NULL DEFAULT FALSE,       -- סט מסמכי חתימה מלא
    transfer_liquidator_approved BOOLEAN NOT NULL DEFAULT FALSE,         -- אישור המפרק להעברת זכויות
    transfer_process_stage TEXT DEFAULT '',                              -- שלב בחינה וביצוע
    new_buyer_certificate_issued BOOLEAN NOT NULL DEFAULT FALSE,         -- הפקת אישור זכויות על שם הקונה החדש

    last_modified_by TEXT DEFAULT 'מנהל מערכת',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. טבלת תרשומות שיחה, הערות, תזכורות, החלטות וארכות (case_logs)
CREATE TABLE IF NOT EXISTS public.case_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    log_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    log_type TEXT NOT NULL DEFAULT 'תרשומת שיחה' CHECK (
        log_type IN (
            'תרשומת שיחה',
            'הערה',
            'תזכורת אישית/מועד',
            'החלטת ביהמ"ש',
            'בקשת ארכה / דחיית דיון',
            'פעולה שבוצעה',
            'פעולה נדרשת',
            'דיווח הפחתה'
        )
    ),
    content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
    due_date DATE,
    created_by TEXT NOT NULL DEFAULT 'מנהל מערכת'
);

-- ============================================================================
-- אינדקסים לביצועים מהירים וסינון מיידי לפי 4 התחומים
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_cases_category ON public.cases(category);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_next_due_date ON public.cases(next_due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_cases_trustee_report_due ON public.cases(trustee_report_due_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_cases_municipality ON public.cases(municipality);
CREATE INDEX IF NOT EXISTS idx_cases_tags_gin ON public.cases USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_cases_updated_at ON public.cases(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_logs_case_id_date ON public.case_logs(case_id, log_date DESC);

-- ============================================================================
-- טריגרים לעדכון אוטומטי של updated_at וחישוב 30 יום מאישור מסירה
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_cases_before_save()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    IF NEW.delivery_confirmation_date IS NOT NULL THEN
        NEW.execution_target_date = (NEW.delivery_confirmation_date + INTERVAL '30 days')::DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_cases_updated_at ON public.cases;
CREATE TRIGGER set_cases_updated_at
    BEFORE INSERT OR UPDATE ON public.cases
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_cases_before_save();

CREATE OR REPLACE FUNCTION public.touch_parent_case_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.cases
    SET updated_at = NOW()
    WHERE id = COALESCE(NEW.case_id, OLD.case_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS touch_case_on_log_change ON public.case_logs;
CREATE TRIGGER touch_case_on_log_change
    AFTER INSERT OR UPDATE OR DELETE ON public.case_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_parent_case_updated_at();

-- ============================================================================
-- הגדרות אבטחה (Row Level Security - RLS)
-- ============================================================================
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipalities_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access to system_users" ON public.system_users;
CREATE POLICY "Allow authenticated full access to system_users"
    ON public.system_users
    FOR ALL
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated full access to municipalities_settings" ON public.municipalities_settings;
CREATE POLICY "Allow authenticated full access to municipalities_settings"
    ON public.municipalities_settings
    FOR ALL
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated full access to cases" ON public.cases;
CREATE POLICY "Allow authenticated full access to cases"
    ON public.cases
    FOR ALL
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow authenticated full access to case_logs" ON public.case_logs;
CREATE POLICY "Allow authenticated full access to case_logs"
    ON public.case_logs
    FOR ALL
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
