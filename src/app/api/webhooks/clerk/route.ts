import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { deleteSyncedUser, syncUser } from "@/lib/user";

function getPrimaryEmail(payload: any): string | null {
    const emailAddresses = payload?.email_addresses ?? [];
    const primaryEmailId = payload?.primary_email_address_id;

    const primaryEmail =
        emailAddresses.find((email: any) => email.id === primaryEmailId)?.email_address ??
        emailAddresses[0]?.email_address;

    return primaryEmail ?? null;
}

export async function POST(req: Request) {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return NextResponse.json({ error: "Missing CLERK_WEBHOOK_SECRET" }, { status: 500 });
    }

    const headerPayload = await headers();
    const svixId = headerPayload.get("svix-id");
    const svixTimestamp = headerPayload.get("svix-timestamp");
    const svixSignature = headerPayload.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
    }

    const payload = await req.text();
    const webhook = new Webhook(webhookSecret);

    let event: any;

    try {
        event = webhook.verify(payload, {
            "svix-id": svixId,
            "svix-timestamp": svixTimestamp,
            "svix-signature": svixSignature,
        });
    } catch {
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    if (event.type === "user.deleted") {
        if (event.data?.id) {
            await deleteSyncedUser(event.data.id);
        }

        return NextResponse.json({ success: true });
    }

    if (event.type === "user.created" || event.type === "user.updated") {
        const email = getPrimaryEmail(event.data);
        if (!email) {
            return NextResponse.json({ error: "No email found on Clerk user payload" }, { status: 400 });
        }

        await syncUser({
            userId: event.data.id,
            email,
            firstName: event.data.first_name,
            lastName: event.data.last_name,
            imageUrl: event.data.image_url,
            lastSignInAt: event.data.last_sign_in_at ? new Date(event.data.last_sign_in_at) : undefined,
        });

        return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true, ignored: true });
}
