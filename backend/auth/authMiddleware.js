// ============================================================
// Auth Middleware — RBAC untuk RKA AI Bapperida
// ============================================================
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'bapperida-rka-jwt-secret-2026-ganti-segera';

/**
 * Middleware: Wajib sudah login (token valid di cookie httpOnly)
 */
export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.authToken;
    if (!token) {
      return res.status(401).json({ error: 'Sesi tidak ditemukan. Silakan login terlebih dahulu.' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali.' });
  }
}

/**
 * Middleware Factory: Wajib memiliki role tertentu
 * @param  {...string} roles - 'admin' | 'user'
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Belum terautentikasi.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki izin untuk fitur ini.' });
    }
    next();
  };
}

/**
 * Generate JWT token
 */
export function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

/**
 * Set auth cookie (httpOnly — tidak dapat diakses JS frontend)
 */
export function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  res.cookie('authToken', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 jam
  });
}

/**
 * Clear auth cookie
 */
export function clearAuthCookie(res) {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  });
}
