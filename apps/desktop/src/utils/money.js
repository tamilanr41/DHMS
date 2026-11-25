export function toPaise(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function fromPaise(paise) {
  return (paise / 100).toFixed(2);
}

export function linePaise(quantity, unitPrice, discount) {
  const gross = Math.round((toPaise(quantity) * toPaise(unitPrice)) / 100);
  return gross - toPaise(discount);
}

export function totalsPaise(items, taxPercent) {
  let subtotal = 0;
  let discountTotal = 0;
  for (const item of items) {
    subtotal += Math.round((toPaise(item.quantity) * toPaise(item.unitPrice)) / 100);
    discountTotal += toPaise(item.discount);
  }
  const taxable = subtotal - discountTotal;
  const taxTotal = Math.round((taxable * toPaise(taxPercent)) / 10000);
  return { subtotal, discountTotal, taxTotal, total: taxable + taxTotal };
}
