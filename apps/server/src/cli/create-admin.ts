// CLI: create or re-password an admin user.
//
//   pnpm --filter @xxf/server exec tsx src/cli/create-admin.ts \
//     --email you@example.com --password '...'
//
// Idempotent on email: if the user exists, its password + role are updated.
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { hashPassword } from '../core/users/passwords.js';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      password: { type: 'string' },
      role: { type: 'string', default: 'admin' },
    },
  });
  if (!values.email || !values.password) {
    console.error('usage: --email <email> --password <password> [--role admin|contributor]');
    process.exit(2);
  }
  const role = (values.role ?? 'admin') as 'admin' | 'contributor' | 'consumer';
  if (!['admin', 'contributor', 'consumer'].includes(role)) {
    console.error(`invalid --role: ${role}`);
    process.exit(2);
  }

  const passwordHash = await hashPassword(values.password);
  const existing = (await db.select().from(users).where(eq(users.email, values.email)).limit(1))[0];

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, role, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
    console.log(`updated ${values.email} (role=${role})`);
  } else {
    const [row] = await db
      .insert(users)
      .values({ email: values.email, passwordHash, role })
      .returning();
    console.log(`created ${row?.email} (id=${row?.id}, role=${role})`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
