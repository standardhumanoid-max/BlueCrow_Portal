const { Pool } = require('pg')
require('dotenv').config()

const avPool = new Pool({
  host:     process.env.AV_DB_HOST     || 'localhost',
  port:     parseInt(process.env.AV_DB_PORT || '5432'),
  database: process.env.AV_DB_NAME     || 'bluecrow_asset_valuation',
  user:     process.env.AV_DB_USER     || 'postgres',
  password: process.env.AV_DB_PASSWORD || 'postgres',
})

const compPool = new Pool({
  host:     process.env.COMP_DB_HOST     || 'localhost',
  port:     parseInt(process.env.COMP_DB_PORT || '5432'),
  database: process.env.COMP_DB_NAME     || 'bluecrow_compliance',
  user:     process.env.COMP_DB_USER     || 'postgres',
  password: process.env.COMP_DB_PASSWORD || 'postgres',
})

avPool.on('error',   (err) => console.error('AV pool error:',         err))
compPool.on('error', (err) => console.error('Compliance pool error:', err))

module.exports = { avPool, compPool }
