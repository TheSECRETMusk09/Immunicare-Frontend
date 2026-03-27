const createTextEncoder = () => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder();
  }

  if (typeof window !== "undefined" && typeof window.TextEncoder !== "undefined") {
    return new window.TextEncoder();
  }

  return {
    encode: (value) => {
      const input = unescape(encodeURIComponent(String(value ?? "")));
      return Uint8Array.from(input, (character) => character.charCodeAt(0));
    },
  };
};

const textEncoder = createTextEncoder();

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let current = index;
    for (let bit = 0; bit < 8; bit += 1) {
      current =
        (current & 1) === 1
          ? 0xedb88320 ^ (current >>> 1)
          : current >>> 1;
    }
    table[index] = current >>> 0;
  }
  return table;
})();

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const toUint8Array = (value) => {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  return textEncoder.encode(String(value ?? ""));
};

const computeCrc32 = (bytes) => {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const getDosDateTime = (date = new Date()) => {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime())
    ? date
    : new Date();

  const dosTime =
    ((safeDate.getHours() & 0x1f) << 11) |
    ((safeDate.getMinutes() & 0x3f) << 5) |
    Math.floor((safeDate.getSeconds() & 0x3f) / 2);
  const dosDate =
    (((Math.max(safeDate.getFullYear(), 1980) - 1980) & 0x7f) << 9) |
    (((safeDate.getMonth() + 1) & 0x0f) << 5) |
    (safeDate.getDate() & 0x1f);

  return { dosDate, dosTime };
};

const createStoredZipBlob = (entries) => {
  const preparedEntries = entries.map((entry) => {
    const nameBytes = textEncoder.encode(entry.name);
    const contentBytes = toUint8Array(entry.content);
    const { dosDate, dosTime } = getDosDateTime(entry.date);
    const crc32 = computeCrc32(contentBytes);

    return {
      nameBytes,
      contentBytes,
      dosDate,
      dosTime,
      crc32,
    };
  });

  let offset = 0;
  const localParts = [];
  const centralParts = [];

  preparedEntries.forEach((entry) => {
    const localHeader = new Uint8Array(30 + entry.nameBytes.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, entry.dosTime, true);
    localView.setUint16(12, entry.dosDate, true);
    localView.setUint32(14, entry.crc32, true);
    localView.setUint32(18, entry.contentBytes.length, true);
    localView.setUint32(22, entry.contentBytes.length, true);
    localView.setUint16(26, entry.nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(entry.nameBytes, 30);

    const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, entry.dosTime, true);
    centralView.setUint16(14, entry.dosDate, true);
    centralView.setUint32(16, entry.crc32, true);
    centralView.setUint32(20, entry.contentBytes.length, true);
    centralView.setUint32(24, entry.contentBytes.length, true);
    centralView.setUint16(28, entry.nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(entry.nameBytes, 46);

    localParts.push(localHeader, entry.contentBytes);
    centralParts.push(centralHeader);
    offset += localHeader.length + entry.contentBytes.length;
  });

  const centralDirectorySize = centralParts.reduce(
    (total, part) => total + part.length,
    0,
  );

  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, preparedEntries.length, true);
  endView.setUint16(10, preparedEntries.length, true);
  endView.setUint32(12, centralDirectorySize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endRecord], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
};

const downloadBlob = ({ blob, filename }) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const buildWordHeaderXml = (headerText = "") => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:b/>
        <w:sz w:val="18"/>
      </w:rPr>
      <w:t>${escapeXml(headerText)}</w:t>
    </w:r>
  </w:p>
</w:hdr>`;

const buildWordFooterXml = (footerText = "") => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:sz w:val="16"/>
      </w:rPr>
      <w:t>${escapeXml(footerText)}</w:t>
    </w:r>
    <w:r>
      <w:tab/>
      <w:t xml:space="preserve">Page </w:t>
    </w:r>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:t>1</w:t></w:r>
    <w:r><w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:ftr>`;

const buildDocumentXml = ({
  widthTwips,
  heightTwips,
  orientation,
  margins,
}) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:altChunk r:id="htmlChunk"/>
    <w:sectPr>
      <w:headerReference w:type="default" r:id="headerChunk"/>
      <w:footerReference w:type="default" r:id="footerChunk"/>
      <w:pgSz w:w="${widthTwips}" w:h="${heightTwips}"${
        orientation === "landscape" ? ' w:orient="landscape"' : ""
      }/>
      <w:pgMar
        w:top="${margins.top}"
        w:right="${margins.right}"
        w:bottom="${margins.bottom}"
        w:left="${margins.left}"
        w:header="${margins.header}"
        w:footer="${margins.footer}"
        w:gutter="${margins.gutter}"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const buildDocumentRelationshipsXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship
    Id="htmlChunk"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk"
    Target="afchunk.html"/>
  <Relationship
    Id="headerChunk"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header"
    Target="header1.xml"/>
  <Relationship
    Id="footerChunk"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer"
    Target="footer1.xml"/>
</Relationships>`;

const buildRootRelationshipsXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship
    Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
  <Relationship
    Id="rId2"
    Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"
    Target="docProps/core.xml"/>
  <Relationship
    Id="rId3"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties"
    Target="docProps/app.xml"/>
</Relationships>`;

const buildContentTypesXml = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="html" ContentType="text/html"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;

const buildCorePropsXml = ({ title, author, createdAt }) => {
  const isoDate = new Date(createdAt || Date.now()).toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties
  xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:dcmitype="http://purl.org/dc/dcmitype/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>${escapeXml(author)}</dc:creator>
  <cp:lastModifiedBy>${escapeXml(author)}</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${isoDate}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${isoDate}</dcterms:modified>
</cp:coreProperties>`;
};

const buildAppPropsXml = ({ title }) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties
  xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
  xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Immunicare</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Title</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>${escapeXml(title)}</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
  <Company>Immunicare</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>1.0</AppVersion>
</Properties>`;

const DEFAULT_PAGE_CONFIG = {
  widthTwips: 12240,
  heightTwips: 15840,
  orientation: "portrait",
  margins: {
    top: 720,
    right: 720,
    bottom: 720,
    left: 720,
    header: 360,
    footer: 360,
    gutter: 0,
  },
};

export const PRINT_PAGE_PRESETS = {
  a4Portrait: {
    widthTwips: 11909,
    heightTwips: 16834,
    orientation: "portrait",
  },
  a4Landscape: {
    widthTwips: 16834,
    heightTwips: 11909,
    orientation: "landscape",
  },
  folioPortrait: {
    widthTwips: 12240,
    heightTwips: 18720,
    orientation: "portrait",
  },
  folioLandscape: {
    widthTwips: 18720,
    heightTwips: 12240,
    orientation: "landscape",
  },
  legalPortrait: {
    widthTwips: 12240,
    heightTwips: 20160,
    orientation: "portrait",
  },
  legalLandscape: {
    widthTwips: 20160,
    heightTwips: 12240,
    orientation: "landscape",
  },
  letterPortrait: {
    widthTwips: 12240,
    heightTwips: 15840,
    orientation: "portrait",
  },
  letterLandscape: {
    widthTwips: 15840,
    heightTwips: 12240,
    orientation: "landscape",
  },
};

export const downloadWordDocument = ({
  html,
  filename,
  title,
  author = "Immunicare",
  headerText = "",
  footerText = "",
  page = DEFAULT_PAGE_CONFIG,
}) => {
  const resolvedPage = {
    ...DEFAULT_PAGE_CONFIG,
    ...page,
    margins: {
      ...DEFAULT_PAGE_CONFIG.margins,
      ...(page?.margins || {}),
    },
  };

  const blob = createStoredZipBlob([
    { name: "[Content_Types].xml", content: buildContentTypesXml() },
    { name: "_rels/.rels", content: buildRootRelationshipsXml() },
    {
      name: "docProps/core.xml",
      content: buildCorePropsXml({ title, author, createdAt: Date.now() }),
    },
    {
      name: "docProps/app.xml",
      content: buildAppPropsXml({ title }),
    },
    {
      name: "word/document.xml",
      content: buildDocumentXml(resolvedPage),
    },
    {
      name: "word/_rels/document.xml.rels",
      content: buildDocumentRelationshipsXml(),
    },
    {
      name: "word/header1.xml",
      content: buildWordHeaderXml(headerText),
    },
    {
      name: "word/footer1.xml",
      content: buildWordFooterXml(footerText),
    },
    {
      name: "word/afchunk.html",
      content: html,
    },
  ]);

  downloadBlob({
    blob,
    filename,
  });
};

export const downloadHtmlFile = ({
  html,
  filename,
  mimeType = "text/html",
}) => {
  const blob = new Blob([html], { type: mimeType });
  downloadBlob({ blob, filename });
};

const TWIPS_PER_INCH = 1440;
const MM_PER_INCH = 25.4;

const resolvePageConfig = (page = DEFAULT_PAGE_CONFIG) => ({
  ...DEFAULT_PAGE_CONFIG,
  ...page,
  margins: {
    ...DEFAULT_PAGE_CONFIG.margins,
    ...(page?.margins || {}),
  },
});

const twipsToMillimeters = (twips) =>
  Number(((Number(twips) || 0) * MM_PER_INCH / TWIPS_PER_INCH).toFixed(2));

const resolvePdfPageConfig = (page = DEFAULT_PAGE_CONFIG) => {
  const resolvedPage = resolvePageConfig(page);
  const widthMm = twipsToMillimeters(resolvedPage.widthTwips);
  const heightMm = twipsToMillimeters(resolvedPage.heightTwips);

  return {
    ...resolvedPage,
    widthMm,
    heightMm,
    orientation:
      resolvedPage.orientation ||
      (widthMm > heightMm ? "landscape" : "portrait"),
  };
};

const toVisibleExportClone = (node) => {
  const clone = node.cloneNode(true);

  if (clone instanceof HTMLElement) {
    clone.style.display = "block";
    clone.style.visibility = "visible";
    clone.style.opacity = "1";
    clone.removeAttribute("hidden");
  }

  return clone;
};

export const downloadPdfFromNode = async ({
  node,
  filename,
  title = "",
  headerText = "",
  footerText = "",
  page = DEFAULT_PAGE_CONFIG,
  marginsMm = {},
  scale = 0.75,
  backgroundColor = "#ffffff",
  onClone,
}) => {
  if (!node || typeof document === "undefined") {
    return;
  }

  const [{ default: jsPDF }] = await Promise.all([import("jspdf")]);
  const resolvedPage = resolvePdfPageConfig(page);
  const pageMargins = {
    top: 12,
    right: 10,
    bottom: 12,
    left: 10,
    ...marginsMm,
  };
  const headerBandHeight = headerText ? 6 : 0;
  const footerBandHeight = footerText ? 6 : 0;
  const doc = new jsPDF({
    orientation: resolvedPage.orientation,
    unit: "mm",
    format: [resolvedPage.widthMm, resolvedPage.heightMm],
    compress: true,
    putOnlyUsedFonts: true,
  });

  if (title) {
    doc.setProperties({ title });
  }

  const exportRoot = document.createElement("div");
  exportRoot.className = "immunicare-print-export-root";
  Object.assign(exportRoot.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${resolvedPage.widthMm - pageMargins.left - pageMargins.right}mm`,
    padding: "0",
    margin: "0",
    background: backgroundColor,
    color: "#111827",
    zIndex: "-1",
    pointerEvents: "none",
    boxSizing: "border-box",
  });

  const exportStyle = document.createElement("style");
  exportStyle.textContent = `
    .immunicare-print-export-root,
    .immunicare-print-export-root * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      box-sizing: border-box;
    }
  `;
  exportRoot.appendChild(exportStyle);

  const clone = toVisibleExportClone(node);
  if (typeof onClone === "function") {
    onClone(clone, exportRoot);
  }

  exportRoot.appendChild(clone);
  document.body.appendChild(exportRoot);

  try {
    await doc.html(exportRoot, {
      x: pageMargins.left,
      y: pageMargins.top + headerBandHeight,
      width: resolvedPage.widthMm - pageMargins.left - pageMargins.right,
      windowWidth: Math.max(exportRoot.scrollWidth || 0, 1200),
      autoPaging: "text",
      margin: [
        pageMargins.top + headerBandHeight,
        pageMargins.right,
        pageMargins.bottom + footerBandHeight,
        pageMargins.left,
      ],
      html2canvas: {
        scale,
        useCORS: true,
        backgroundColor,
        logging: false,
      },
      callback: (pdfDocument) => {
        const totalPages = pdfDocument.getNumberOfPages();
        const pageWidth = pdfDocument.internal.pageSize.getWidth();
        const pageHeight = pdfDocument.internal.pageSize.getHeight();

        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
          pdfDocument.setPage(pageNumber);

          if (headerText) {
            pdfDocument.setFont("helvetica", "bold");
            pdfDocument.setFontSize(9);
            pdfDocument.setTextColor(17, 24, 39);
            pdfDocument.text(headerText, pageWidth / 2, 7, {
              align: "center",
            });
          }

          if (footerText) {
            pdfDocument.setDrawColor(203, 213, 225);
            pdfDocument.line(
              pageMargins.left,
              pageHeight - 7.5,
              pageWidth - pageMargins.right,
              pageHeight - 7.5,
            );
            pdfDocument.setFont("helvetica", "normal");
            pdfDocument.setFontSize(8);
            pdfDocument.setTextColor(71, 85, 105);
            pdfDocument.text(
              footerText,
              pageMargins.left,
              pageHeight - 4.5,
            );
            pdfDocument.text(
              `Page ${pageNumber} of ${totalPages}`,
              pageWidth - pageMargins.right,
              pageHeight - 4.5,
              { align: "right" },
            );
          }
        }

        pdfDocument.save(filename);
      },
    });
  } finally {
    if (exportRoot.parentNode) {
      exportRoot.parentNode.removeChild(exportRoot);
    }
  }
};
