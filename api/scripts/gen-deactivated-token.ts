// scripts/gen-deactivated-token.ts — crafts a JWT for a specific
// staff_user_id, used only to test whether requireAuth re-checks the
// active flag or trusts the token blindly for its full 8h lifetime.
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error('JWT_SECRET not set');

const staffId = Number(process.argv[2]);
const email = process.argv[3];
const role = process.argv[4] ?? 'paralegal';

const token = jwt.sign(
  { staff_user_id: staffId, google_email: email, role },
  JWT_SECRET,
  { expiresIn: 3600 }
);
console.log(token);
