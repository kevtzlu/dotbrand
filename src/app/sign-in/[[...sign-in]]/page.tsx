import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#09090b]">
            <SignIn />
        </div>
    );
}
