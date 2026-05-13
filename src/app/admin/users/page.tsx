import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isAdminByRole } from "@/lib/user";
import { supabaseAdmin } from "@/lib/supabase";

type UserRecord = {
    id: string;
    clerk_user_id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    role: "admin" | "user";
    last_sign_in: string | null;
    created_at: string;
    updated_at: string;
};

function formatDate(value: string | null): string {
    if (!value) return "-";
    return new Date(value).toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default async function AdminUsersPage() {
    const { userId } = await auth();
    if (!userId) {
        redirect("/sign-in");
    }
    if (!(await isAdminByRole(userId))) {
        redirect("/projects");
    }

    const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, clerk_user_id, email, first_name, last_name, role, last_sign_in, created_at, updated_at")
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    const users = (data ?? []) as UserRecord[];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] py-10 px-4">
            <div className="max-w-6xl mx-auto space-y-6">
                <Link
                    href="/projects"
                    className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回 Projects
                </Link>

                <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
                        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">使用者管理</h1>
                        <p className="text-sm text-gray-500 mt-1">目前共有 {users.length} 位使用者。</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300">
                                <tr>
                                    <th className="text-left font-semibold px-4 py-3">姓名</th>
                                    <th className="text-left font-semibold px-4 py-3">Email</th>
                                    <th className="text-left font-semibold px-4 py-3">Role</th>
                                    <th className="text-left font-semibold px-4 py-3">Clerk User ID</th>
                                    <th className="text-left font-semibold px-4 py-3">最後登入</th>
                                    <th className="text-left font-semibold px-4 py-3">建立時間</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => {
                                    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "-";
                                    return (
                                        <tr key={user.id} className="border-t border-gray-100 dark:border-gray-800">
                                            <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{fullName}</td>
                                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{user.email}</td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                        user.role === "admin"
                                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                                    }`}
                                                >
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{user.clerk_user_id}</td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(user.last_sign_in)}</td>
                                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(user.created_at)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
