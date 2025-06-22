export function toJSDate(value: Date | { toDate: () => Date } | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate();
  }
  throw new Error("Value is not a Date or Timestamp");
}
