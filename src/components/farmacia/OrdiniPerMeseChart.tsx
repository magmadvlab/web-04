"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";

interface OrdiniPerMeseChartProps {
  ordini: any[];
}

export function OrdiniPerMeseChart({ ordini }: OrdiniPerMeseChartProps) {
  // Calcola ordini per mese (ultimi 6 mesi)
  const now = new Date();
  const mesi: Array<{ month: string; monthFull: string; count: number; totale: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const data = new Date(now.getFullYear(), now.getMonth() - i, 1);
    mesi.push({
      month: data.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
      monthFull: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`,
      count: 0,
      totale: 0,
    });
  }

  // Conta ordini e calcola totale per mese
  ordini?.forEach((ordine) => {
    const dataCreazione = new Date(ordine.dataCreazione);
    const monthKey = `${dataCreazione.getFullYear()}-${String(dataCreazione.getMonth() + 1).padStart(2, "0")}`;
    const mese = mesi.find((m) => m.monthFull === monthKey);
    if (mese) {
      mese.count++;
      mese.totale += Number(ordine.totale || ordine.importoTotale || 0);
    }
  });

  const chartConfig = {
    ordini: {
      label: "Ordini",
      color: "hsl(24.6, 95%, 53.1%)",
    },
    fatturato: {
      label: "Fatturato (€)",
      color: "hsl(142.1, 76.2%, 36.3%)",
    },
  };

  if (ordini.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Ordini Ultimi 6 Mesi
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
          <TrendingUp className="h-4 w-4" />
          Andamento Ordini (Ultimi 6 Mesi)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <LineChart data={mesi}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="hsl(24.6, 95%, 53.1%)"
              strokeWidth={2}
              dot={{ fill: "hsl(24.6, 95%, 53.1%)", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
        <div className="flex items-center justify-between text-xs text-gray-600 pt-4 border-t mt-4">
          <div>
            <span className="font-medium">Totale ordini: </span>
            <span>{mesi.reduce((sum, item) => sum + item.count, 0)}</span>
          </div>
          <div>
            <span className="font-medium">Fatturato totale: </span>
            <span>€{Number(mesi.reduce((sum, item) => sum + Number(item.totale || 0), 0)).toFixed(2)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}













