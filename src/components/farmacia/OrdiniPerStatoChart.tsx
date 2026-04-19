"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ShoppingCart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts";

interface OrdiniPerStatoChartProps {
  ordini: any[];
}

const STATO_LABELS: Record<string, string> = {
  creato: "Creati",
  in_preparazione: "In Preparazione",
  pronto: "Pronti",
  in_consegna: "In Consegna",
  consegnato: "Consegnati",
  annullato: "Annullati",
};

const STATO_COLORS: Record<string, string> = {
  creato: "hsl(24.6, 95%, 53.1%)",
  in_preparazione: "hsl(38.7, 92%, 50%)",
  pronto: "hsl(47.9, 95.8%, 53.1%)",
  in_consegna: "hsl(221.2, 83.2%, 53.3%)",
  consegnato: "hsl(142.1, 76.2%, 36.3%)",
  annullato: "hsl(0, 84.2%, 60.2%)",
};

export function OrdiniPerStatoChart({ ordini }: OrdiniPerStatoChartProps) {
  // Calcola ordini per stato
  const statoCounts: Record<string, number> = {};
  
  ordini?.forEach((ordine) => {
    const stato = ordine.stato || "sconosciuto";
    statoCounts[stato] = (statoCounts[stato] || 0) + 1;
  });

  const chartData = Object.entries(statoCounts)
    .map(([stato, count]) => ({
      stato,
      label: STATO_LABELS[stato] || stato,
      value: count,
      color: STATO_COLORS[stato] || "hsl(0, 0%, 45.1%)",
    }))
    .sort((a, b) => b.value - a.value); // Ordina per valore decrescente

  const chartConfig = chartData.reduce((acc, item) => {
    acc[item.stato] = {
      label: item.label,
      color: item.color,
    };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  if (ordini.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Ordini per Stato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 text-center py-8">
            Nessun dato disponibile
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          Distribuzione Ordini per Stato
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t mt-4">
          {chartData.map((item) => (
            <div key={item.stato} className="text-center">
              <div className="text-2xl font-bold" style={{ color: item.color }}>
                {item.value}
              </div>
              <div className="text-xs text-gray-600">{item.label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

