"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

const STEPS = [
  {
    image: "/onboarding/ESTIMAIT_Tutorial01_Uploading project files.gif",
    text: "Uploading project files to start the estimation",
  },
  {
    image: "/onboarding/ESTIMAIT_Tutorial02_Adjust the info.gif",
    text: "Adjust the information for a better result",
  },
  {
    image: "/onboarding/ESTIMAIT_Tutorial03_Provide project details.gif",
    text: "Provide the project details to the AI",
  },
  {
    image: "/onboarding/ESTIMAIT_Tutorial04_Proceed to Detail.gif",
    text: "Proceed to Detail",
  },
  {
    image: "/onboarding/ESTIMAIT_Tutorial05_Select the best option.gif",
    text: "Select the best option based on Monte Carlo outcome analysis",
  },
  {
    image: "/onboarding/ESTIMAIT_Tutorial06_Adjust the numbers.gif",
    text: "Adjust the numbers for a better result",
  },
  {
    image: "/onboarding/ESTIMAIT_Tutorial07_Download Excel.gif",
    text: "Download the estimate in Excel format",
  },
  {
    image: "/onboarding/ESTIMAIT_Tutorial08_Train your knowledge.gif",
    text: "Train your knowledge base with past projects",
  },
];

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingModal({ open, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Image */}
        <div className="relative w-full bg-gray-100 dark:bg-gray-800" style={{ height: "480px" }}>
          <Image
            src={current.image}
            alt={`Step ${step + 1}`}
            fill
            className="object-contain"
            priority
            unoptimized
          />
        </div>

        {/* Content */}
        <div className="px-8 pt-6 pb-7">
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
              />
            ))}
          </div>

          {/* Text */}
          <p className="text-center text-base font-medium text-gray-800 dark:text-gray-100 min-h-[3rem] flex items-center justify-center">
            {current.text}
          </p>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={isFirst}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-0 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <span className="text-xs text-gray-400 dark:text-gray-500">
              {step + 1} / {STEPS.length}
            </span>

            {isLast ? (
              <button
                onClick={onClose}
                className="px-5 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Get Started
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
