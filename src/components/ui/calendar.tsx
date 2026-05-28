"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={enUS}
      showOutsideDays={showOutsideDays}
      navLayout="around"
      className={cn("rdp-root", className)}
      classNames={{
        months: "flex flex-col gap-2",
        month: "relative flex w-full flex-col gap-3",
        month_caption: "relative h-9 w-full !m-0",
        caption_label:
          "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100",
        button_previous:
          "absolute left-0 top-0 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800",
        button_next:
          "absolute right-0 top-0 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 text-[0.75rem] font-normal text-gray-500 dark:text-gray-400 text-center",
        week: "flex w-full mt-1",
        day: "relative h-9 w-9 p-0 text-center text-sm",
        day_button:
          "inline-flex h-9 w-9 items-center justify-center rounded-lg font-normal text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 aria-selected:opacity-100",
        selected:
          "[&>button]:bg-primary [&>button]:text-white [&>button]:hover:bg-primary [&>button]:hover:text-white",
        today: "[&>button]:font-semibold [&>button]:text-primary",
        outside: "[&>button]:text-gray-400 dark:[&>button]:text-gray-600",
        disabled: "[&>button]:text-gray-300 dark:[&>button]:text-gray-700",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return (
            <Icon className={cn("h-4 w-4", chevronClassName)} {...chevronProps} />
          );
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
