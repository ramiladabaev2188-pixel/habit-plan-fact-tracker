"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

type ChartPoint = {
  date: string;
  label: string;
  plan: number;
  fact: number;
};

const LazyPlanFactChart = dynamic(
  () => import("@/components/charts/plan-fact-chart").then((module) => module.PlanFactChart),
  {
    loading: () => <Skeleton className="h-72 w-full rounded-md" />
  }
);

const LazyCumulativePlanFactChart = dynamic(
  () => import("@/components/charts/plan-fact-chart").then((module) => module.CumulativePlanFactChart),
  {
    loading: () => <Skeleton className="h-72 w-full rounded-md" />
  }
);

export function DashboardPlanFactChart({ data }: { data: ChartPoint[] }) {
  return <LazyPlanFactChart data={data} />;
}

export function DashboardCumulativePlanFactChart({ data }: { data: ChartPoint[] }) {
  return <LazyCumulativePlanFactChart data={data} />;
}
