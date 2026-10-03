"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function toDisplayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function toIsoDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, dayValue, monthValue, yearValue] = match;
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  return `${yearValue}-${monthValue}-${dayValue}`;
}

interface DateFilterInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DateFilterInput({
  id,
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
}: DateFilterInputProps) {
  const calendarInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => ({
    source: value,
    display: toDisplayDate(value),
  }));
  const displayValue = draft.source === value ? draft.display : toDisplayDate(value);

  function openCalendar() {
    const input = calendarInput.current;
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else input.click();
  }

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={displayValue}
        aria-label={`${id} in day/month/year format`}
        onChange={(event) => {
          const nextValue = event.target.value;
          const isoDate = nextValue === "" ? "" : toIsoDate(nextValue) ?? "";
          setDraft({ source: isoDate, display: nextValue });
          onChange(isoDate);
        }}
        onBlur={() => {
          if (displayValue.trim() !== "" && !toIsoDate(displayValue)) {
            setDraft({ source: value, display: toDisplayDate(value) });
          }
        }}
        className="pr-11"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Open date calendar"
        className="absolute right-1 top-1/2 -translate-y-1/2"
        onClick={openCalendar}
      >
        <CalendarDays className="size-4" />
      </Button>
      <input
        ref={calendarInput}
        type="date"
        value={value}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
      />
    </div>
  );
}
