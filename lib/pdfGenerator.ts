import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PDFOptions {
  title: string;
  dateRange: string;
  metrics: { label: string; value: string | number }[];
  anomalies?: { title: string; description: string; severity: string }[];
  tables?: { title: string; headers: string[]; rows: (string | number)[][] }[];
}

export const generatePDF = (options: PDFOptions) => {
  const doc = new jsPDF();
  let yOffset = 20;

  // --- Header / Branding ---
  doc.setFontSize(22);
  doc.setTextColor(33, 150, 83); // var(--primary-500)
  doc.text('OVAL TURF', 14, yOffset);
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Official System Report', 14, yOffset + 8);
  yOffset += 20;

  // --- Title & Date ---
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(options.title, 14, yOffset);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date/Range: ${options.dateRange} | Generated: ${new Date().toLocaleString()}`, 14, yOffset + 6);
  yOffset += 15;

  doc.setLineWidth(0.5);
  doc.line(14, yOffset, 196, yOffset);
  yOffset += 10;

  // --- Key Metrics ---
  if (options.metrics && options.metrics.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('Key Metrics', 14, yOffset);
    yOffset += 8;

    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    options.metrics.forEach((metric, idx) => {
      // 2 columns
      const xPos = idx % 2 === 0 ? 14 : 105;
      doc.text(`${metric.label}: ${metric.value}`, xPos, yOffset);
      if (idx % 2 !== 0) yOffset += 7;
    });
    if (options.metrics.length % 2 !== 0) yOffset += 7;
    yOffset += 5;
  }

  // --- Anomalies Summary ---
  if (options.anomalies && options.anomalies.length > 0) {
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38); // Danger color
    doc.text('Active Anomalies / Alerts', 14, yOffset);
    yOffset += 8;

    doc.setFontSize(10);
    options.anomalies.forEach((anomaly) => {
      if (yOffset > 270) { doc.addPage(); yOffset = 20; }
      
      doc.setTextColor(185, 28, 28);
      doc.text(`[${anomaly.severity.toUpperCase()}] ${anomaly.title}`, 14, yOffset);
      yOffset += 5;
      
      doc.setTextColor(100, 116, 139);
      const splitDesc = doc.splitTextToSize(anomaly.description, 180);
      doc.text(splitDesc, 14, yOffset);
      yOffset += (splitDesc.length * 5) + 4;
    });
    yOffset += 5;
  }

  // --- Tables ---
  if (options.tables && options.tables.length > 0) {
    options.tables.forEach(table => {
      if (yOffset > 250) { doc.addPage(); yOffset = 20; }
      
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(table.title, 14, yOffset);
      yOffset += 8;

      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.setFillColor(33, 150, 83);
      doc.rect(14, yOffset - 5, 182, 7, 'F');
      
      // Headers
      const colWidth = 182 / table.headers.length;
      table.headers.forEach((header, i) => {
        doc.text(header, 16 + (i * colWidth), yOffset);
      });
      yOffset += 6;

      // Rows
      doc.setTextColor(51, 65, 85);
      table.rows.forEach(row => {
        if (yOffset > 280) { 
          doc.addPage(); 
          yOffset = 20; 
          doc.setTextColor(255, 255, 255);
          doc.setFillColor(33, 150, 83);
          doc.rect(14, yOffset - 5, 182, 7, 'F');
          table.headers.forEach((header, i) => {
            doc.text(header, 16 + (i * colWidth), yOffset);
          });
          yOffset += 6;
          doc.setTextColor(51, 65, 85);
        }
        
        row.forEach((cell, i) => {
          const splitCell = doc.splitTextToSize(String(cell), colWidth - 4);
          doc.text(splitCell, 16 + (i * colWidth), yOffset);
        });
        yOffset += 7;
      });
      yOffset += 10;
    });
  }

  doc.autoPrint();
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};
