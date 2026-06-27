import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportColumn {
  header: string;
  dataKey: string;
  align?: 'left' | 'center' | 'right';
  width?: number | 'auto';
}

export interface ReportConfig {
  title: string;
  reportPeriod: string;
  summary: Array<{ label: string; value: string }>;
  columns: ReportColumn[];
  data: any[];
  filename: string;
  logoBase64?: string;
}

// jsPDF's built-in helvetica font cannot render ₹ or other non-latin characters.
// Strip them and replace with safe ASCII equivalents.
function safe(text: string): string {
  return String(text)
    .replace(/₹/g, 'Rs.')
    .replace(/[^\x00-\x7F]/g, '');
}

export function generateStandardReport(config: ReportConfig) {
  // A4 portrait: 595 x 842 pt
  const doc = new jsPDF('portrait', 'pt', 'a4');
  const margin = 36;
  const pageWidth = doc.internal.pageSize.getWidth();   // 595
  const pageHeight = doc.internal.pageSize.getHeight(); // 842

  let currentY = 36;

  // ── Logo ──────────────────────────────────────────────────────────────────
  if (config.logoBase64) {
    doc.addImage(config.logoBase64, 'PNG', margin, currentY, 50, 50);
  } else {
    doc.setFillColor(30, 82, 160);
    doc.rect(margin, currentY, 50, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('OVAL', margin + 25, currentY + 28, { align: 'center' });
  }

  // ── Title ─────────────────────────────────────────────────────────────────
  doc.setTextColor(26, 26, 26);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(safe(config.title), margin + 65, currentY + 32);

  currentY += 65;

  // ── Meta row ──────────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(136, 136, 136);
  doc.text('Generated On', margin, currentY);
  doc.text('Report Period', margin + 240, currentY);

  currentY += 14;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 26);
  const generatedDate = new Date().toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  doc.text(safe(generatedDate), margin, currentY);
  doc.text(safe(config.reportPeriod), margin + 240, currentY);

  currentY += 30;

  // ── Summary boxes ─────────────────────────────────────────────────────────
  if (config.summary && config.summary.length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 82, 160);
    doc.text('Summary', margin, currentY);

    currentY += 8;
    doc.setDrawColor(30, 82, 160);
    doc.setLineWidth(1.5);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 15;

    const gap = 10;
    const boxW = (pageWidth - margin * 2 - gap * (config.summary.length - 1)) / config.summary.length;
    const boxH = 65;

    config.summary.forEach((item, i) => {
      const x = margin + i * (boxW + gap);
      doc.setDrawColor(208, 208, 208);
      doc.setLineWidth(1);
      doc.setFillColor(255, 255, 255);
      doc.rect(x, currentY, boxW, boxH, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(136, 136, 136);
      doc.text(safe(item.label), x + boxW / 2, currentY + 22, { align: 'center' });

      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 26, 26);
      doc.text(safe(item.value), x + boxW / 2, currentY + 48, { align: 'center' });
    });

    currentY += boxH + 20;
  }

  // ── Table section header ───────────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 82, 160);
  doc.text('Transaction Details', margin, currentY);

  currentY += 8;
  doc.setDrawColor(30, 82, 160);
  doc.setLineWidth(1.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 12;

  // ── Table ─────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: currentY,
    head: [config.columns.map(c => c.header)],
    body: config.data.map(row =>
      config.columns.map(c => safe(String(row[c.dataKey] ?? '')))
    ),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: [26, 26, 26],
      lineColor: [208, 208, 208],
      lineWidth: 0.5,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [44, 44, 44],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [242, 242, 242],
    },
    columnStyles: config.columns.reduce((acc, col, idx) => {
      acc[idx] = {
        halign: col.align || 'left',
        cellWidth: col.width || 'auto',
      };
      return acc;
    }, {} as any),
    margin: { left: margin, right: margin, bottom: 50 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(136, 136, 136);
      doc.text(
        'Auto-generated by The Oval Management System',
        pageWidth / 2,
        pageHeight - 20,
        { align: 'center' }
      );
    },
    willDrawCell: (data) => {
      if (data.section === 'body' && config.columns[data.column.index].dataKey === 'type') {
        const val = String(data.cell.raw).toUpperCase();
        if (val === 'SALE') {
          doc.setTextColor(46, 125, 50);
          doc.setFont('helvetica', 'bold');
        } else if (val === 'BOOKING') {
          doc.setTextColor(30, 82, 160);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(136, 136, 136);
        }
      }
    },
  });

  doc.save(config.filename);
}
