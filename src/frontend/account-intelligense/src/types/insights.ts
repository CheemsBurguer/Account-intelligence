export type InsightCardDTO = {
  id: number;
  title: string;
  severity: "high" | "medium" | "low" | "critical";
  description: string;
};