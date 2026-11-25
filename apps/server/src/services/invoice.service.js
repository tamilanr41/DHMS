import { clampNonNegative, fromPaise, multiplyMoney, percentageOf, toPaise } from '../utils/money.js';

/**
 * Recomputes paid / outstanding / status for an invoice from the ledger
 * (completed payments minus refunds). Caller must hold a row lock on the invoice.
 */
export async function recalcInvoice(client, invoiceId) {
  const { rows: invRows } = await client.query('SELECT * FROM invoices WHERE id = $1 FOR UPDATE', [invoiceId]);
  const invoice = invRows[0];
  if (!invoice) return null;
  if (invoice.status === 'void') {
    const { rows } = await client.query(
      `UPDATE invoices SET amount_paid = 0, outstanding_balance = 0 WHERE id = $1 RETURNING *`,
      [invoiceId]
    );
    return rows[0];
  }

  const { rows: sums } = await client.query(
    `SELECT
       COALESCE((SELECT sum(amount) FROM payments WHERE invoice_id = $1 AND status = 'completed'), 0) AS paid,
       COALESCE((SELECT sum(amount) FROM refunds WHERE invoice_id = $1), 0) AS refunded,
       COALESCE((SELECT sum(amount) FROM invoice_adjustments WHERE invoice_id = $1 AND type = 'credit_note'), 0) AS credits,
       COALESCE((SELECT sum(amount) FROM invoice_adjustments WHERE invoice_id = $1 AND type = 'debit_note'), 0) AS debits,
       COALESCE((SELECT sum(amount) FROM invoice_adjustments WHERE invoice_id = $1 AND type = 'write_off'), 0) AS writeoffs`,
    [invoiceId]
  );
  const paid = toPaise(sums[0].paid);
  const refunded = toPaise(sums[0].refunded);
  const net = clampNonNegative(paid - refunded);
  const total = toPaise(invoice.total);
  const credits = toPaise(sums[0].credits);
  const debits = toPaise(sums[0].debits);
  const writeoffs = toPaise(sums[0].writeoffs);

  // Credit notes reduce the receivable, debit notes increase it and write-offs
  // clear whatever remains. The invoice total itself is never mutated, so the
  // original bill stays auditable.
  const adjustedTotal = clampNonNegative(total - credits + debits - writeoffs);
  const outstanding = clampNonNegative(adjustedTotal - net);

  let status = invoice.status;
  if (invoice.status !== 'draft' && invoice.status !== 'void') {
    if (outstanding <= 0n) {
      if (writeoffs > 0n && net < adjustedTotal) status = 'written_off';
      else status = 'paid';
    } else if (net > 0n) {
      status = 'partially_paid';
    } else {
      status = 'issued';
    }
  }

  const { rows } = await client.query(
    `UPDATE invoices SET amount_paid = $2, outstanding_balance = $3, status = $4 WHERE id = $1 RETURNING *`,
    [invoiceId, fromPaise(net), fromPaise(outstanding), status]
  );
  return rows[0];
}

export function computeInvoiceTotals(items, taxPercent) {
  let subtotal = 0n;
  let discountTotal = 0n;
  for (const item of items) {
    subtotal += multiplyMoney(toPaise(item.unitPrice, 'Unit price'), item.quantity);
    discountTotal += toPaise(item.discount || 0, 'Discount');
  }
  if (discountTotal > subtotal) throw new Error('Discount cannot exceed subtotal');
  const taxable = subtotal - discountTotal;
  const taxTotal = percentageOf(taxable, taxPercent || 0);
  const total = taxable + taxTotal;
  return {
    subtotal: fromPaise(subtotal),
    discountTotal: fromPaise(discountTotal),
    taxTotal: fromPaise(taxTotal),
    total: fromPaise(total),
    taxable: fromPaise(taxable)
  };
}

export function invoiceLineTotal(unitPrice, quantity, discount) {
  const gross = multiplyMoney(toPaise(unitPrice, 'Unit price'), quantity);
  const net = gross - toPaise(discount || 0, 'Discount');
  if (net < 0n) throw new Error('Discount cannot exceed the line amount');
  return fromPaise(net);
}
