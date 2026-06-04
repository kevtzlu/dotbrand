"use client";

import { useState } from "react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseDateString, toDateString } from "@/lib/date";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DatePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Always use dark panel styling (e.g. bid dates modal). */
  variant?: "default" | "dark";
}

export function DatePickerField({
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  className,
  variant = "default",
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateString(value);
  const isDark = variant === "dark";

  const display = selected
    ? format(selected, "MMM d, yyyy", { locale: enUS })
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between gap-2 px-3 py-2 rounded-xl border text-sm transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isDark
              ? "border-gray-700 bg-[#09090b] text-gray-100 hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-[#09090b] dark:text-gray-100 dark:hover:border-gray-600",
            className
          )}
        >
          <span className={cn("truncate", value ? "" : "text-gray-500")}>
            {display}
          </span>
          <CalendarDays
            className={cn("h-4 w-4 shrink-0", isDark ? "text-gray-500" : "text-gray-400")}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-auto p-2",
          isDark && "border-gray-700 bg-[#18181b]"
        )}
      >
        <Calendar
          theme={isDark ? "dark" : "light"}
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (date) {
              onChange(toDateString(date));
              setOpen(false);
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
