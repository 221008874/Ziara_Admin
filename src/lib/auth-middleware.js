import { getAuth } from 'firebase-admin/auth';

/**
 * Middleware to verify that the request is made by a platform administrator.
 * Returns the decoded token if successful, or throws an error.
 * 
 * @param {Object} req - The request object
 * @throws {Error} - If authentication fails or user is not an admin
 */
export async function verifyAdminAuth(req) {
  const auth = getAuth();
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('AUTH_REQUIRED');
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decoded = await auth.verifyIdToken(token);
    
    if (!decoded.admin) {
      throw new Error('ADMIN_REQUIRED');
    }
    
    return decoded;
  } catch (error) {
    if (error.message === 'AUTH_REQUIRED' || error.message === 'ADMIN_REQUIRED') {
      throw error;
    }
    throw new Error('INVALID_TOKEN');
  }
}
