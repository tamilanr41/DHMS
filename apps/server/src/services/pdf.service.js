import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { DATA_DIRS } from '../middleware/upload.js';
import { getClinic } from './clinic.service.js';
import { formatIndian, toPaise } from '../utils/money.js';

const PAGE = { size: 'A4', margin: 42 };
const COLORS = { navy: '#0f2742', accent: '#2e7dd1', muted: '#5b6b7d', line: '#d7dee7', light: '#f4f7fb' };

function fmtMoney(value) {
  return `Rs. ${formatIndian(value || 0)}`;
}

function fmtDate(value) {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function brandingPath(clinic, kind) {
  if (!clinic) return null;
  const fileName = kind === 'logo' ? clinic.logoPath : clinic.dentistSignaturePath;
  if (!fileName) return null;
  const p = path.join(DATA_DIRS.branding, path.basename(fileName));
  return fs.existsSync(p) ? p : null;
}

function newDoc(orientation = 'portrait') {
  const doc = new PDFDocument({ size: PAGE.size, layout: orientation, margin: PAGE.margin, bufferPages: true, info: { Title: 'ZhanX DentalCare' } });
  return doc;
}

function clinicHeader(doc, clinic, title, subtitle) {
  clinic = clinic || {};
  const left = PAGE.margin;
  const right = doc.page.width - PAGE.margin;
  let textLeft = left;

  const logo = brandingPath(clinic, 'logo');
  if (logo) {
    try {
      doc.image(logo, left, 38, { fit: [54, 54] });
      textLeft = left + 66;
    } catch {
      /* ignore invalid image */
    }
  }

  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(16).text(clinic.clinicName || 'Dental Clinic', textLeft, 40, { width: right - textLeft });
  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
  const contact = [clinic.address, clinic.phone ? `Ph: ${clinic.phone}` : null, clinic.email, clinic.website].filter(Boolean).join('  |  ');
  doc.text(contact || '', textLeft, 60, { width: right - textLeft });
  if (clinic.dentistName) {
    const creds = [clinic.dentistName, clinic.dentistQualification, clinic.dentistRegistrationNo ? `Reg. ${clinic.dentistRegistrationNo}` : null].filter(Boolean).join(', ');
    doc.text(creds, textLeft, 72, { width: right - textLeft });
  }

  doc.moveTo(left, 92).lineTo(right, 92).lineWidth(1.1).strokeColor(COLORS.navy).stroke();

  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(12).text(title.toUpperCase(), left, 102, { width: right - left, align: 'right' });
  if (subtitle) {
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text(subtitle, left, 118, { width: right - left, align: 'right' });
  }
  return 140;
}

function reportHeader(doc, clinic = {}, title, subtitle, generatedBy, generatedAt) {
  clinic = clinic || {};
  const left = PAGE.margin;
  const right = doc.page.width - PAGE.margin;
  const badgeWidth = Math.min(270, (right - left) * 0.46);
  const badgeX = right - badgeWidth;

  // Top dual-tone decorative bar
  doc.rect(0, 0, doc.page.width, 5).fill(COLORS.navy);
  doc.rect(0, 5, doc.page.width, 2.5).fill(COLORS.accent);

  // Left side: Clinic info & Logo
  let textLeft = left;
  const logo = brandingPath(clinic, 'logo');
  if (logo) {
    try {
      doc.image(logo, left, 18, { fit: [46, 46] });
      textLeft = left + 54;
    } catch {
      /* ignore invalid image */
    }
  }

  const leftWidth = badgeX - textLeft - 16;
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(14).text(clinic.clinicName || 'Dental Clinic', textLeft, 18, { width: leftWidth, lineBreak: false, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(6.8).fillColor(COLORS.accent).text('PRACTICE INTELLIGENCE & AUDIT REPORT', textLeft, 34, { width: leftWidth });

  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted);
  const contact = [clinic.address, clinic.phone ? `Ph: ${clinic.phone}` : null, clinic.email].filter(Boolean).join('  |  ');
  doc.text(contact || '', textLeft, 44, { width: leftWidth, lineBreak: false, ellipsis: true });

  if (clinic.dentistName) {
    const creds = [clinic.dentistName, clinic.dentistQualification, clinic.dentistRegistrationNo ? `Reg. ${clinic.dentistRegistrationNo}` : null].filter(Boolean).join(', ');
    doc.text(creds, textLeft, 54, { width: leftWidth, lineBreak: false, ellipsis: true });
  }

  // Right side: Official Certified Audit Badge
  const badgeY = 15;
  const badgeH = 54;
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeH, 4).fillAndStroke('#f8fafc', '#cbd5e1');
  // Badge top label
  doc.rect(badgeX + 1, badgeY + 1, badgeWidth - 2, 13).fill(COLORS.navy);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.5)
    .text('OFFICIAL CLINICAL & FINANCIAL REPORT', badgeX + 7, badgeY + 3.5, { width: badgeWidth - 14, lineBreak: false });

  // Badge Report Title
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(9.5)
    .text(title.toUpperCase(), badgeX + 7, badgeY + 17, { width: badgeWidth - 14, lineBreak: false, ellipsis: true });

  // Badge Subtitle (date range)
  doc.font('Helvetica').fontSize(7.2).fillColor(COLORS.muted)
    .text(subtitle || 'All Recorded Dates', badgeX + 7, badgeY + 29, { width: badgeWidth - 14, lineBreak: false, ellipsis: true });

  // Badge Audit Trail
  const stamp = `Audit: ${generatedBy || 'system'} • ${fmtDateTime(generatedAt || new Date())}`;
  doc.font('Helvetica').fontSize(6.5).fillColor('#64748b')
    .text(stamp, badgeX + 7, badgeY + 41, { width: badgeWidth - 14, lineBreak: false, ellipsis: true });

  // Bottom double accent rule
  const ruleY = 75;
  doc.moveTo(left, ruleY).lineTo(right, ruleY).lineWidth(1.2).strokeColor(COLORS.navy).stroke();
  doc.moveTo(left, ruleY + 2.5).lineTo(right, ruleY + 2.5).lineWidth(0.6).strokeColor(COLORS.accent).stroke();

  return ruleY + 8;
}

function footerOnEveryPage(doc, clinic = {}) {
  clinic = clinic || {};
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const bottom = doc.page.height - 34;
    doc.moveTo(PAGE.margin, bottom).lineTo(doc.page.width - PAGE.margin, bottom).lineWidth(0.6).strokeColor(COLORS.line).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted);
    doc.text(clinic.receiptFooter || 'Thank you for choosing our clinic.', PAGE.margin, bottom + 6, { width: 400 });
    doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - PAGE.margin - 100, bottom + 6, { width: 100, align: 'right' });
  }
}

function keyValueBlock(doc, x, y, width, rows) {
  doc.fontSize(9);
  let cursor = y;
  for (const [label, value] of rows) {
    doc.font('Helvetica-Bold').fillColor(COLORS.muted).text(label, x, cursor, { width: width * 0.38 });
    doc.font('Helvetica').fillColor('#1f2d3d').text(value ?? '-', x + width * 0.38, cursor, { width: width * 0.62 });
    cursor += 14;
  }
  return cursor;
}

function sectionTitle(doc, text, y) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.navy).text(text.toUpperCase(), PAGE.margin, y);
  doc.moveTo(PAGE.margin, y + 13).lineTo(doc.page.width - PAGE.margin, y + 13).lineWidth(0.6).strokeColor(COLORS.line).stroke();
  return y + 20;
}

function drawTable(doc, columns, rows, startY, options = {}) {
  const usable = doc.page.width - PAGE.margin * 2;
  const totalWeight = columns.reduce((s, c) => s + (c.width || 1), 0);
  const widths = columns.map((c) => ((c.width || 1) / totalWeight) * usable);
  const padding = 6;
  let y = startY;

  const renderHead = () => {
    doc.rect(PAGE.margin, y, usable, 20).fill(COLORS.navy);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.2);
    let x = PAGE.margin;
    columns.forEach((c, i) => {
      doc.text(c.label, x + padding, y + 6, { width: widths[i] - padding * 2, align: c.align || 'left', lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    y += 20;
  };

  renderHead();

  doc.font('Helvetica').fontSize(8.2).fillColor('#1f2d3d');
  rows.forEach((row, idx) => {
    const cellHeights = columns.map((c, i) => {
      let raw = row[c.key];
      if (c.format === 'money') raw = fmtMoney(raw);
      else if (c.format === 'bool') raw = raw ? 'Yes' : 'No';
      else if (c.format === 'date') raw = fmtDate(raw);
      const text = raw === null || raw === undefined || raw === '' ? '-' : String(raw);
      return doc.heightOfString(text, { width: widths[i] - padding * 2 });
    });
    const rowHeight = Math.max(...cellHeights) + 10;
    if (y + rowHeight > doc.page.height - 60) {
      doc.addPage();
      y = PAGE.margin;
      renderHead();
      doc.font('Helvetica').fontSize(7.6).fillColor('#1f2d3d');
    }
    if (idx % 2 === 1) doc.rect(PAGE.margin, y, usable, rowHeight).fill(COLORS.light);
    let x = PAGE.margin;
    columns.forEach((c, i) => {
      let raw = row[c.key];
      if (c.format === 'money') raw = fmtMoney(raw);
      else if (c.format === 'bool') raw = raw ? 'Yes' : 'No';
      else if (c.format === 'date') raw = fmtDate(raw);
      const text = raw === null || raw === undefined || raw === '' ? '-' : String(raw);
      doc.fillColor('#1f2d3d').text(text, x + padding, y + 4, { width: widths[i] - padding * 2, align: c.align || 'left' });
      x += widths[i];
    });
    y += rowHeight;
  });

  if (options.totals) {
    if (y + 24 > doc.page.height - 50) {
      doc.addPage();
      y = PAGE.margin;
      renderHead();
    }
    doc.rect(PAGE.margin, y, usable, 20).fill('#e9eef5');
    doc.moveTo(PAGE.margin, y).lineTo(PAGE.margin + usable, y).lineWidth(0.8).strokeColor(COLORS.navy).stroke();
    doc.moveTo(PAGE.margin, y + 20).lineTo(PAGE.margin + usable, y + 20).lineWidth(1.2).strokeColor(COLORS.navy).stroke();
    doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(8.5);
    let x = PAGE.margin;
    columns.forEach((c, i) => {
      const val = options.totals[c.key];
      if (val !== undefined && val !== null) {
        const text = c.format === 'money' ? fmtMoney(val) : String(val);
        doc.text(text, x + padding, y + 5.5, { width: widths[i] - padding * 2, align: c.align || 'left' });
      }
      x += widths[i];
    });
    y += 20;
  }

  doc.moveTo(PAGE.margin, y).lineTo(doc.page.width - PAGE.margin, y).lineWidth(0.6).strokeColor(COLORS.line).stroke();
  return y;
}

export function waitForPdf(doc, res, fileName) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  doc.pipe(res);
  doc.end();
}

export async function streamInvoice(invoice, res) {
  const clinic = await getClinic();
  const doc = newDoc();
  let y = clinicHeader(doc, clinic, 'Invoice', `${invoice.invoiceNo}  |  ${fmtDate(invoice.invoiceDate)}`);

  const half = (doc.page.width - PAGE.margin * 2) / 2;
  const leftEnd = keyValueBlock(doc, PAGE.margin, y, half - 12, [
    ['Billed to', invoice.patient.fullName],
    ['Patient ID', invoice.patient.patientNo],
    ['Mobile', invoice.patient.mobile],
    ['Address', invoice.patient.address]
  ]);
  const rightEnd = keyValueBlock(doc, PAGE.margin + half + 12, y, half - 12, [
    ['Invoice', invoice.invoiceNo],
    ['Date', fmtDate(invoice.invoiceDate)],
    ['Status', invoice.status.replace('_', ' ').toUpperCase()],
    ['Consultation', invoice.consultationNo || '-']
  ]);
  y = Math.max(leftEnd, rightEnd) + 8;

  y = drawTable(
    doc,
    [
      { key: 'description', label: 'Description', width: 4 },
      { key: 'toothNumber', label: 'Tooth', width: 1, align: 'center' },
      { key: 'quantity', label: 'Qty', width: 0.8, align: 'right', format: 'number' },
      { key: 'unitPrice', label: 'Rate', width: 1.6, align: 'right', format: 'money' },
      { key: 'discount', label: 'Disc.', width: 1.4, align: 'right', format: 'money' },
      { key: 'lineTotal', label: 'Amount', width: 1.8, align: 'right', format: 'money' }
    ],
    invoice.items,
    y + 14
  );

  const boxX = doc.page.width - PAGE.margin - 210;
  let by = y + 14;
  const line = (label, value, bold = false, color = '#1f2d3d') => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(color);
    doc.text(label, boxX, by, { width: 100 });
    doc.text(value, boxX + 100, by, { width: 110, align: 'right' });
    by += 15;
  };
  line('Subtotal', fmtMoney(invoice.subtotal));
  line('Discount', `- ${fmtMoney(invoice.discountTotal)}`);
  if (toPaise(invoice.taxTotal) > 0n) line(`Tax (${Number(invoice.taxPercent).toFixed(2)}%)`, fmtMoney(invoice.taxTotal));
  line('Total', fmtMoney(invoice.total), true, COLORS.navy);
  line('Paid', fmtMoney(invoice.amountPaid));
  line('Balance due', fmtMoney(invoice.outstanding), true, invoice.status === 'paid' ? '#15803d' : '#b45309');

  doc.moveTo(PAGE.margin, by + 12).lineTo(doc.page.width - PAGE.margin, by + 12).lineWidth(0.6).strokeColor(COLORS.line).stroke();
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLORS.muted)
    .text('This is a computer-generated invoice. Amounts are in Indian Rupees unless configured otherwise.', PAGE.margin, by + 20, { width: 300 });

  footerOnEveryPage(doc, clinic);
  waitForPdf(doc, res, `${invoice.invoiceNo}.pdf`);
}

export async function streamReceipt({ invoice, clinic }, res) {
  const doc = newDoc();
  let y = clinicHeader(doc, clinic, 'Payment Receipt', invoice.invoiceNo);
  y = keyValueBlock(doc, PAGE.margin, y, doc.page.width - PAGE.margin * 2, [
    ['Patient', invoice.patient.fullName],
    ['Patient ID', invoice.patient.patientNo],
    ['Invoice', invoice.invoiceNo],
    ['Invoice total', fmtMoney(invoice.total)],
    ['Paid to date', fmtMoney(invoice.amountPaid)],
    ['Balance', fmtMoney(invoice.outstanding)]
  ]);
  y = sectionTitle(doc, 'Payments received', y + 8);
  drawTable(
    doc,
    [
      { key: 'paymentNo', label: 'Receipt', width: 1.6 },
      { key: 'paymentDate', label: 'Date', width: 1.6, format: 'date' },
      { key: 'method', label: 'Method', width: 1.2 },
      { key: 'transactionRef', label: 'Reference', width: 1.6 },
      { key: 'amount', label: 'Amount', width: 1.4, align: 'right', format: 'money' }
    ],
    invoice.payments,
    y
  );

  const sig = brandingPath(clinic, 'signature');
  if (sig) {
    try {
      doc.image(sig, doc.page.width - PAGE.margin - 130, doc.page.height - 150, { fit: [120, 50] });
    } catch {
      /* ignore */
    }
  }
  footerOnEveryPage(doc, clinic);
  waitForPdf(doc, res, `Receipt-${invoice.invoiceNo}.pdf`);
}

export async function streamPaymentReceipt({ payment, clinic }, res) {
  const doc = newDoc();
  let y = clinicHeader(doc, clinic, 'Payment Receipt', payment.paymentNo);
  y = keyValueBlock(doc, PAGE.margin, y, doc.page.width - PAGE.margin * 2, [
    ['Patient', payment.patientName],
    ['Patient ID', payment.patientNo],
    ['Invoice', payment.invoiceNo],
    ['Receipt no.', payment.paymentNo],
    ['Date', fmtDateTime(payment.paymentDate)],
    ['Method', payment.method],
    ['Reference', payment.transactionRef || '-'],
    ['Amount received', fmtMoney(payment.amount)]
  ]);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.navy)
    .text(`Received: ${fmtMoney(payment.amount)}`, PAGE.margin, y + 16);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted)
    .text(`Received by ${payment.recordedByName || 'clinic staff'}`, PAGE.margin, y + 38);
  footerOnEveryPage(doc, clinic);
  waitForPdf(doc, res, `${payment.paymentNo}.pdf`);
}

export async function streamPrescription(prescription, res) {
  const clinic = await getClinic();
  const doc = newDoc();
  let y = clinicHeader(doc, clinic, 'Prescription', `${prescription.prescriptionNo}  |  ${fmtDate(prescription.prescriptionDate)}`);

  const half = (doc.page.width - PAGE.margin * 2) / 2;
  const leftEnd = keyValueBlock(doc, PAGE.margin, y, half - 12, [
    ['Patient', prescription.patient.fullName],
    ['Patient ID', prescription.patient.patientNo],
    ['Age / Gender', `${prescription.patient.age ?? '-'} / ${prescription.patient.gender || '-'}`],
    ['Mobile', prescription.patient.mobile]
  ]);
  const rightEnd = keyValueBlock(doc, PAGE.margin + half + 12, y, half - 12, [
    ['Prescription', prescription.prescriptionNo],
    ['Date', fmtDate(prescription.prescriptionDate)],
    ['Consultation', prescription.consultationNo || '-'],
    ['Follow-up', prescription.followUpDate ? fmtDate(prescription.followUpDate) : '-']
  ]);
  y = Math.max(leftEnd, rightEnd) + 6;

  if (prescription.allergiesNoted) {
    doc.rect(PAGE.margin, y, doc.page.width - PAGE.margin * 2, 24).fill('#fef2f2');
    doc.fillColor('#991b1b').font('Helvetica-Bold').fontSize(9)
      .text(`Allergy warning: ${prescription.allergiesNoted}`, PAGE.margin + 8, y + 7, { width: doc.page.width - PAGE.margin * 2 - 16 });
    y += 32;
  }

  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.navy).text('Rx', PAGE.margin, y);
  y += 26;

  y = drawTable(
    doc,
    [
      { key: 'medicineName', label: 'Medicine', width: 3 },
      { key: 'dosage', label: 'Dosage', width: 1.3 },
      { key: 'route', label: 'Route', width: 1 },
      { key: 'frequency', label: 'Frequency', width: 1.4 },
      { key: 'duration', label: 'Duration', width: 1.2 },
      { key: 'instructions', label: 'Instructions', width: 2.4 }
    ],
    prescription.items,
    y
  );

  if (prescription.notes) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy).text('Notes', PAGE.margin, y + 14);
    doc.font('Helvetica').fontSize(9).fillColor('#1f2d3d').text(prescription.notes, PAGE.margin, y + 28, { width: doc.page.width - PAGE.margin * 2 });
  }

  const sig = brandingPath(clinic, 'signature');
  const sigY = doc.page.height - 170;
  if (sig) {
    try {
      doc.image(sig, doc.page.width - PAGE.margin - 130, sigY, { fit: [120, 50] });
    } catch {
      /* ignore */
    }
  }
  doc.moveTo(doc.page.width - PAGE.margin - 150, sigY + 56).lineTo(doc.page.width - PAGE.margin, sigY + 56).lineWidth(0.7).strokeColor(COLORS.muted).stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy)
    .text(clinic.dentistName || prescription.dentistName, doc.page.width - PAGE.margin - 150, sigY + 60, { width: 150, align: 'center' });
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
    .text(prescription.dentistName, doc.page.width - PAGE.margin - 150, sigY + 72, { width: 150, align: 'center' });

  if (clinic.prescriptionFooter) {
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(COLORS.muted).text(clinic.prescriptionFooter, PAGE.margin, sigY + 60, { width: 280 });
  }

  footerOnEveryPage(doc, clinic);
  waitForPdf(doc, res, `${prescription.prescriptionNo}.pdf`);
}

export async function streamTreatmentEstimate(plan, res, { userName } = {}) {
  const clinic = await getClinic();
  const doc = newDoc();
  let y = clinicHeader(doc, clinic, 'Treatment Estimate', `${plan.planNo}  |  ${fmtDate(plan.createdAt)}`);

  const half = (doc.page.width - PAGE.margin * 2) / 2;
  const leftEnd = keyValueBlock(doc, PAGE.margin, y, half - 12, [
    ['Patient', plan.patient.fullName],
    ['Patient ID', plan.patient.patientNo],
    ['Age / Gender', `${plan.patient.age ?? '-'} / ${plan.patient.gender || '-'}`],
    ['Mobile', plan.patient.mobile]
  ]);
  const rightEnd = keyValueBlock(doc, PAGE.margin + half + 12, y, half - 12, [
    ['Plan', plan.planNo],
    ['Dentist', plan.dentistName],
    ['Consultation', plan.consultationNo || '-'],
    ['Prepared by', userName || plan.dentistName]
  ]);
  y = Math.max(leftEnd, rightEnd) + 8;

  y = drawTable(
    doc,
    [
      { key: 'toothNumber', label: 'Tooth', width: 0.8, align: 'center' },
      { key: 'treatmentName', label: 'Procedure', width: 3.4 },
      { key: 'quantity', label: 'Qty', width: 0.7, align: 'right', format: 'number' },
      { key: 'unitPrice', label: 'Rate', width: 1.4, align: 'right', format: 'money' },
      { key: 'discount', label: 'Disc.', width: 1.2, align: 'right', format: 'money' },
      { key: 'total', label: 'Amount', width: 1.6, align: 'right', format: 'money' },
      { key: 'status', label: 'Status', width: 1.2 }
    ],
    plan.items,
    y + 10
  );

  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.navy)
    .text(`Estimated total: ${fmtMoney(plan.estimate)}`, PAGE.margin, y + 14, { width: doc.page.width - PAGE.margin * 2, align: 'right' });

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(
    'This estimate is not an invoice. Prices may change if treatment requirements change; the dentist will confirm the final plan.',
    PAGE.margin,
    y + 38,
    { width: doc.page.width - PAGE.margin * 2 }
  );

  footerOnEveryPage(doc, clinic);
  waitForPdf(doc, res, `${plan.planNo}.pdf`);
}

export async function streamTableReport({ title, columns, rows, subtitle, generatedBy, generatedAt }, res) {
  const clinic = await getClinic();
  const totalWeight = (columns || []).reduce((s, c) => s + (c.width || 1), 0);
  const orientation = (columns || []).length >= 7 || totalWeight >= 9 ? 'landscape' : 'portrait';
  const doc = newDoc(orientation);
  let y = reportHeader(doc, clinic, title, subtitle || `Period: All Recorded Dates`, generatedBy, generatedAt);

  // Calculate column totals
  const totals = {};
  const hasNumeric = (columns || []).some((c) => c.format === 'money' || c.format === 'int' || c.format === 'number');
  if (hasNumeric && rows.length > 0) {
    const firstCol = columns[0]?.key;
    if (firstCol) totals[firstCol] = 'TOTAL';
    for (const c of columns) {
      if (c.format === 'money' || c.format === 'int' || c.format === 'number') {
        totals[c.key] = rows.reduce((acc, r) => acc + (Number(r[c.key]) || 0), 0);
      }
    }
  }

  // Draw Executive KPI Summary bar
  const usable = doc.page.width - PAGE.margin * 2;
  const moneyCol = (columns || []).find((c) => c.format === 'money');
  const totalMoneyStr = moneyCol && totals[moneyCol.key] !== undefined ? fmtMoney(totals[moneyCol.key]) : null;

  doc.roundedRect(PAGE.margin, y + 2, usable, 26, 4).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor(COLORS.navy).font('Helvetica-Bold').fontSize(8.5)
    .text(`RECORDS QUERIED: ${rows.length}`, PAGE.margin + 12, y + 10.5);
  doc.font('Helvetica').fillColor(COLORS.muted).fontSize(8)
    .text(`|  PERIOD: ${subtitle || 'All Dates'}`, PAGE.margin + 130, y + 11);

  if (totalMoneyStr) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f5132')
      .text(`TOTAL ${moneyCol.label.toUpperCase()}: ${totalMoneyStr}`, PAGE.margin, y + 10, { width: usable - 12, align: 'right' });
  }

  y += 36;

  if (!rows.length) {
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text('No records found for the selected filters.', PAGE.margin, y + 20);
  } else {
    drawTable(doc, columns, rows, y, { totals });
  }
  footerOnEveryPage(doc, clinic);
  waitForPdf(doc, res, `${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
}

export async function streamPatientStatement({ patient, clinic, summary, entries }, res) {
  const doc = newDoc();
  let y = clinicHeader(doc, clinic, 'Patient Statement', `${patient.full_name}  |  ${patient.patient_no}`);

  const half = (doc.page.width - PAGE.margin * 2) / 2;
  const leftEnd = keyValueBlock(doc, PAGE.margin, y, half - 12, [
    ['Patient', patient.full_name],
    ['Patient ID', patient.patient_no],
    ['Mobile', patient.mobile]
  ]);
  const rightEnd = keyValueBlock(doc, PAGE.margin + half + 12, y, half - 12, [
    ['Total invoiced', fmtMoney(summary.totalInvoiced)],
    ['Total paid', fmtMoney(summary.totalPaid)],
    ['Outstanding', fmtMoney(summary.totalOutstanding)],
    ['Advance available', fmtMoney(summary.totalCreditsAvailable)]
  ]);
  y = Math.max(leftEnd, rightEnd) + 8;

  y = drawTable(
    doc,
    [
      { key: 'date', label: 'Date', width: 1.2, format: 'date' },
      { key: 'kind', label: 'Type', width: 1.2 },
      { key: 'reference', label: 'Reference', width: 1.6 },
      { key: 'debit', label: 'Debit', width: 1.2, align: 'right', format: 'money' },
      { key: 'credit', label: 'Credit', width: 1.2, align: 'right', format: 'money' },
      { key: 'balance', label: 'Balance', width: 1.2, align: 'right', format: 'money' }
    ],
    entries,
    y + 12
  );

  footerOnEveryPage(doc, clinic);
  waitForPdf(doc, res, `Statement-${patient.patient_no}.pdf`);
}

export async function streamConsent({ consent, planNo, patient, dentistName }, res) {
  const clinic = await getClinic();
  const doc = newDoc();
  let y = clinicHeader(doc, clinic, 'Informed Consent', `${consent.title}`);

  y = keyValueBlock(doc, PAGE.margin, y, doc.page.width - PAGE.margin * 2, [
    ['Patient', patient.fullName],
    ['Patient ID', patient.patientNo],
    ['Plan', planNo],
    ['Consent type', consent.consentType],
    ['Signed by', consent.signerName],
    ['Witness', consent.witnessName || '-'],
    ['Signed on', fmtDateTime(consent.signedAt)]
  ]);
  y += 6;

  doc.font('Helvetica').fontSize(10).fillColor('#1f2d3d')
    .text(consent.body, PAGE.margin, y + 8, { width: doc.page.width - PAGE.margin * 2, align: 'justify' });
  y = doc.y + 12;

  if (consent.signatureFile) {
    const sigPath = path.join(DATA_DIRS.consents, path.basename(consent.signatureFile));
    if (fs.existsSync(sigPath)) {
      try {
        doc.image(sigPath, PAGE.margin, y, { fit: [160, 80] });
        y += 90;
      } catch {
        /* ignore */
      }
    }
  }
  doc.moveTo(PAGE.margin, y).lineTo(PAGE.margin + 200, y).lineWidth(0.7).strokeColor(COLORS.muted).stroke();
  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
    .text(`Signature of ${consent.signerName}`, PAGE.margin, y + 4, { width: 200 });

  if (dentistName) {
    const rx = doc.page.width - PAGE.margin - 180;
    doc.moveTo(rx, y).lineTo(rx + 180, y).lineWidth(0.7).strokeColor(COLORS.muted).stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
      .text(`Dentist: ${dentistName}`, rx, y + 4, { width: 180 });
  }

  footerOnEveryPage(doc, clinic);
  waitForPdf(doc, res, `Consent-${planNo}.pdf`);
}

export { fmtMoney, fmtDate, fmtDateTime };
