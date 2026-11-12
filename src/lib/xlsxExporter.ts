// ============================================================================
// מחולל קבצי אקסל אמיתיים (.xlsx) מבוסס תקן OpenXML (ZIP + XML)
// ללא צורך בחבילות חיצוניות — תומך בגיליונות מרובים, כיווניות RTL לעברית,
// רוחב עמודות מותאם, וטיפוסי נתונים (טקסט ומספרים)
// ============================================================================

export interface XlsxSheetData {
  name: string; // שם הגיליון (עד 31 תווים)
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  columnWidths?: number[];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // הסרת תווי בקרה שאינם חוקיים ב-XML 1.0
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function colIndexToLetter(colIdx: number): string {
  let letter = '';
  let temp = colIdx + 1;
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

function buildWorksheetXml(sheet: XlsxSheetData): string {
  const colsXml =
    sheet.columnWidths && sheet.columnWidths.length > 0
      ? `<cols>${sheet.columnWidths
          .map(
            (w, idx) =>
              `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`
          )
          .join('')}</cols>`
      : `<cols>${sheet.headers
          .map(
            (_, idx) =>
              `<col min="${idx + 1}" max="${idx + 1}" width="22" customWidth="1"/>`
          )
          .join('')}</cols>`;

  let rowsXml = '';

  // שורת כותרת (שורה 1, סגנון s="1")
  const headerCells = sheet.headers
    .map((h, cIdx) => {
      const ref = `${colIndexToLetter(cIdx)}1`;
      return `<c r="${ref}" t="inlineStr" s="1"><is><t>${escapeXml(
        String(h ?? '')
      )}</t></is></c>`;
    })
    .join('');
  rowsXml += `<row r="1" ht="24" customHeight="1">${headerCells}</row>`;

  // שורות נתונים
  sheet.rows.forEach((row, rIdx) => {
    const rowNum = rIdx + 2;
    const cells = row
      .map((val, cIdx) => {
        const ref = `${colIndexToLetter(cIdx)}${rowNum}`;
        if (typeof val === 'number' && !Number.isNaN(val)) {
          return `<c r="${ref}" t="n" s="2"><v>${val}</v></c>`;
        }
        if (typeof val === 'boolean') {
          return `<c r="${ref}" t="inlineStr" s="0"><is><t>${
            val ? 'כן' : 'לא'
          }</t></is></c>`;
        }
        const strVal = val === null || val === undefined ? '' : String(val);
        return `<c r="${ref}" t="inlineStr" s="0"><is><t>${escapeXml(
          strVal
        )}</t></is></c>`;
      })
      .join('');
    rowsXml += `<row r="${rowNum}" ht="19">${cells}</row>`;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView rightToLeft="1" tabSelected="1" workbookViewId="0"/>
  </sheetViews>
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Arial"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFE2E8F0"/></left>
      <right style="thin"><color rgb="FFE2E8F0"/></right>
      <top style="thin"><color rgb="FFE2E8F0"/></top>
      <bottom style="thin"><color rgb="FFE2E8F0"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/>
    </xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/>
    </xf>
    <xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center" readingOrder="2"/>
    </xf>
  </cellXfs>
</styleSheet>`;
}

// ============================================================================
// CRC32 & Uncompressed ZIP Builder (Store Method 0)
// ============================================================================
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  path: string;
  content: Uint8Array;
}

function createZipArchive(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const data = entry.content;
    const crc = crc32(data);
    const size = data.length;

    // Local file header (30 bytes + file name)
    const localHeader = new Uint8Array(30 + nameBytes.length + size);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Signature
    lv.setUint16(4, 20, true); // Version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // Compression method (0 = Store)
    lv.setUint16(10, 0, true); // Last mod time
    lv.setUint16(12, 0, true); // Last mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // Compressed size
    lv.setUint32(22, size, true); // Uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);
    localHeader.set(data, 30 + nameBytes.length);
    localHeaders.push(localHeader);

    // Central directory header (46 bytes + file name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // Store
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralHeaders.push(centralHeader);

    offset += localHeader.length;
  }

  const centralDirSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD Signature
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalLength = offset + centralDirSize + eocd.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const lh of localHeaders) {
    result.set(lh, pos);
    pos += lh.length;
  }
  for (const ch of centralHeaders) {
    result.set(ch, pos);
    pos += ch.length;
  }
  result.set(eocd, pos);
  return result;
}

export function downloadXlsxFile(filename: string, sheets: XlsxSheetData[]): void {
  const encoder = new TextEncoder();
  const safeSheets = sheets.length > 0 ? sheets : [{ name: 'נתונים', headers: ['ריק'], rows: [] }];

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${safeSheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ')}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${safeSheets
      .map((s, i) => {
        const cleanName = escapeXml(
          s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `גיליון ${i + 1}`
        );
        return `<sheet name="${cleanName}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
      })
      .join('\n    ')}
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${safeSheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
          i + 1
        }.xml"/>`
    )
    .join('\n  ')}
  <Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const entries: ZipEntry[] = [
    { path: '[Content_Types].xml', content: encoder.encode(contentTypesXml) },
    { path: '_rels/.rels', content: encoder.encode(rootRelsXml) },
    { path: 'xl/workbook.xml', content: encoder.encode(workbookXml) },
    { path: 'xl/_rels/workbook.xml.rels', content: encoder.encode(workbookRelsXml) },
    { path: 'xl/styles.xml', content: encoder.encode(buildStylesXml()) },
    ...safeSheets.map((s, i) => ({
      path: `xl/worksheets/sheet${i + 1}.xml`,
      content: encoder.encode(buildWorksheetXml(s)),
    })),
  ];

  const zipBytes = createZipArchive(entries);
  const blob = new Blob([zipBytes as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
