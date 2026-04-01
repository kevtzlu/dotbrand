import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-[#09090b]">
            <SignUp
                signInUrl="/sign-in"
                appearance={{
                    elements: {
                        socialButtonsBlockButton__google: { display: "none" },
                        dividerRow: { display: "none" },
                    },
                }}
            />
        </div>
    );
}
