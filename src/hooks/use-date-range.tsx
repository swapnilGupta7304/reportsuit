import { createContext, useContext, useState, type ReactNode } from "react";

export type DatePreset = "7d" | "30d" | "this_month" | "last_month" | "custom";

export interface DateRange {
  preset: DatePreset;
  from: Date;
  to: Date;
}

function computeRange(preset: DatePreset, custom?: { from: Date; to: Date }): DateRange {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "7d") {
    const from = new Date(end); from.setDate(end.getDate() - 6);
    return { preset, from, to: end };
  }
  if (preset === "30d") {
    const from = new Date(end); from.setDate(end.getDate() - 29);
    return { preset, from, to: end };
  }
  if (preset === "this_month") {
    return { preset, from: new Date(now.getFullYear(), now.getMonth(), 1), to: end };
  }
  if (preset === "last_month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { preset, from, to };
  }
  return { preset: "custom", from: custom!.from, to: custom!.to };
}

interface Ctx {
  range: DateRange;
  setPreset: (p: DatePreset) => void;
  setCustom: (from: Date, to: Date) => void;
}

const C = createContext<Ctx>({} as Ctx);

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRange>(computeRange("30d"));
  return (
    <C.Provider value={{
      range,
      setPreset: (p) => p !== "custom" && setRange(computeRange(p)),
      setCustom: (from, to) => setRange({ preset: "custom", from, to }),
    }}>
      {children}
    </C.Provider>
  );
}

export const useDateRange = () => useContext(C);
