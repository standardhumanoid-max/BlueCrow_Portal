const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  host:     process.env.GA_DB_HOST     || 'localhost',
  port:     parseInt(process.env.GA_DB_PORT || '5432'),
  database: process.env.GA_DB_NAME     || 'bluecrow_asset_management',
  user:     process.env.GA_DB_USER     || 'postgres',
  password: process.env.GA_DB_PASSWORD || 'bluecrow2026',
})

pool.query(`ALTER TABLE ga_assets ADD CONSTRAINT ga_assets_name_unique UNIQUE (name)`)
  .then(() => { console.log('✓ UNIQUE(name) adicionado'); pool.end() })
  .catch(e => { console.log('ℹ', e.message); pool.end() })

