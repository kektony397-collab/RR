import type { Receipt, Settings, Expense } from './types';
import { SOCIETY_INFO } from './constants';

// These would be imported from npm packages in a real build environment
declare const jspdf: any;
declare const html2canvas: any;
declare const XLSX: any;

export const generateReceiptPdf = (receipt: Receipt, settings: Settings | null, t: (key: string) => string): void => {
  const receiptElement = document.getElementById('receipt-template');
  if (receiptElement && (window as any).html2canvas && (window as any).jspdf) {
    const { jsPDF } = (window as any).jspdf;
    (window as any).html2canvas(receiptElement, { 
        scale: 3, // Higher scale for better quality
        useCORS: true,
        logging: false 
    }).then((canvas: HTMLCanvasElement) => {
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Receipt-${receipt.receiptNumber}.pdf`);
    });
  } else {
    alert("PDF generation library is not loaded.");
  }
};

export const exportExpensesToPdf = (expenses: Expense[], receipts: Receipt[], t: (key: string) => string): void => {
  if (!(window as any).jspdf || !(window as any).jspdf.plugin.autotable) {
    alert("PDF generation library is not loaded.");
    return;
  }

  const allTransactions = [
    ...receipts.map(r => ({
        date: r.date,
        description: `Maintenance from ${r.name} (#${r.receiptNumber})`,
        amount: r.amount,
    })),
    ...expenses.map(e => ({
        date: e.date,
        description: e.description,
        amount: e.amount,
    }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


  if (allTransactions.length === 0) {
    alert("No transactions to export.");
    return;
  }

  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF();

  const totalIncome = allTransactions.filter(e => e.amount > 0).reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = allTransactions.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const netBalance = totalIncome - totalExpense;

  // Document Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(SOCIETY_INFO.name, 105, 15, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(SOCIETY_INFO.subName, 105, 21, { align: 'center' });
  doc.text(SOCIETY_INFO.address, 105, 27, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Income & Expense Statement', 105, 40, { align: 'center' });

  // Table data
  const head = [['Date', 'Description', 'Amount (₹)']];
  const body = allTransactions.map(e => [
      e.date,
      e.description,
      e.amount // Pass raw number
  ]);
  
  (doc as any).autoTable({
    head,
    body,
    startY: 45,
    theme: 'grid',
    headStyles: { fillColor: [44, 62, 80] }, // Dark blue/grey corporate color
    didParseCell: (data: any) => {
      // Right align amount column
      if (data.column.index === 2) {
        data.cell.styles.halign = 'right';
      }
    },
    willDrawCell: (data: any) => {
      if (data.column.index === 2 && data.cell.section === 'body') {
        const amount = data.cell.raw;
        if (typeof amount === 'number') {
          // Set color based on amount
          if (amount < 0) {
            doc.setTextColor(231, 76, 60); // Red
          } else {
            doc.setTextColor(46, 204, 113); // Green
          }
          // Format the text to be displayed
          const formattedText = amount < 0 ? `- ${Math.abs(amount).toFixed(2)}` : `+ ${amount.toFixed(2)}`;
          data.cell.text = [formattedText];
        }
      }
    },
    didDrawCell: (data: any) => {
      doc.setTextColor(0, 0, 0); // Reset text color after each cell
    }
  });
  
  const finalY = (doc as any).autoTable.previous ? (doc as any).autoTable.previous.finalY : 150;

  // Summary Table
  const summaryBody = [
    ['Total Income', { content: `₹${totalIncome.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [46, 204, 113] } }],
    ['Total Expense', { content: `₹${totalExpense.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: [231, 76, 60] } }],
    ['Net Balance', { content: `₹${netBalance.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold', textColor: netBalance >= 0 ? [0, 0, 0] : [231, 76, 60] } }]
  ];

  (doc as any).autoTable({
    body: summaryBody,
    startY: finalY + 10,
    theme: 'plain',
    tableWidth: 'wrap',
    margin: { left: 120 },
    columnStyles: {
      0: { fontStyle: 'bold' },
    }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, doc.internal.pageSize.getHeight() - 10);
  }

  doc.save('Income_Expense_Statement.pdf');
};


export const exportReceiptsToPdf = (receipts: Receipt[], t: (key: string) => string): void => {
  if (!(window as any).jspdf || !(window as any).jspdf.plugin.autotable) {
    alert("PDF generation library is not loaded.");
    return;
  }
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF();

  const grandTotal = receipts.reduce((sum, r) => sum + r.amount, 0);

  (doc as any).autoTable({
    head: [[t('receiptNo'), t('residentName'), t('date'), t('amount')]],
    body: receipts.map(r => [r.receiptNumber, r.name, r.date, r.amount.toFixed(2)]),
    foot: [['Total', '', '', grandTotal.toFixed(2)]],
    didDrawPage: (data: any) => {
      doc.setFontSize(20);
      doc.text(t('receipts'), data.settings.margin.left, 15);
    },
  });

  doc.save('All_Receipts.pdf');
};


export const exportReceiptsToExcel = (receipts: Receipt[], t: (key: string) => string): void => {
  if (!(window as any).XLSX) {
      alert("Excel generation library is not loaded.");
      return;
  }
  
  const grandTotal = receipts.reduce((sum, r) => sum + r.amount, 0);
  
  const worksheetData = receipts.map(r => ({
    [t('receiptNo')]: r.receiptNumber,
    [t('residentName')]: r.name,
    [t('blockNo')]: r.blockNumber,
    [t('date')]: r.date,
    [t('forMonth')]: r.forMonth,
    [t('paymentMethod')]: r.paymentMethod,
    [t('amount')]: r.amount,
  }));

  worksheetData.push({
    [t('receiptNo')]: t('totalAmount'),
    [t('residentName')]: '',
    [t('blockNo')]: '',
    [t('date')]: '',
    [t('forMonth')]: '',
    [t('paymentMethod')]: '',
    [t('amount')]: grandTotal,
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t('receipts'));

  XLSX.writeFile(workbook, 'All_Receipts.xlsx');
};

export const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
}