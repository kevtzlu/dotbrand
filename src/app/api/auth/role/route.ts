import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isAdminByRole } from "@/lib/user";

export async function GET() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await isAdminByRole(userId);
    return NextResponse.json({ role: isAdmin ? "admin" : "user" });
}
