#!/usr/bin/env node
// scripts/seed-db.js
// Jalankan sekali sebelum deploy pertama kali (atau kapan saja untuk verifikasi):
//   node scripts/seed-db.js
//
// Pastikan file .env sudah ada dengan DATABASE_URL yang benar (connection
// string Neon, sebaiknya yang mengandung "-pooler").

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const DEFAULT_DATABASE_URL =
  'postgresql://neondb_owner:npg_SO9rQaMRc1tV@ep-steep-credit-azj75ygm-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL belum diset di file .env');
  process.exit(1);
}

const sql = neon(connectionString);

async function main() {
  console.log('🚀 Memulai inisialisasi database Neon PostgreSQL...');

  await sql`
    CREATE TABLE IF NOT EXISTS app_store (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✅ Tabel app_store berhasil dibuat/diverifikasi.');

  // Seed main_db (rkis + ssh_databases) jika belum ada
  const existingMain = await sql`SELECT key FROM app_store WHERE key = 'main_db'`;
  if (existingMain.length === 0) {
    await sql`INSERT INTO app_store (key, data) VALUES ('main_db', ${JSON.stringify({ rkis: [], ssh_databases: [] })})`;
    console.log('✅ Dokumen main_db (rkis, ssh_databases) diinisialisasi kosong.');
  } else {
    console.log('ℹ️  main_db sudah ada, skip.');
  }

  // Seed users_db + admin default jika belum ada
  const existingUsers = await sql`SELECT key FROM app_store WHERE key = 'users_db'`;
  if (existingUsers.length === 0) {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('Admin@2026!', salt);
    const usersDb = {
      users: [
        {
          id: 'admin-001',
          username: 'admin',
          password: hashed,
          role: 'admin',
          name: 'Administrator',
          email: 'admin@bapperida.go.id',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLogin: null
        }
      ]
    };
    await sql`INSERT INTO app_store (key, data) VALUES ('users_db', ${JSON.stringify(usersDb)})`;
    console.log('✅ Admin default dibuat: username=admin, password=Admin@2026!');
  } else {
    console.log('ℹ️  users_db sudah ada, skip seed admin.');
  }

  console.log('\n🎉 Database Neon siap digunakan oleh backend Render!');
  console.log('📌 Langkah selanjutnya:');
  console.log('   1. Set DATABASE_URL di Render Dashboard > Environment');
  console.log('   2. Set JWT_SECRET (string random panjang & rahasia)');
  console.log('   3. Set GEMINI_API_KEY dan/atau OPENAI_API_KEY (opsional, bisa juga via panel Admin)');
  console.log('   4. Push/redeploy service Render kamu');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
