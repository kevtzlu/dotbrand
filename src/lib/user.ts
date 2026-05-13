import { supabaseAdmin } from "@/lib/supabase";
import { getUserRole } from "@/lib/admin";

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
                role: getUserRole(input.userId),
                last_sign_in: (input.lastSignInAt ?? new Date()).toISOString(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: "clerk_user_id", ignoreDuplicates: false }
        )
        .select("id, clerk_user_id, email, first_name, last_name, avatar_url, role, last_sign_in, created_at, updated_at")
        .single();

    if (error) {
        throw new Error(`Failed to sync user: ${error.message}`);
    }

    // Fetch onboarding_shown in a separate query to avoid upsert returning
    // stale/default values for columns not included in the update set.
    const { data: onboardingRow } = await supabaseAdmin
        .from("users")
        .select("onboarding_shown")
        .eq("clerk_user_id", input.userId)
        .single();

    return {
        ...data,
        onboarding_shown: onboardingRow?.onboarding_shown ?? false,
    };
}

export async function deleteSyncedUser(userId: string) {
    const { error } = await supabaseAdmin.from("users").delete().eq("clerk_user_id", userId);

    if (error) {
        throw new Error(`Failed to delete synced user: ${error.message}`);
    }
}
