const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const pool = new Pool({
  host:     'localhost',
  port:     5432,
  database: 'bluecrow_asset_management',
  user:     'postgres',
  password: 'bluecrow2026',
})

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrate_ga.sql'), 'utf8')
  try {
    const client = await pool.connect()
    try {
      const result = await client.query(sql)
      const last = Array.isArray(result) ? result[result.length - 1] : result
      console.log('✓', last.rows?.[0]?.resultado ?? 'OK')
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('✗', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

run()
