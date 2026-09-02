// ============================================================
// User Database Helper — RBAC Bapperida RKA AI
// Menyimpan user di Neon PostgreSQL (key 'users_db' di tabel app_store),
// dengan password bcrypt. Data persisten walau server Render restart/redeploy.
// ============================================================
import bcrypt from 'bcryptjs';
import { getStore, setStore } from '../lib/db.js';

const ADMIN_LIMIT = 1;
const USER_LIMIT = 60;

/**
 * Baca database user dari Neon. Buat admin default jika belum ada.
 */
export async function readUsersDb() {
  let db = await getStore('users_db');
  if (!db) {
    // Buat database baru dengan akun admin default
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@2026!', salt);
    db = {
      users: [
        {
          id: 'admin-001',
          username: 'admin',
          password: hashedPassword,
          role: 'admin',
          name: 'Administrator',
          email: 'admin@bapperida.go.id',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLogin: null
        }
      ]
    };
    await setStore('users_db', db);
    console.log('[Auth] Database user dibuat di Neon dengan akun Admin default (admin / Admin@2026!)');
  }
  return db;
}

/**
 * Tulis database user ke Neon
 */
export async function writeUsersDb(data) {
  await setStore('users_db', data);
}

/**
 * Cari user berdasarkan username
 */
export async function findUserByUsername(username) {
  const db = await readUsersDb();
  return db.users.find(u => u.username === username) || null;
}

/**
 * Cari user berdasarkan ID
 */
export async function findUserById(id) {
  const db = await readUsersDb();
  return db.users.find(u => u.id === id) || null;
}

/**
 * Ambil semua user (tanpa field password)
 */
export async function getAllUsers() {
  const db = await readUsersDb();
  return db.users.map(u => {
    const { password, ...safeUser } = u;
    return safeUser;
  });
}

/**
 * Buat user baru (hanya bisa dilakukan Admin)
 * Limit: maks 60 user role 'user'
 */
export async function createUser({ username, password, name, email, role = 'user' }) {
  const db = await readUsersDb();

  // Cek limit
  const userCount = db.users.filter(u => u.role === 'user').length;
  if (role === 'user' && userCount >= USER_LIMIT) {
    throw new Error(`Batas maksimal ${USER_LIMIT} User telah tercapai.`);
  }

  // Cek username duplikat
  if (db.users.find(u => u.username === username)) {
    throw new Error(`Username "${username}" sudah digunakan.`);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = {
    id: 'user-' + Date.now(),
    username,
    password: hashedPassword,
    role,
    name: name || username,
    email: email || '',
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLogin: null
  };

  db.users.push(newUser);
  await writeUsersDb(db);

  const { password: _, ...safeUser } = newUser;
  return safeUser;
}

/**
 * Update user (nama, email, password, isActive)
 */
export async function updateUser(id, updates) {
  const db = await readUsersDb();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('User tidak ditemukan.');

  // Jangan izinkan ubah role admin ke user
  if (db.users[idx].role === 'admin' && updates.role === 'user') {
    throw new Error('Tidak dapat mengubah role Admin menjadi User.');
  }

  // Hash password baru jika ada
  if (updates.password) {
    const salt = await bcrypt.genSalt(10);
    updates.password = await bcrypt.hash(updates.password, salt);
  } else {
    delete updates.password; // jangan update jika tidak ada
  }

  db.users[idx] = { ...db.users[idx], ...updates, updatedAt: new Date().toISOString() };
  await writeUsersDb(db);

  const { password, ...safeUser } = db.users[idx];
  return safeUser;
}

/**
 * Hapus user berdasarkan ID (tidak bisa hapus admin)
 */
export async function deleteUser(id) {
  const db = await readUsersDb();
  const user = db.users.find(u => u.id === id);
  if (!user) throw new Error('User tidak ditemukan.');
  if (user.role === 'admin') throw new Error('Akun Admin tidak dapat dihapus.');

  db.users = db.users.filter(u => u.id !== id);
  await writeUsersDb(db);
  return true;
}

/**
 * Verifikasi password dan update lastLogin
 */
export async function verifyAndLogin(username, password) {
  const db = await readUsersDb();
  const user = db.users.find(u => u.username === username);
  if (!user) return null;
  if (!user.isActive) throw new Error('Akun Anda dinonaktifkan. Hubungi Administrator.');

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return null;

  // Update lastLogin
  user.lastLogin = new Date().toISOString();
  await writeUsersDb(db);

  const { password: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Ambil statistik user
 */
export async function getUserStats() {
  const db = await readUsersDb();
  const total = db.users.length;
  const adminCount = db.users.filter(u => u.role === 'admin').length;
  const userCount = db.users.filter(u => u.role === 'user').length;
  const activeCount = db.users.filter(u => u.isActive).length;
  return { total, adminCount, userCount, activeCount, userLimit: USER_LIMIT };
}
