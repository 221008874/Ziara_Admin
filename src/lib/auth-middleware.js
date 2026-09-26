import { COMMUNITY, getAdminAuth } from "../../api/_lib/firebase-admin";

/**
 * Verifies the caller's Firebase ID token and requires the platform-admin claim.
 *
 * The token is ALWAYS verified against the Community project (smartclinicadmin),
 * because that is the project this panel signs in through (src/firebase.js). An ID
 * token is scoped to its issuing project, so verifying it against any other project's
 * admin app would reject every legitimate admin. Handlers that go on to touch ERP data
 * still verify the caller here and then use the ERP credential for the data itself.
 */
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
    decoded = await getAdminAuth(COMMUNITY).verifyIdToken(idToken);
  } catch {
    throw new Error('AUTH_REQUIRED');
  }

  const isAdmin = decoded.admin === true || decoded.role === 'admin';
  if (!isAdmin) {
    throw new Error('ADMIN_REQUIRED');
  }

  return decoded;
}
