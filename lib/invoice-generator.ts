import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import numWords from 'num-words';

export function generateTaxInvoice(booking: any, logoBase64?: string, action: 'download' | 'print' = 'download', signatureBase64?: string, qrBase64?: string, bankName?: string, bankAccount?: string, bankIfsc?: string, bankHolder?: string) {
  const doc = new jsPDF('portrait', 'pt', 'a4');
  
  // Set default font to helvetica
  doc.setFont('helvetica');

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const isCompleted = booking.paymentStatus === 'paid';
  const docTitle = isCompleted ? 'Tax Invoice' : 'Proforma Invoice';
  doc.text(docTitle, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });

  // Main Box border
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  
  let currentY = 50;

  // Draw Top Section Box
  doc.setLineWidth(1);
  // Outer rectangle for the top header section
  doc.rect(margin, currentY, contentWidth, 100);

  // Vertical lines for top section
  const col1Width = 100; // Logo box
  const col2Width = 180; // Company details
  const col3Width = contentWidth - col1Width - col2Width; 
  
  // Actually looking at the image: 
  // Left is logo (about 20%), middle is Company Info (about 40%), right is Invoice Info (about 40% split in two)
  doc.line(margin + 120, currentY, margin + 120, currentY + 100); // Between Logo and Company
  doc.line(margin + 320, currentY, margin + 320, currentY + 100); // Between Company and Invoice details

  // Inside Invoice details, split horizontally and vertically
  doc.line(margin + 320, currentY + 40, pageWidth - margin, currentY + 40); // Horizontal line below invoice no
  doc.line(margin + 420, currentY, margin + 420, currentY + 40); // Vertical line between Invoice No and Date

  // Logo
  if (logoBase64) {
    // Top-left aligned logo inside the column box
    doc.addImage(logoBase64, 'PNG', margin + 15, currentY + 15, 70, 70);
  } else {
    // Fallback Logo Placeholder
    doc.setFillColor(30, 82, 160); // Oval Blue
    doc.rect(margin + 5, currentY + 10, 110, 80, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('THE OVAL', margin + 60, currentY + 50, { align: 'center' });
  }
  doc.setTextColor(0, 0, 0);

  // Company Details
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ECOS TRIVANDRUM', margin + 125, currentY + 15);
  doc.text('VENTURES', margin + 125, currentY + 27);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('617/1, THE OVAL TURF, FCI ROAD,', margin + 125, currentY + 40);
  doc.text('Thekkumukku, Kazhakoottam', margin + 125, currentY + 50);
  doc.text('Phone no.: 7306305005', margin + 125, currentY + 60);
  doc.text('Email: ecostvmventures@gmail.com', margin + 125, currentY + 70);
  doc.text('GSTIN: 32AACAE3721H1Z9', margin + 125, currentY + 80);
  doc.text('State: 32-Kerala', margin + 125, currentY + 90);

  // Invoice Details
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Invoice No.', margin + 325, currentY + 12);
  doc.setFont('helvetica', 'bold');
  const invoiceNo = booking._id.substring(booking._id.length - 6).toUpperCase();
  doc.text(invoiceNo, margin + 325, currentY + 25);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Date', margin + 425, currentY + 12);
  doc.setFont('helvetica', 'bold');
  const dateStr = new Date(booking.bookingDate || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '-');
  doc.text(dateStr, margin + 425, currentY + 25);

  currentY += 100;

  // Bill To Section
  doc.rect(margin, currentY, contentWidth, 80);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Bill To', margin + 5, currentY + 12);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(booking.customerName || 'Walk-in Customer', margin + 5, currentY + 25);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Contact: ${booking.contactNumber || 'N/A'}`, margin + 5, currentY + 40);
  doc.text('GSTIN: Unregistered', margin + 5, currentY + 60);
  doc.text('State: 32-Kerala', margin + 5, currentY + 72);

  currentY += 80;

  // Calculate amounts
  const totalAmount = booking.expectedAmount || 0;
  const taxableAmount = totalAmount / 1.18;
  const taxAmount = totalAmount - taxableAmount;
  const cgstAmount = taxAmount / 2;
  const sgstAmount = taxAmount / 2;
  const receivedAmount = booking.totalPaid || 0;
  const balanceAmount = totalAmount - receivedAmount;

  // Format functions
  const fmt = (num: number) => `Rs ${num.toFixed(2)}`;

  // Table 1: Items
  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Item name', 'HSN/ SAC', 'Quantity', 'Price/ Unit', 'GST', 'Amount']],
    body: [
      ['1', `Turf Charge : ${dateStr}`, '', '1', fmt(taxableAmount), `${fmt(taxAmount)}\n(18%)`, fmt(totalAmount)]
    ],
    foot: [
      ['Total', '', '', '1', '', fmt(taxAmount), fmt(totalAmount)]
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, textColor: [0, 0, 0], lineColor: [208, 208, 208], lineWidth: 1 },
    headStyles: { fillColor: [44, 44, 44], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [242, 242, 242], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 150 },
      2: { cellWidth: 60 },
      3: { cellWidth: 50, halign: 'center' },
      4: { cellWidth: 70, halign: 'right' },
      5: { cellWidth: 70, halign: 'right' },
      6: { cellWidth: 85, halign: 'right' },
    },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // Amount Details Split Row
  const amountBoxHeight = 100;
  const leftWidth = 250;
  const rightWidth = contentWidth - leftWidth;

  doc.rect(margin, currentY, leftWidth, amountBoxHeight);
  doc.rect(margin + leftWidth, currentY, rightWidth, amountBoxHeight);

  // Left Side: Invoice Amount in Words
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Invoice Amount in Words', margin + 5, currentY + 15);
  
  doc.setFont('helvetica', 'bold');
  const amountInWords = numWords(Math.round(totalAmount));
  const amountInWordsCapitalized = amountInWords.charAt(0).toUpperCase() + amountInWords.slice(1) + ' Rupees only';
  
  const splitText = doc.splitTextToSize(amountInWordsCapitalized, leftWidth - 10);
  doc.text(splitText, margin + 5, currentY + 30);

  // Right Side: Amounts Table
  doc.text('Amounts', margin + leftWidth + 5, currentY + 15);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Sub Total', margin + leftWidth + 5, currentY + 30);
  doc.text(fmt(totalAmount), pageWidth - margin - 5, currentY + 30, { align: 'right' });

  doc.text('Round off', margin + leftWidth + 5, currentY + 45);
  doc.text('Rs 0.00', pageWidth - margin - 5, currentY + 45, { align: 'right' });

  doc.line(margin + leftWidth, currentY + 55, pageWidth - margin, currentY + 55);

  doc.setFont('helvetica', 'bold');
  doc.text('Total', margin + leftWidth + 5, currentY + 70);
  doc.text(fmt(totalAmount), pageWidth - margin - 5, currentY + 70, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Received', margin + leftWidth + 5, currentY + 85);
  doc.text(fmt(receivedAmount), pageWidth - margin - 5, currentY + 85, { align: 'right' });

  doc.line(margin + leftWidth, currentY + 90, pageWidth - margin, currentY + 90);

  // doc.text('Balance', margin + leftWidth + 5, currentY + 98);
  // doc.text(fmt(balanceAmount), pageWidth - margin - 5, currentY + 98, { align: 'right' });

  currentY += amountBoxHeight;

  // Tax Table
  autoTable(doc, {
    startY: currentY,
    head: [
      [
        { content: 'HSN/ SAC', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Taxable amount', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'CGST', colSpan: 2, styles: { halign: 'center' } },
        { content: 'SGST', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Total Tax Amount', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
      ],
      ['Rate', 'Amount', 'Rate', 'Amount']
    ],
    body: [
      ['', fmt(taxableAmount), '9%', fmt(cgstAmount), '9%', fmt(sgstAmount), fmt(taxAmount)]
    ],
    foot: [
      ['Total', fmt(taxableAmount), '', fmt(cgstAmount), '', fmt(sgstAmount), fmt(taxAmount)]
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 1 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // Footer Section — 3 boxes: Bank Details | Terms | Signature
  const footerHeight = 110;
  const box1Width = 160;
  const box2Width = 170;
  const box3Width = contentWidth - box1Width - box2Width;

  doc.rect(margin, currentY, box1Width, footerHeight);
  doc.rect(margin + box1Width, currentY, box2Width, footerHeight);
  doc.rect(margin + box1Width + box2Width, currentY, box3Width, footerHeight);

  // Box 1: Bank Details — QR left column (48pt), text right column
  const qrX = margin + 4;
  const qrY = currentY + 18;
  const qrSize = 48;
  const textX = qrX + qrSize + 5;
  const textMaxW = box1Width - qrSize - 13;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Bank Details', margin + 5, currentY + 10);
  doc.setFont('helvetica', 'normal');

  // QR image or placeholder
  if (qrBase64) {
    try {
      doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.warn('Failed to add QR code', e);
      doc.rect(qrX, qrY, qrSize, qrSize);
      doc.setFontSize(7);
      doc.text('QR', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' });
    }
  } else {
    doc.rect(qrX, qrY, qrSize, qrSize);
    doc.setFontSize(7);
    doc.text('QR', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' });
  }

  // Bank text — right of QR, compact stacked rows (label + value = 8+8 = 16pt each block)
  doc.setFontSize(7.5);
  const bnVal = bankName || 'IDBI BANK, MANACAUD';
  const splitBn = doc.splitTextToSize(bnVal, textMaxW);
  doc.text('Name :', textX, currentY + 20);
  doc.text(splitBn, textX, currentY + 28);

  const acValSplit = doc.splitTextToSize(bankAccount || '1328102000005401', textMaxW);
  doc.text('A/C No. :', textX, currentY + 44);
  doc.text(acValSplit, textX, currentY + 52);

  doc.text('IFSC :', textX, currentY + 66);
  doc.text(bankIfsc || 'IBKL0001328', textX, currentY + 74);

  // Account holder — immediately after IFSC, full-width below QR
  const ahVal = bankHolder || 'ECOS TRIVANDRUM';
  const splitAhLabel = doc.splitTextToSize(`Holder: ${ahVal}`, box1Width - 8);
  doc.text(splitAhLabel, margin + 4, currentY + 90);

  // Box 2: Terms and conditions
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms and Conditions', margin + box1Width + 5, currentY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const termsText = 'Thank you for choosing us.\nWe look forward to serving you again.\nAll disputes subject to local jurisdiction.';
  doc.text(termsText, margin + box1Width + 5, currentY + 24);

  // Box 3: Signature
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('For : ECOS TRIVANDRUM VENTURES', margin + box1Width + box2Width + 5, currentY + 11);
  doc.setFont('helvetica', 'normal');

  const sigX = margin + box1Width + box2Width;
  if (signatureBase64) {
    try {
      doc.addImage(signatureBase64, 'PNG', sigX + (box3Width - 80) / 2, currentY + 25, 80, 40);
    } catch (e) {
      console.warn('Failed to add dynamic signature', e);
    }
  } else {
    doc.setDrawColor(0, 0, 255);
    doc.line(sigX + 20, currentY + 70, sigX + box3Width - 20, currentY + 70);
    doc.setDrawColor(0, 0, 0);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Authorized Signatory', sigX + box3Width / 2, currentY + 100, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  doc.autoPrint();
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export function generateConsolidatedReport(transactions: any[], signatureBase64?: string, qrBase64?: string, bankName?: string, bankAccount?: string, bankIfsc?: string, bankHolder?: string) {
  if (!transactions || transactions.length === 0) return;

  const doc = new jsPDF('portrait', 'pt', 'a4');
  doc.setFont('helvetica');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');

  doc.text('Consolidated Tax Invoice', doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });

  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  
  let currentY = 50;

  doc.setLineWidth(1);
  doc.rect(margin, currentY, contentWidth, 100);

  const col1Width = 100; 
  const col2Width = 180; 
  
  doc.line(margin + 120, currentY, margin + 120, currentY + 100); 
  doc.line(margin + 320, currentY, margin + 320, currentY + 100); 

  doc.line(margin + 320, currentY + 40, pageWidth - margin, currentY + 40); 
  doc.line(margin + 420, currentY, margin + 420, currentY + 40); 

  doc.setFillColor(0, 0, 0);
  doc.rect(margin + 5, currentY + 10, 110, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('THE OVAL', margin + 60, currentY + 50, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ECOS TRIVANDRUM', margin + 125, currentY + 15);
  doc.text('VENTURES', margin + 125, currentY + 27);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('617/1, THE OVAL TURF, FCI ROAD,', margin + 125, currentY + 40);
  doc.text('Thekkumukku, Kazhakoottam', margin + 125, currentY + 50);
  doc.text('Phone no.: 7306305005', margin + 125, currentY + 60);
  doc.text('Email: ecostvmventures@gmail.com', margin + 125, currentY + 70);
  doc.text('GSTIN: 32AACAE3721H1Z9', margin + 125, currentY + 80);
  doc.text('State: 32-Kerala', margin + 125, currentY + 90);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Report No.', margin + 325, currentY + 12);
  doc.setFont('helvetica', 'bold');
  const reportNo = 'CONS-' + Date.now().toString().substring(7);
  doc.text(reportNo, margin + 325, currentY + 25);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Date', margin + 425, currentY + 12);
  doc.setFont('helvetica', 'bold');
  const dateStr = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  doc.text(dateStr, margin + 425, currentY + 25);

  currentY += 100;

  const firstTxn = transactions.find(t => t.customerName) || transactions[0];
  
  doc.rect(margin, currentY, contentWidth, 80);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Bill To', margin + 5, currentY + 12);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(firstTxn.customerName || 'Multiple/Walk-in Customers', margin + 5, currentY + 25);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Contact: ${firstTxn.customerContact || 'N/A'}`, margin + 5, currentY + 40);
  doc.text('GSTIN: Unregistered', margin + 5, currentY + 60);
  doc.text('State: 32-Kerala', margin + 5, currentY + 72);

  currentY += 80;

  // Aggregate amounts
  let totalAmount = 0;
  let receivedAmount = 0;

  // Group by date
  const groupedData: Record<string, any[]> = {};
  transactions.forEach(t => {
    const dStr = new Date(t.date).toLocaleDateString('en-GB').replace(/\//g, '-');
    if (!groupedData[dStr]) groupedData[dStr] = [];
    groupedData[dStr].push(t);
    
    totalAmount += t.amount;
    // Assuming transactions in this view represent payments made if they are positive
    receivedAmount += t.amount;
  });

  const taxableAmount = totalAmount / 1.18;
  const taxAmount = totalAmount - taxableAmount;
  const cgstAmount = taxAmount / 2;
  const sgstAmount = taxAmount / 2;
  const balanceAmount = 0;

  const fmt = (num: number) => `Rs ${num.toFixed(2)}`;

  const bodyData: any[] = [];
  let index = 1;

  Object.keys(groupedData).sort().forEach(date => {
    groupedData[date].forEach(t => {
      const itemTaxable = t.amount / 1.18;
      const itemTax = t.amount - itemTaxable;
      bodyData.push([
        index.toString(),
        `${t.type.toUpperCase()} - ${date}\n${t.summary || ''}`,
        '',
        '1',
        fmt(itemTaxable),
        `${fmt(itemTax)}\n(18%)`,
        fmt(t.amount)
      ]);
      index++;
    });
  });

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Item name (Date)', 'HSN/ SAC', 'Quantity', 'Price/ Unit', 'GST', 'Amount']],
    body: bodyData,
    foot: [
      ['Total', '', '', bodyData.length.toString(), '', fmt(taxAmount), fmt(totalAmount)]
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 1 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 150 },
      2: { cellWidth: 60 },
      3: { cellWidth: 50, halign: 'center' },
      4: { cellWidth: 70, halign: 'right' },
      5: { cellWidth: 70, halign: 'right' },
      6: { cellWidth: 85, halign: 'right' },
    },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // Pagination check
  if (currentY > pageHeight - 250) {
    doc.addPage();
    currentY = margin;
  }

  const amountBoxHeight = 100;
  const leftWidth = 250;
  const rightWidth = contentWidth - leftWidth;

  doc.rect(margin, currentY, leftWidth, amountBoxHeight);
  doc.rect(margin + leftWidth, currentY, rightWidth, amountBoxHeight);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Invoice Amount in Words', margin + 5, currentY + 15);
  
  doc.setFont('helvetica', 'bold');
  const amountInWords = numWords(Math.round(totalAmount));
  const amountInWordsCapitalized = amountInWords.charAt(0).toUpperCase() + amountInWords.slice(1) + ' Rupees only';
  
  const splitText = doc.splitTextToSize(amountInWordsCapitalized, leftWidth - 10);
  doc.text(splitText, margin + 5, currentY + 30);

  doc.text('Amounts', margin + leftWidth + 5, currentY + 15);
  
  doc.setFont('helvetica', 'normal');
  doc.text('Sub Total', margin + leftWidth + 5, currentY + 30);
  doc.text(fmt(totalAmount), pageWidth - margin - 5, currentY + 30, { align: 'right' });

  doc.text('Round off', margin + leftWidth + 5, currentY + 45);
  doc.text('Rs 0.00', pageWidth - margin - 5, currentY + 45, { align: 'right' });

  doc.line(margin + leftWidth, currentY + 55, pageWidth - margin, currentY + 55);

  doc.setFont('helvetica', 'bold');
  doc.text('Total', margin + leftWidth + 5, currentY + 70);
  doc.text(fmt(totalAmount), pageWidth - margin - 5, currentY + 70, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Received', margin + leftWidth + 5, currentY + 85);
  doc.text(fmt(receivedAmount), pageWidth - margin - 5, currentY + 85, { align: 'right' });

  doc.line(margin + leftWidth, currentY + 90, pageWidth - margin, currentY + 90);

  // doc.text('Balance', margin + leftWidth + 5, currentY + 98);
  // doc.text(fmt(balanceAmount), pageWidth - margin - 5, currentY + 98, { align: 'right' });

  currentY += amountBoxHeight;

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        { content: 'HSN/ SAC', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'Taxable amount', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'CGST', colSpan: 2, styles: { halign: 'center' } },
        { content: 'SGST', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Total Tax Amount', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
      ],
      ['Rate', 'Amount', 'Rate', 'Amount']
    ],
    body: [
      ['', fmt(taxableAmount), '9%', fmt(cgstAmount), '9%', fmt(sgstAmount), fmt(taxAmount)]
    ],
    foot: [
      ['Total', fmt(taxableAmount), '', fmt(cgstAmount), '', fmt(sgstAmount), fmt(taxAmount)]
    ],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 1 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // Pagination check
  if (currentY > pageHeight - 150) {
    doc.addPage();
    currentY = margin;
  }

  const footerHeight = 110;
  const box1Width = 160;
  const box2Width = 170;
  const box3Width = contentWidth - box1Width - box2Width;

  doc.rect(margin, currentY, box1Width, footerHeight);
  doc.rect(margin + box1Width, currentY, box2Width, footerHeight);
  doc.rect(margin + box1Width + box2Width, currentY, box3Width, footerHeight);

  // Box 1: Bank Details — QR left column (48pt), text right column
  const qrX = margin + 4;
  const qrY = currentY + 18;
  const qrSize = 48;
  const textX = qrX + qrSize + 5;
  const textMaxW = box1Width - qrSize - 13;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Bank Details', margin + 5, currentY + 10);
  doc.setFont('helvetica', 'normal');

  if (qrBase64) {
    try {
      doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.warn('Failed to add QR code', e);
      doc.rect(qrX, qrY, qrSize, qrSize);
      doc.setFontSize(7);
      doc.text('QR', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' });
    }
  } else {
    doc.rect(qrX, qrY, qrSize, qrSize);
    doc.setFontSize(7);
    doc.text('QR', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' });
  }

  doc.setFontSize(7.5);
  const bnVal2 = bankName || 'IDBI BANK, MANACAUD';
  const splitBn2 = doc.splitTextToSize(bnVal2, textMaxW);
  doc.text('Name :', textX, currentY + 20);
  doc.text(splitBn2, textX, currentY + 28);

  const acVal2 = doc.splitTextToSize(bankAccount || '1328102000005401', textMaxW);
  doc.text('A/C No. :', textX, currentY + 44);
  doc.text(acVal2, textX, currentY + 52);

  doc.text('IFSC :', textX, currentY + 66);
  doc.text(bankIfsc || 'IBKL0001328', textX, currentY + 74);

  const ahVal2 = bankHolder || 'ECOS TRIVANDRUM';
  const splitAh2 = doc.splitTextToSize(`Holder: ${ahVal2}`, box1Width - 8);
  doc.text(splitAh2, margin + 4, currentY + 90);

  // Box 2: Terms and conditions
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Terms and Conditions', margin + box1Width + 5, currentY + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Thank you for choosing us.\nWe look forward to serving you again.\nAll disputes subject to local jurisdiction.', margin + box1Width + 5, currentY + 24);

  // Box 3: Signature
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('For : ECOS TRIVANDRUM VENTURES', margin + box1Width + box2Width + 5, currentY + 11);
  doc.setFont('helvetica', 'normal');

  const sigX2 = margin + box1Width + box2Width;
  if (signatureBase64) {
    try {
      doc.addImage(signatureBase64, 'PNG', sigX2 + (box3Width - 80) / 2, currentY + 25, 80, 40);
    } catch (e) {
      console.warn('Failed to add dynamic signature', e);
    }
  } else {
    doc.setDrawColor(0, 0, 255);
    doc.line(sigX2 + 20, currentY + 70, sigX2 + box3Width - 20, currentY + 70);
    doc.setDrawColor(0, 0, 0);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Authorized Signatory', sigX2 + box3Width / 2, currentY + 100, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  doc.autoPrint();
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
