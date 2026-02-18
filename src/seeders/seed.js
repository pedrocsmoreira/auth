import 'dotenv/config';
import crypto from 'crypto';
import { sequelize, User, Role } from '../models/index.js';
import { hashPassword } from '../middleware/hash.js';

const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

async function seed() {
    // alter: true so new columns (e.g. deactivated_at) are added when seeding a fresh DB.
    await sequelize.sync({ alter: true });

    // Idempotently create roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'admin' } });
    const [userRole]  = await Role.findOrCreate({ where: { name: 'user' } });
    console.log(`Roles ready: admin (id=${adminRole.id}), user (id=${userRole.id})`);

    // Skip if an admin already exists
    const existingAdmin = await User.findOne({ where: { roleId: adminRole.id } });
    if (existingAdmin) {
        console.log(`Admin "${existingAdmin.username}" already exists — skipping user creation.`);
        process.exit(0);
    }

    // Use env var password if provided, otherwise generate one and print it
    const plainPassword = ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');
    const hashedPassword = await hashPassword(plainPassword);

    // Generate an invite token so the admin must set their own password on first login
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const admin = await User.create({
        username: ADMIN_USERNAME,
        password: hashedPassword,
        roleId: adminRole.id,
        force_password_change: true,
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires
    });

    console.log('\nFirst admin created:');
    console.log(`  Username : ${admin.username}`);
    if (!ADMIN_PASSWORD) {
        console.log(`  Temp password (only shown once): ${plainPassword}`);
    }
    console.log(`\n  Invite token — use POST /login/reset-password to set a permanent password:`);
    console.log(`  ${resetToken}`);
    console.log(`  Token expires: ${resetTokenExpires.toISOString()}\n`);

    process.exit(0);
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
