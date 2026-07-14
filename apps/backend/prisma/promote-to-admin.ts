/**
 * Issue #125: there is no self-service way to become an admin (by design — see
 * CLAUDE.md §2 rule on least-privilege access to child health data). This is the only
 * writer of User.role = 'admin'; run it directly against the target environment's
 * DATABASE_URL, never expose it as an API endpoint.
 *
 * Usage: pnpm --filter @earlysteps/backend promote-admin -- <username>
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  // `pnpm --filter <pkg> <script> -- <args>` doesn't consistently strip the `--`
  // separator before forwarding argv to the script (unlike plain `npm run`) — Codex QA
  // on this issue hit exactly that, ending up with argv[2] === '--'. Skip it if present
  // so both `... promote-admin -- <username>` and `... promote-admin <username>` work.
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const username = args[0];
  if (!username) {
    console.error('Usage: pnpm --filter @earlysteps/backend promote-admin -- <username>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.update({
      where: { username },
      data: { role: 'admin' },
    });
    console.log(`Promoted ${user.username} (${user.id}) to admin.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
