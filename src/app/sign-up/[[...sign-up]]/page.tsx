"use client";

import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type SignUpStep = "form" | "verify";
type FlowResult = {
    error?: {
        message?: string;
        errors?: Array<{ longMessage?: string; message?: string }>;
    } | null;
};
type FinalizeInput = {
    navigate: (args: {
        decorateUrl: (url: string) => string;
        session?: { currentTask?: unknown } | null;
    }) => void | Promise<void>;
};
type SignUpApi = {
    status: string;
    password: (input: {
        emailAddress: string;
        password: string;
        firstName?: string;
        lastName?: string;
    }) => Promise<FlowResult>;
    finalize: (input: FinalizeInput) => Promise<void>;
    verifications: {
        sendEmailCode: () => Promise<FlowResult>;
        verifyEmailCode: (input: { code: string }) => Promise<FlowResult>;
    };
};

const inputClassName =
    "w-full rounded-md border border-[#d1d3d8] bg-white px-3 py-2 text-sm text-[#2e2f34] shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-[#a0a3aa] focus:border-[#b9bbc3] focus:ring-2 focus:ring-[#e1e2e7]";

const buttonClassName =
    "w-full rounded-md bg-linear-to-b from-[#3f4250] to-[#1e2029] px-4 py-2 text-sm font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_2px_6px_rgba(0,0,0,0.18)] transition hover:from-[#4a4d5b] hover:to-[#262833] disabled:opacity-60";

const labelClassName = "block text-sm font-medium text-[#24262e]";

function getClerkErrorMessage(err: unknown): string {
    if (typeof err === "object" && err !== null && "errors" in err) {
        const errors = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
        if (errors?.[0]?.longMessage) return errors[0].longMessage;
        if (errors?.[0]?.message) return errors[0].message;
    }
    if (err instanceof Error) return err.message;
    return "Something went wrong. Please try again.";
}

export default function SignUpPage() {
    const router = useRouter();
    const { signUp, fetchStatus } = useSignUp();
    const signUpApi = signUp as unknown as SignUpApi;
    const [step, setStep] = useState<SignUpStep>("form");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [emailAddress, setEmailAddress] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const isSubmitting = fetchStatus === "fetching";

    const canSubmit = useMemo(() => {
        if (isSubmitting) return false;
        if (step === "form") return emailAddress.trim().length > 3 && password.trim().length >= 8;
        return code.trim().length >= 6;
    }, [isSubmitting, step, emailAddress, password, code]);

    const finalizeSignUp = async () => {
        await signUpApi.finalize({
            navigate: ({ decorateUrl, session }) => {
                if (session?.currentTask) return;
                const url = decorateUrl("/");
                if (url.startsWith("http")) {
                    window.location.href = url;
                    return;
                }
                router.replace(url);
            },
        });
    };

    const handleSignUpSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!signUp) return;
        setErrorMsg("");
        try {
            const passwordResult = await signUpApi.password({
                emailAddress: emailAddress.trim(),
                password: password.trim(),
                ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
                ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
            });
            if (passwordResult.error) {
                setErrorMsg(getClerkErrorMessage(passwordResult.error));
                return;
            }

            if (signUpApi.status === "complete") {
                await finalizeSignUp();
                return;
            }

            const sendCodeResult = await signUpApi.verifications.sendEmailCode();
            if (sendCodeResult.error) {
                setErrorMsg(getClerkErrorMessage(sendCodeResult.error));
                return;
            }
            setStep("verify");
        } catch (err: unknown) {
            setErrorMsg(getClerkErrorMessage(err));
        }
    };

    const handleVerifySubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!signUp) return;
        setErrorMsg("");
        try {
            const result = await signUpApi.verifications.verifyEmailCode({ code: code.trim() });
            if (result.error) {
                setErrorMsg(getClerkErrorMessage(result.error));
                return;
            }

            if (signUpApi.status === "complete") {
                await finalizeSignUp();
                return;
            }

            setErrorMsg("Verification is not complete yet.");
        } catch (err: unknown) {
            setErrorMsg(getClerkErrorMessage(err));
        }
    };

    const resendCode = async () => {
        if (!signUp || isSubmitting) return;
        setErrorMsg("");
        try {
            const result = await signUpApi.verifications.sendEmailCode();
            if (result.error) {
                setErrorMsg(getClerkErrorMessage(result.error));
            }
        } catch (err: unknown) {
            setErrorMsg(getClerkErrorMessage(err));
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#04050a] px-4 py-10">
            <div className="w-full max-w-[400px] overflow-hidden rounded-xl border border-[#e3e4e8] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.22)]">
                <div className="space-y-5 px-7 pb-6 pt-7">
                    <header className="space-y-1 text-center">
                        <h1 className="text-xl font-semibold tracking-tight text-[#1f2026]">
                            {step === "form" ? "Create your account" : "Verify your email"}
                        </h1>
                        <p className="text-sm text-[#6e717a]">
                            {step === "form"
                                ? "Welcome! Please fill in the details to get started."
                                : `Enter the code sent to ${emailAddress}`}
                        </p>
                    </header>

                    {step === "form" && (
                        <form onSubmit={handleSignUpSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <div className="flex items-end justify-between">
                                        <label className={labelClassName}>First name</label>
                                        <span className="text-xs text-[#9498a1]">Optional</span>
                                    </div>
                                    <input
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        type="text"
                                        className={inputClassName}
                                        autoComplete="given-name"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-end justify-between">
                                        <label className={labelClassName}>Last name</label>
                                        <span className="text-xs text-[#9498a1]">Optional</span>
                                    </div>
                                    <input
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        type="text"
                                        className={inputClassName}
                                        autoComplete="family-name"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClassName}>Email address</label>
                                <input
                                    value={emailAddress}
                                    onChange={(e) => setEmailAddress(e.target.value)}
                                    type="email"
                                    className={inputClassName}
                                    placeholder="Enter your email address"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClassName}>Password</label>
                                <input
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    type="password"
                                    className={inputClassName}
                                    placeholder="At least 8 characters"
                                    autoComplete="new-password"
                                    required
                                />
                            </div>
                            <button type="submit" disabled={!canSubmit} className={buttonClassName}>
                                {isSubmitting ? "Please wait..." : "Continue"}
                            </button>
                            <p className="text-center text-xs leading-5 text-[#6e717a]">
                                By clicking &quot;Continue&quot;, you agree to our{" "}
                                <Link className="underline hover:text-[#4a4d56]" href="/terms">
                                    Terms of Service
                                </Link>{" "}
                                and{" "}
                                <Link className="underline hover:text-[#4a4d56]" href="/privacy">
                                    Privacy Policy
                                </Link>
                                .
                            </p>
                        </form>
                    )}

                    {step === "verify" && (
                        <form onSubmit={handleVerifySubmit} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className={labelClassName}>Email code</label>
                                <input
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    type="text"
                                    inputMode="numeric"
                                    className={inputClassName}
                                    placeholder="6-digit code"
                                    autoComplete="one-time-code"
                                    required
                                />
                            </div>
                            <button type="submit" disabled={!canSubmit} className={buttonClassName}>
                                {isSubmitting ? "Please wait..." : "Verify"}
                            </button>
                            <button
                                type="button"
                                onClick={resendCode}
                                className="w-full text-xs text-[#6e717a] underline hover:text-[#4a4d56]"
                            >
                                Resend code
                            </button>
                        </form>
                    )}

                    {errorMsg && (
                        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-600">
                            {errorMsg}
                        </p>
                    )}
                </div>

                <div className="border-t border-[#ececef] bg-[#f7f7f8] px-7 py-3 text-center text-sm text-[#6e717a]">
                    Already have an account?{" "}
                    <Link href="/sign-in" className="font-medium text-[#1f2026] hover:underline">
                        Sign in
                    </Link>
                </div>
                <div className="border-t border-[#ececef] bg-[#f7f7f8] px-7 py-2 text-center text-[11px] text-[#8b8e96]">
                    Secured by Clerk
                </div>
            </div>
        </div>
    );
}
