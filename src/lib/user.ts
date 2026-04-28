import { supabaseAdmin } from "@/lib/supabase";

export type SyncUserInput = {
    userId: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    imageUrl?: string | null;
    lastSignInAt?: Date;
};

export async function syncUser(input: SyncUserInput) {
    const { data, error } = await supabaseAdmin
        .from("users")
        .upsert(
            {
                clerk_user_id: input.userId,
                email: input.email,
                first_name: input.firstName ?? null,
                last_name: input.lastName ?? null,
                avatar_url: input.imageUrl ?? null,
                last_sign_in: (input.lastSignInAt ?? new Date()).toISOString(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: "clerk_user_id" }
        )
        .select("id, clerk_user_id, email, first_name, last_name, avatar_url, last_sign_in, created_at, updated_at")
        .single();

    if (error) {
        throw new Error(`Failed to sync user: ${error.message}`);
    }

    return data;
}

export async function deleteSyncedUser(userId: string) {
    const { error } = await supabaseAdmin.from("users").delete().eq("clerk_user_id", userId);

    if (error) {
        throw new Error(`Failed to delete synced user: ${error.message}`);
    }
}
