import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

export type Row = Record<string, unknown>

let pool: Pool | null = null

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '3i_Sales_funnel',
      waitForConnections: true,
      connectionLimit: 20,
      namedPlaceholders: false,
      timezone: 'Z',
      dateStrings: true,
      charset: 'utf8mb4',
    })
  }
  return pool
}

export function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export async function all<T = Row>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await getPool().query<RowDataPacket[]>(sql, params)
  return rows as unknown as T[]
}

export async function get<T = Row>(sql: string, params: any[] = []): Promise<T | undefined> {
  const rows = await all<T>(sql, params)
  return rows[0]
}

export async function run(sql: string, params: any[] = []) {
  const [result] = await getPool().query<ResultSetHeader>(sql, params)
  return {
    insertId: Number(result.insertId),
    affectedRows: result.affectedRows,
    lastInsertRowid: Number(result.insertId),
    changes: result.affectedRows,
  }
}

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}
