"use client";

import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

type SignInStep = "identifier" | "password" | "code" | "forgot-password" | "reset-password";
type FlowResult = {
    error?: {
        message?: string;
        errors?: Array<{ longMessage?: string; message?: string }>;
    } | null;
};
type FinalizeInput = {
    navigate?: (args: { session?: unknown | null }) => void | Promise<void>;
};
type SignInApi = {
    status: string;
    createdSessionId?: string;
    password: (input: { emailAddress: string; password: string }) => Promise<FlowResult>;
    finalize: (input: FinalizeInput) => Promise<void>;
    mfa: {
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

export default function SignInPage() {
    const router = useRouter();
    const { isSignedIn } = useAuth();
    const { signIn, fetchStatus } = useSignIn();
    const { setActive } = useClerk();

    useEffect(() => {
        if (isSignedIn) {
            router.replace("/projects");
        }
    }, [isSignedIn, router]);
    const signInApi = signIn as unknown as SignInApi;
    const [step, setStep] = useState<SignInStep>("identifier");
    const [emailAddress, setEmailAddress] = useState("");
    const [password, setPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [resetCode, setResetCode] = useState("");
    const [code, setCode] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const isSubmitting = fetchStatus === "fetching";

    const canSubmit = useMemo(() => {
        if (isSubmitting) return false;
        if (step === "identifier") return emailAddress.trim().length > 3;
        if (step === "password") return emailAddress.trim().length > 3 && password.trim().length > 0;
        if (step === "forgot-password") return emailAddress.trim().length > 3;
        if (step === "reset-password")
            return resetCode.trim().length >= 6 && newPassword.trim().length >= 8 && newPassword === confirmPassword;
        return code.trim().length >= 6;
    }, [isSubmitting, step, emailAddress, password, code, resetCode, newPassword, confirmPassword]);

    const finalizeSignIn = async () => {
        await signInApi.finalize({
            navigate: () => {
                router.replace("/");
            },
        });
    };

    const handlePasswordSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!signIn) return;
        setErrorMsg("");
        try {
            const result = await signInApi.password({
                emailAddress: emailAddress.trim(),
                password: password.trim(),
            });
            if (result.error) {
                setErrorMsg(getClerkErrorMessage(result.error));
                return;
            }

            if (signInApi.status === "complete") {
                await finalizeSignIn();
                return;
            }

            // Core 3: client trust / MFA email verification flow
            if (signInApi.status === "needs_client_trust" || signInApi.status === "needs_second_factor") {
                const sendCodeResult = await signInApi.mfa.sendEmailCode();
                if (sendCodeResult.error) {
                    setErrorMsg(getClerkErrorMessage(sendCodeResult.error));
                    return;
                }
                setStep("code");
                return;
            }

            setErrorMsg("Additional verification is required. Please try again.");
        } catch (err: unknown) {
            setErrorMsg(getClerkErrorMessage(err));
        }
    };

    const handleIdentifierSubmit = (e: FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        if (emailAddress.trim().length > 3) {
            setStep("password");
        }
    };

    const handleForgotPasswordSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!signIn) return;
        setErrorMsg("");
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (signIn as any).create({
                strategy: "reset_password_email_code",
                identifier: emailAddress.trim(),
            });
            setResetSent(true);
            setStep("reset-password");
        } catch (err: unknown) {
            setErrorMsg(getClerkErrorMessage(err));
        }
    };

    const handleResetPasswordSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!signIn) return;
        setErrorMsg("");
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (signIn as any).attemptFirstFactor({
                strategy: "reset_password_email_code",
                code: resetCode.trim(),
                password: newPassword.trim(),
            });
            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                router.replace("/");
                return;
            }
            setErrorMsg("Password reset is not complete. Please try again.");
        } catch (err: unknown) {
            setErrorMsg(getClerkErrorMessage(err));
        }
    };

    const handleCodeSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!signIn) return;
        setErrorMsg("");
        try {
            const result = await signInApi.mfa.verifyEmailCode({
                code: code.trim(),
            });
            if (result.error) {
                setErrorMsg(getClerkErrorMessage(result.error));
                return;
            }

            if (signInApi.status === "complete") {
                await finalizeSignIn();
                return;
            }

            setErrorMsg("Verification is not complete yet.");
        } catch (err: unknown) {
            setErrorMsg(getClerkErrorMessage(err));
        }
    };

    const title =
        step === "identifier" || step === "password"
            ? "Sign in to estimait"
            : step === "forgot-password"
              ? "Reset your password"
              : step === "reset-password"
                ? "Set a new password"
                : "Check your email";

    const subtitle =
        step === "identifier"
            ? "Welcome back! Please sign in to continue"
            : step === "password"
              ? "Enter your password to continue"
              : step === "forgot-password"
                ? "Enter your email and we'll send you a reset code"
                : step === "reset-password"
                  ? `Enter the code sent to ${emailAddress} and choose a new password`
                  : `Enter the code sent to ${emailAddress}`;

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#04050a] px-4 py-10">
            <div className="w-full max-w-[400px] overflow-hidden rounded-xl border border-[#e3e4e8] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.22)]">
                <div className="space-y-5 px-7 pb-6 pt-7">
                    <header className="space-y-1 text-center">
                        <h1 className="text-xl font-semibold tracking-tight text-[#1f2026]">{title}</h1>
                        <p className="text-sm text-[#6e717a]">{subtitle}</p>
                    </header>

                    {step === "identifier" && (
                        <form onSubmit={handleIdentifierSubmit} className="space-y-4">
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
                            <button type="submit" disabled={!canSubmit} className={buttonClassName}>
                                Continue
                            </button>
                        </form>
                    )}

                    {step === "password" && (
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
                                <div className="flex items-center justify-between">
                                    <label className={labelClassName}>Password</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setErrorMsg("");
                                            setStep("forgot-password");
                                        }}
                                        className="text-xs text-[#6e717a] underline hover:text-[#4a4d56]"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        type={showPassword ? "text" : "password"}
                                        className={inputClassName + " pr-10"}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute inset-y-0 right-0 flex items-center px-3 text-[#a0a3aa] hover:text-[#4a4d56]"
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
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

                    {step === "forgot-password" && (
                        <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
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
                            <button type="submit" disabled={!canSubmit} className={buttonClassName}>
                                {isSubmitting ? "Sending..." : "Send reset code"}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setErrorMsg("");
                                    setStep("password");
                                }}
                                className="w-full text-xs text-[#6e717a] underline hover:text-[#4a4d56]"
                            >
                                Back to sign in
                            </button>
                        </form>
                    )}

                    {step === "reset-password" && (
                        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                            {resetSent && (
                                <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-center text-xs text-green-700">
                                    Reset code sent! Check your inbox.
                                </p>
                            )}
                            <div className="space-y-1.5">
                                <label className={labelClassName}>Reset code</label>
                                <input
                                    value={resetCode}
                                    onChange={(e) => setResetCode(e.target.value)}
                                    type="text"
                                    inputMode="numeric"
                                    className={inputClassName}
                                    placeholder="6-digit code"
                                    autoComplete="one-time-code"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClassName}>New password</label>
                                <div className="relative">
                                    <input
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        type={showNewPassword ? "text" : "password"}
                                        className={inputClassName + " pr-10"}
                                        placeholder="At least 8 characters"
                                        autoComplete="new-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword((v) => !v)}
                                        className="absolute inset-y-0 right-0 flex items-center px-3 text-[#a0a3aa] hover:text-[#4a4d56]"
                                        tabIndex={-1}
                                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                                    >
                                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className={labelClassName}>Confirm new password</label>
                                <input
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    type="password"
                                    className={
                                        inputClassName +
                                        (confirmPassword && confirmPassword !== newPassword
                                            ? " border-red-400 focus:border-red-400 focus:ring-red-100"
                                            : "")
                                    }
                                    placeholder="Re-enter new password"
                                    autoComplete="new-password"
                                    required
                                />
                                {confirmPassword && confirmPassword !== newPassword && (
                                    <p className="text-xs text-red-500">Passwords do not match</p>
                                )}
                            </div>
                            <button type="submit" disabled={!canSubmit} className={buttonClassName}>
                                {isSubmitting ? "Resetting..." : "Reset password"}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setErrorMsg("");
                                    setStep("forgot-password");
                                    setResetSent(false);
                                }}
                                className="w-full text-xs text-[#6e717a] underline hover:text-[#4a4d56]"
                            >
                                Resend code
                            </button>
                        </form>
                    )}

                    {step === "code" && (
                        <form onSubmit={handleCodeSubmit} className="space-y-4">
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
                                onClick={() => {
                                    setStep("password");
                                    setCode("");
                                }}
                                className="w-full text-xs text-[#6e717a] underline hover:text-[#4a4d56]"
                            >
                                Back to sign in
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
                    Don&apos;t have an account?{" "}
                    <Link href="/sign-up" className="font-medium text-[#1f2026] hover:underline">
                        Sign up
                    </Link>
                </div>
                <div className="border-t border-[#ececef] bg-[#f7f7f8] px-7 py-2 text-center text-[11px] text-[#8b8e96]">
                    Secured by Clerk
                </div>
            </div>
        </div>
    );
}
