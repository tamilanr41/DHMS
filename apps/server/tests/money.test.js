import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampNonNegative,
  formatDecimal,
  formatIndian,
  fromPaise,
  multiplyMoney,
  percentageOf,
  toPaise
} from '../src/utils/money.js';
import { computeInvoiceTotals, invoiceLineTotal } from '../src/services/invoice.service.js';

test('parses and formats paise exactly', () => {
  assert.equal(toPaise('0.10') + toPaise('0.20'), 30n);
  assert.equal(fromPaise(30n), '0.30');
  assert.equal(toPaise('1.005'), 101n);
  assert.equal(toPaise('2.675'), 268n);
  assert.equal(toPaise(0), 0n);
  assert.equal(toPaise(''), 0n);
  assert.equal(fromPaise(-150n), '-1.50');
});

test('multiplies unit price by fractional quantity without drift', () => {
  assert.equal(multiplyMoney(toPaise('149.99'), 2), toPaise('299.98'));
  assert.equal(multiplyMoney(toPaise('10.00'), 0.5), toPaise('5.00'));
  assert.equal(multiplyMoney(toPaise('0.01'), 3), toPaise('0.03'));
  assert.equal(fromPaise(multiplyMoney(toPaise('99.995'), 1)), '100.00');
});

test('computes percentages with half-up rounding', () => {
  assert.equal(percentageOf(toPaise('100.00'), 18), toPaise('18.00'));
  assert.equal(percentageOf(toPaise('1400.00'), 18), toPaise('252.00'));
  assert.equal(percentageOf(toPaise('0.01'), 50), 1n);
  assert.equal(percentageOf(toPaise('100.00'), 0), 0n);
});

test('groups amounts in the Indian numbering system', () => {
  assert.equal(formatIndian('1234567.5'), '12,34,567.50');
  assert.equal(formatIndian('999.999'), '1,000.00');
  assert.equal(formatIndian(0), '0.00');
  assert.equal(formatIndian('-1234.5'), '-1,234.50');
});

test('formats decimal quantities for PostgreSQL NUMERIC', () => {
  assert.equal(formatDecimal(2, 2), '2.00');
  assert.equal(formatDecimal('0.3333', 3), '0.333');
  assert.equal(formatDecimal(18, 2), '18.00');
  assert.equal(clampNonNegative(-5n), 0n);
});

test('totals sum lines, discounts and tax with exact arithmetic', () => {
  const totals = computeInvoiceTotals(
    [
      { unitPrice: 149.99, quantity: 2, discount: 0 },
      { unitPrice: 0.01, quantity: 1, discount: 0 }
    ],
    18
  );
  assert.deepEqual(totals, {
    subtotal: '299.99',
    discountTotal: '0.00',
    taxTotal: '54.00',
    total: '353.99',
    taxable: '299.99'
  });

  const discounted = computeInvoiceTotals([{ unitPrice: 1500, quantity: 1, discount: 100 }], 18);
  assert.equal(discounted.taxable, '1400.00');
  assert.equal(discounted.taxTotal, '252.00');
  assert.equal(discounted.total, '1652.00');
});

test('rejects discounts larger than the amount they apply to', () => {
  assert.throws(
    () => computeInvoiceTotals([{ unitPrice: 100, quantity: 1, discount: 100.01 }], 0),
    /Discount cannot exceed/
  );
  assert.throws(() => invoiceLineTotal(100, 2, 200.01), /Discount cannot exceed/);
  assert.equal(invoiceLineTotal(1500, 2, 100), '2900.00');
});

test('handles a large invoice without losing a paisa', () => {
  const items = Array.from({ length: 250 }, (_, i) => ({
    unitPrice: 199.99,
    quantity: 3,
    discount: i % 5 === 0 ? 0.07 : 0
  }));
  const totals = computeInvoiceTotals(items, 18);
  assert.equal(totals.subtotal, '149992.50');
  assert.equal(totals.discountTotal, '3.50');
  assert.equal(totals.taxTotal, '26998.02');
  assert.equal(totals.total, '176987.02');
});
