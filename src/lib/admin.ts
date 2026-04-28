export type UserRole = "admin" | "user";

function getAdminIds(): string[] {
    return (process.env.ADMIN_USER_IDS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

export function isAdminUserId(userId: string): boolean {
    return getAdminIds().includes(userId);
}

export function getUserRole(userId: string): UserRole {
    return isAdminUserId(userId) ? "admin" : "user";
}
