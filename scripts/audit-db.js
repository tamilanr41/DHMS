import { query } from '../apps/server/src/database/db.js';

async function main() {
  console.log('=== ZHANX DENTALCARE DATABASE AUDIT ===');
  const tables = await query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
  );
  console.log(`Total Tables Found: ${tables.rows.length}`);

  const tableData = [];
  for (const t of tables.rows) {
    const res = await query(`SELECT count(*)::int AS count FROM "${t.table_name}"`);
    tableData.push({ Table: t.table_name, Rows: res.rows[0].count });
  }
  console.table(tableData);

  // Check critical tables
  console.log('\n--- Checking Data Integrity & Core Health ---');
  const [users, patients, appts, consults, invoices, rx, chart] = await Promise.all([
    query(`SELECT id, username, full_name, is_active FROM users`),
    query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE is_active)::int AS active FROM patients`),
    query(`SELECT status, count(*)::int AS c FROM appointments GROUP BY status`),
    query(`SELECT status, count(*)::int AS c FROM consultations GROUP BY status`),
    query(`SELECT status, count(*)::int AS c, sum(total)::numeric AS sum_total FROM invoices GROUP BY status`),
    query(`SELECT count(*)::int AS c FROM prescriptions`),
    query(`SELECT count(*)::int AS c FROM tooth_conditions`)
  ]);

  console.log('Users in system:', users.rows);
  console.log('Patients count:', patients.rows[0]);
  console.log('Appointments by status:', appts.rows);
  console.log('Consultations by status:', consults.rows);
  console.log('Invoices by status:', invoices.rows);
  console.log('Prescriptions:', rx.rows[0]);
  console.log('Tooth Condition Definitions:', chart.rows[0]);

  process.exit(0);
}

main().catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});
