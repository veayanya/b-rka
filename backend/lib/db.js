// lib/db.js
// Adapter Neon PostgreSQL untuk backend Express (Render).
// Menggantikan penyimpanan file JSON lokal (data/db.json, data/users.json)
// yang hilang setiap kali Render redeploy/restart (disk ephemeral).
//
// Pola: satu tabel `app_store` (key TEXT, data JSONB) menyimpan setiap
// "dokumen" (main_db, users_db, api_config) sebagai satu baris JSONB.
// Ini sengaja dibuat mirip struktur file JSON lama agar migrasi ke kode
// yang sudah ada (server.js, auth/userDb.js, utils/sshStorage.js) minim risiko.
//
// Wajib set environment variable DATABASE_URL (connection string Neon)
// di Render Dashboard > Environment.

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DEFAULT_DATABASE_URL =
  'postgresql://neondb_owner:npg_SO9rQaMRc1tV@ep-steep-credit-azj75ygm-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

let sql;
let tableReady = false;

function getSql() {
  if (!sql) {
    const connStr = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
    if (!connStr) {
      throw new Error(
        'DATABASE_URL belum diset. Tambahkan di Render Dashboard > Environment, isi dengan connection string Neon (gunakan yang mengandung "-pooler").'
      );
    }
    sql = neon(connStr);
  }
  return sql;
}

async function ensureTable() {
  if (tableReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS app_store (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  tableReady = true;
}

// Cek koneksi ke Neon — dipakai oleh endpoint /api/health
export async function checkDbConnection() {
  const sql = getSql();
  const rows = await sql`SELECT NOW() AS now`;
  return rows[0]?.now;
}

// Ambil satu "dokumen" JSON berdasarkan key. Return null jika belum ada.
export async function getStore(key) {
  const sql = getSql();
  await ensureTable();
  const rows = await sql`SELECT data FROM app_store WHERE key = ${key}`;
  return rows[0]?.data ?? null;
}

// Simpan (insert atau update) satu "dokumen" JSON berdasarkan key.
export async function setStore(key, data) {
  const sql = getSql();
  await ensureTable();
  const json = JSON.stringify(data);
  await sql`
    INSERT INTO app_store (key, data, updated_at)
    VALUES (${key}, ${json}, NOW())
    ON CONFLICT (key) DO UPDATE
    SET data = ${json}, updated_at = NOW()
  `;
}
