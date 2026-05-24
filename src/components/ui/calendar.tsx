import * as React from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CalendarProps {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  className?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function Calendar({ selected, onSelect, disabled, className }: CalendarProps) {
  const [viewMonth, setViewMonth] = React.useState<Date>(
    selected ?? new Date(),
  );

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(viewMonth));
    const end = endOfWeek(endOfMonth(viewMonth));
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  return (
    <div className={cn("p-3 select-none", className)}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(viewMonth, "MMMM yyyy")}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[0.8rem] text-muted-foreground font-normal py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, viewMonth);
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isDisabled = disabled ? disabled(day) : false;
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={isDisabled || !isCurrentMonth}
              onClick={() => {
                if (!isDisabled && isCurrentMonth) {
                  onSelect?.(isSelected ? undefined : day);
                }
              }}
              className={cn(
                "h-8 w-8 mx-auto flex items-center justify-center rounded-md text-sm transition-colors",
                !isCurrentMonth && "invisible",
                isCurrentMonth &&
                  !isSelected &&
                  !isDisabled &&
                  "hover:bg-accent hover:text-accent-foreground",
                isToday && !isSelected && "bg-accent text-accent-foreground",
                isSelected &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                isDisabled && "text-muted-foreground opacity-50 cursor-not-allowed",
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
export type { CalendarProps };
