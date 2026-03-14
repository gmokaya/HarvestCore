import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = "#0a2a2a";
const MUTED  = "#6b7280";
const LIGHT  = "#c7d7da";

export interface PDFReportOptions {
  title: string;
  subtitle?: string;
  filename?: string;
  summary?: Array<[string, string]>;
  sections: Array<{
    heading?: string;
    columns: string[];
    rows: (string | number | null)[][];
  }>;
}

export function downloadPDF(opts: PDFReportOptions) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const generated = new Date().toLocaleString("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  let cursorY = margin;

  const addPageFooter = () => {
    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(MUTED);
      doc.text(`Generated ${generated} · TokenHarvest Trade Finance`, margin, pageH - 8);
      doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 8, { align: "right" });
    }
  };

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(BRAND);
  doc.rect(0, 0, pageW, 18, "F");

  doc.setFontSize(13);
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.text("TokenHarvest", margin, 11);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(opts.title, margin + 44, 11);

  doc.setFontSize(8);
  doc.setTextColor("#c7d7da");
  doc.text(generated, pageW - margin, 11, { align: "right" });

  cursorY = 24;

  // ── Subtitle ────────────────────────────────────────────────────────────────
  if (opts.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.setFont("helvetica", "normal");
    doc.text(opts.subtitle, margin, cursorY);
    cursorY += 6;
  }

  // ── Summary block ───────────────────────────────────────────────────────────
  if (opts.summary && opts.summary.length > 0) {
    const colW = (pageW - margin * 2) / Math.min(opts.summary.length, 5);
    const boxH = 16;
    opts.summary.slice(0, 5).forEach(([label, value], i) => {
      const x = margin + i * colW;
      doc.setFillColor("#f8fafb");
      doc.setDrawColor(LIGHT);
      doc.roundedRect(x, cursorY, colW - 3, boxH, 2, 2, "FD");
      doc.setFontSize(7);
      doc.setTextColor(MUTED);
      doc.setFont("helvetica", "normal");
      doc.text(label.toUpperCase(), x + 4, cursorY + 5);
      doc.setFontSize(10);
      doc.setTextColor(BRAND);
      doc.setFont("helvetica", "bold");
      doc.text(String(value), x + 4, cursorY + 12);
    });
    cursorY += boxH + 6;
  }

  // ── Sections ────────────────────────────────────────────────────────────────
  opts.sections.forEach((section, si) => {
    if (si > 0) cursorY += 4;

    if (section.heading) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BRAND);
      doc.text(section.heading.toUpperCase(), margin, cursorY);
      cursorY += 5;
    }

    const safeRows = section.rows.map(row =>
      row.map(cell => (cell == null ? "—" : String(cell)))
    );

    autoTable(doc, {
      startY: cursorY,
      head: [section.columns],
      body: safeRows,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: "#111827",
        lineColor: "#e5e7eb",
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: BRAND,
        textColor: "#ffffff",
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: "#f9fafb" },
      didDrawPage: () => {
        doc.setFillColor(BRAND);
        doc.rect(0, 0, pageW, 18, "F");
        doc.setFontSize(13);
        doc.setTextColor("#ffffff");
        doc.setFont("helvetica", "bold");
        doc.text("TokenHarvest", margin, 11);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(opts.title, margin + 44, 11);
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 8;
  });

  addPageFooter();

  const filename = opts.filename ?? `${opts.title.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.pdf`;
  doc.save(filename);
}
