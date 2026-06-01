"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { addYears, endOfYear, startOfYear } from "date-fns";
import { enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/** Default range for month/year dropdowns (±30 years from today). */
const calendarStartMonth = startOfYear(addYears(new Date(), -30));
const calendarEndMonth = endOfYear(addYears(new Date(), 30));

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  navLayout = "around",
  startMonth = calendarStartMonth,
  endMonth = calendarEndMonth,
  reverseYears = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={enUS}
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      navLayout={navLayout}
      startMonth={startMonth}
      endMonth={endMonth}
      reverseYears={reverseYears}
      className={cn("rdp-root", className)}
      classNames={{
        months: "flex flex-col gap-2",
        month: "relative flex w-full flex-col gap-3",
        month_caption: "relative flex h-9 w-full items-center justify-center !m-0",
        dropdowns: "relative z-20 flex items-center gap-1",
        dropdown_root: "relative inline-flex items-center",
        dropdown: "absolute inset-0 z-30 h-full w-full cursor-pointer opacity-0",
        caption_label:
          "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-sm font-medium text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800",
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
          if (orientation === "down") {
            return (
              <ChevronDown
                className={cn("h-3.5 w-3.5 text-gray-500 dark:text-gray-400", chevronClassName)}
                {...chevronProps}
              />
            );
          }
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
