import * as React from "react";
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModernDobPickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  age: number | null;
  isUnder18: boolean;
  className?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function ModernDobPicker({
  value,
  onChange,
  age,
  isUnder18,
  className,
}: ModernDobPickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse existing value or initialize to default adult/young adult year (e.g. 2004)
  const currentYear = new Date().getFullYear();
  const parsed = React.useMemo(() => {
    if (!value) return null;
    const parts = value.split("-");
    const y = parts[0] ? parseInt(parts[0], 10) : null;
    const m = parts[1] ? parseInt(parts[1], 10) - 1 : null;
    const d = parts[2] ? parseInt(parts[2], 10) : null;
    if (y && m !== null && d) {
      return { year: y, month: m, day: d };
    }
    return null;
  }, [value]);

  // Working state when interacting with the picker
  const [viewYear, setViewYear] = React.useState<number>(parsed?.year || 2005);
  const [viewMonth, setViewMonth] = React.useState<number>(parsed?.month ?? 5); // June default
  const [selectedDay, setSelectedDay] = React.useState<number | null>(parsed?.day || null);

  // Sync if parsed changes externally
  React.useEffect(() => {
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
      setSelectedDay(parsed.day);
    }
  }, [parsed]);

  // Days in selected month/year
  const daysInMonth = React.useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  // First day of month (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = React.useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay();
  }, [viewYear, viewMonth]);

  // List of selectable years: currentYear down to 1930
  const yearOptions = React.useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= 1930; y--) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  const handleDayClick = (d: number) => {
    setSelectedDay(d);
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const isoString = `${viewYear}-${mm}-${dd}`;
    onChange(isoString);
    setOpen(false);
  };

  // Formatted date for trigger display
  const formattedDisplay = React.useMemo(() => {
    if (!parsed) return null;
    const dateObj = new Date(parsed.year, parsed.month, parsed.day);
    if (isNaN(dateObj.getTime())) return null;
    return dateObj.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [parsed]);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id="dob-trigger"
            aria-label="Select Date of Birth"
            className={cn(
              "flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3.5 py-2 text-sm shadow-sm transition-colors hover:bg-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
              !formattedDisplay && "text-muted-foreground",
            )}
          >
            <span className="flex items-center gap-2.5 truncate">
              <CalendarIcon className="size-4 shrink-0 text-primary" />
              <span className={formattedDisplay ? "font-medium text-foreground" : "text-muted-foreground"}>
                {formattedDisplay || "Select your Date of Birth"}
              </span>
            </span>

            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-aria-expanded:rotate-180" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[320px] p-4 rounded-2xl border border-border bg-card shadow-2xl space-y-3 z-50"
          align="start"
          sideOffset={6}
        >
          {/* Month & Year Selectors */}
          <div className="grid grid-cols-2 gap-2">
            {/* Month Select */}
            <div className="relative">
              <select
                aria-label="Select birth month"
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
                className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-7"
              >
                {MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>

            {/* Year Select */}
            <div className="relative">
              <select
                aria-label="Select birth year"
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
                className="w-full appearance-none rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-7"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Month navigation arrows */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else {
                  setViewMonth((m) => m - 1);
                }
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-bold text-foreground">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              disabled={viewYear === currentYear && viewMonth >= new Date().getMonth()}
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else {
                  setViewMonth((m) => m + 1);
                }
              }}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS_OF_WEEK.map((d) => (
              <span key={d} className="text-[11px] font-bold text-muted-foreground py-0.5">
                {d}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty slots before day 1 */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8 w-8" />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const isSelected =
                parsed?.year === viewYear &&
                parsed?.month === viewMonth &&
                selectedDay === dayNum;

              // Check if future date
              const isFuture =
                viewYear === currentYear &&
                (viewMonth > new Date().getMonth() ||
                  (viewMonth === new Date().getMonth() && dayNum > new Date().getDate()));

              return (
                <button
                  key={dayNum}
                  type="button"
                  disabled={isFuture}
                  onClick={() => handleDayClick(dayNum)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-all",
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold shadow-sm"
                      : "text-foreground hover:bg-muted/80 hover:font-semibold",
                    isFuture && "opacity-20 pointer-events-none",
                  )}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* Footer with status */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {parsed ? `Selected: ${MONTHS[parsed.month]} ${parsed.day}, ${parsed.year}` : "Click any day to confirm"}
            </span>
            {parsed && (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-primary font-bold hover:underline"
              >
                Done
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
