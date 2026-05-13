import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminByRole, syncUser } from "@/lib/user";

function getClerkUserEmail(user: any): string | null {
    const primaryEmailId = user?.primaryEmailAddressId ?? user?.primary_email_address_id;
    const emailAddresses = user?.emailAddresses ?? user?.email_addresses ?? [];

    const primaryEmail =
        emailAddresses.find((email: any) => (email.id ?? email?.id) === primaryEmailId)?.emailAddress ??
        emailAddresses.find((email: any) => (email.id ?? email?.id) === primaryEmailId)?.email_address ??
        emailAddresses[0]?.emailAddress ??
        emailAddresses[0]?.email_address;

    return primaryEmail ?? null;
}

// POST /api/admin/backfill-users
// Pull all Clerk users and upsert them into Supabase users table.
export async function POST() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await isAdminByRole(userId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const client = await clerkClient();
    const limit = 100;
    let offset = 0;
    let total = 0;
    let processed = 0;
    let skippedNoEmail = 0;

    while (true) {
        const page = await client.users.getUserList({ limit, offset });
        const users = page.data ?? [];
        total += users.length;

        for (const clerkUser of users) {
            const email = getClerkUserEmail(clerkUser);
            if (!email) {
                skippedNoEmail += 1;
                continue;
            }

            await syncUser({
                userId: clerkUser.id,
                email,
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                imageUrl: clerkUser.imageUrl,
                lastSignInAt: clerkUser.lastSignInAt ? new Date(clerkUser.lastSignInAt) : undefined,
            });
            processed += 1;
        }

        if (users.length < limit) {
            break;
        }
        offset += limit;
    }

    return NextResponse.json({
        success: true,
        totalFetched: total,
        processed,
        skippedNoEmail,
    });
}
