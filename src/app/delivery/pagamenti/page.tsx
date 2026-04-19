'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Download, Euro, TrendingUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReportPagamenti {
  farmaciaId: number;
  farmaciaNome: string;
  totaleConsegne: number;
  totaleIncassato: number;
  pagamentiOk: number;
  pagamentiFalliti: number;
  dettaglioTransazioni: Array<{
    ordineId: number;
    pazienteNome: string;
    importo: number;
    metodoPagamento: string;
    riferimentoTransazione: string;
    dataPagamento: Date;
  }>;
}

interface Farmacia {
  id: number;
  nome: string;
}

export default function PagamentiDeliveryPage() {
  const [farmacie, setFarmacie] = useState<Farmacia[]>([]);
  const [farmaciaSelezionata, setFarmaciaSelezionata] = useState<number | null>(null);
  const [report, setReport] = useState<ReportPagamenti | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataInizio, setDataInizio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFine, setDataFine] = useState(new Date().toISOString().split('T')[0]);
  const { toast } = useToast();

  useEffect(() => {
    fetchFarmacie();
  }, []);

  const fetchFarmacie = async () => {
    try {
      const response = await fetch('/api/farmacie', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Errore nel caricamento farmacie');

      const data = await response.json();
      setFarmacie(data);
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile caricare le farmacie',
        variant: 'destructive',
      });
    }
  };

  const fetchReport = async () => {
    if (!farmaciaSelezionata) {
      toast({
        title: 'Attenzione',
        description: 'Seleziona una farmacia',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        dataInizio,
        dataFine,
      });

      const response = await fetch(
        `/api/delivery/pos/report-farmacia/${farmaciaSelezionata}?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Errore nel caricamento report');

      const data = await response.json();
      setReport(data);
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile caricare il report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const esportaCSV = () => {
    if (!report) return;

    const csv = [
      ['Ordine ID', 'Paziente', 'Importo', 'Metodo Pagamento', 'Riferimento', 'Data'].join(','),
      ...report.dettaglioTransazioni.map(t =>
        [
          t.ordineId,
          `"${t.pazienteNome}"`,
          Number(t.importo || 0).toFixed(2),
          t.metodoPagamento,
          t.riferimentoTransazione,
          new Date(t.dataPagamento).toLocaleString('it-IT'),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-pagamenti-${report.farmaciaNome}-${dataInizio}.csv`;
    a.click();
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Report Pagamenti Batch</h1>
        <p className="text-muted-foreground">
          Monitora i pagamenti delle consegne batch per farmacia
        </p>
      </div>

      {/* Filtri */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filtri Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="farmacia">Farmacia</Label>
              <Select
                value={farmaciaSelezionata?.toString()}
                onValueChange={(value) => setFarmaciaSelezionata(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona farmacia" />
                </SelectTrigger>
                <SelectContent>
                  {farmacie.map((f) => (
                    <SelectItem key={f.id} value={f.id.toString()}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataInizio">Data Inizio</Label>
              <Input
                id="dataInizio"
                type="date"
                value={dataInizio}
                onChange={(e) => setDataInizio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataFine">Data Fine</Label>
              <Input
                id="dataFine"
                type="date"
                value={dataFine}
                onChange={(e) => setDataFine(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={fetchReport} disabled={loading} className="w-full">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Genera Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiche */}
      {report && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Totale Consegne
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span className="text-2xl font-bold">{report.totaleConsegne}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pagamenti OK
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">
                    {report.pagamentiOk}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pagamenti Falliti
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-2xl font-bold text-red-600">
                    {report.pagamentiFalliti}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Totale Incassato
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Euro className="h-5 w-5 text-purple-600" />
                  <span className="text-2xl font-bold text-purple-600">
                    €{Number(report.totaleIncassato || 0).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dettaglio Transazioni */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Dettaglio Transazioni - {report.farmaciaNome}</CardTitle>
                <Button onClick={esportaCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Esporta CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {report.dettaglioTransazioni.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nessuna transazione nel periodo selezionato
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3">Ordine</th>
                        <th className="text-left p-3">Paziente</th>
                        <th className="text-right p-3">Importo</th>
                        <th className="text-left p-3">Metodo</th>
                        <th className="text-left p-3">Riferimento</th>
                        <th className="text-left p-3">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.dettaglioTransazioni.map((transazione, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <Badge variant="outline">#{transazione.ordineId}</Badge>
                          </td>
                          <td className="p-3">{transazione.pazienteNome}</td>
                          <td className="p-3 text-right font-semibold">
                            €{Number(transazione.importo || 0).toFixed(2)}
                          </td>
                          <td className="p-3">
                            <Badge>{transazione.metodoPagamento}</Badge>
                          </td>
                          <td className="p-3 font-mono text-sm">
                            {transazione.riferimentoTransazione || '-'}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {new Date(transazione.dataPagamento).toLocaleString('it-IT')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!report && !loading && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Seleziona una farmacia e un periodo per visualizzare il report
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
