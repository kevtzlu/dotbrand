import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncUser } from "@/lib/user";

function getCurrentUserEmail(user: Awaited<ReturnType<typeof currentUser>>): string | null {
    if (!user) {
        return null;
    }

    const primaryEmailId = user.primaryEmailAddressId;
    const primaryEmail =
        user.emailAddresses.find((email) => email.id === primaryEmailId)?.emailAddress ??
        user.emailAddresses[0]?.emailAddress;

    return primaryEmail ?? null;
}

export async function POST() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
        return NextResponse.json({ error: "Unable to load Clerk user" }, { status: 404 });
    }

    const email = getCurrentUserEmail(user);
    if (!email) {
        return NextResponse.json({ error: "User does not have a valid email" }, { status: 400 });
    }

    const syncedUser = await syncUser({
        userId,
        email,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : undefined,
    });

    return NextResponse.json({ user: syncedUser });
}
