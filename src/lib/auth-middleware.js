import { getAuth } from 'firebase-admin/auth';

export async function verifyAdminAuth(req) {
  const authHeader = req.headers && req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('AUTH_REQUIRED');
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    throw new Error('AUTH_REQUIRED');
  }

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    throw new Error('AUTH_REQUIRED');
  }

  const isAdmin = decoded.admin === true || decoded.role === 'admin';
  if (!isAdmin) {
    throw new Error('ADMIN_REQUIRED');
  }

  return decoded;
}
