"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, CreditCard, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PosTerminal {
  id: string;
  label: string;
  provider?: string;
  enabled?: boolean;
}

interface RiderMultiPosConfig {
  terminals: PosTerminal[];
  defaultTerminalByFarmacia: Record<string, string>;
  updatedAt?: string;
}

interface BatchNotifica {
  farmaciaId: number;
  farmacia?: {
    id: number;
    nome: string;
  };
}

interface BatchRitiriData {
  notifiche: BatchNotifica[];
}

interface ApiOkResponse<T> {
  success?: boolean;
  data?: T;
}

const BATCH_ENABLED_RIDER_STATI = new Set(["attivo", "disponibile", "in_consegna"]);

const emptyConfig: RiderMultiPosConfig = {
  terminals: [],
  defaultTerminalByFarmacia: {},
  updatedAt: undefined,
};

const normalizeConfig = (raw: unknown): RiderMultiPosConfig => {
  const payload = (raw as any)?.data ?? raw ?? {};
  const terminalsRaw = Array.isArray((payload as any).terminals)
    ? (payload as any).terminals
    : [];

  return {
    terminals: terminalsRaw
      .map((item: any) => ({
        id: String(item?.id || "").trim(),
        label: String(item?.label || "").trim(),
        provider: item?.provider ? String(item.provider).trim() : undefined,
        enabled: item?.enabled !== false,
      }))
      .filter((item: PosTerminal) => item.id.length > 0 && item.label.length > 0),
    defaultTerminalByFarmacia:
      typeof (payload as any).defaultTerminalByFarmacia === "object" &&
      (payload as any).defaultTerminalByFarmacia !== null
        ? Object.entries((payload as any).defaultTerminalByFarmacia).reduce<
            Record<string, string>
          >((acc, [farmaciaId, terminalId]) => {
            if (farmaciaId && terminalId) {
              acc[String(farmaciaId)] = String(terminalId);
            }
            return acc;
          }, {})
        : {},
    updatedAt:
      typeof (payload as any).updatedAt === "string"
        ? (payload as any).updatedAt
        : undefined,
  };
};

export default function DeliveryPosPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<RiderMultiPosConfig>(emptyConfig);
  const [batchData, setBatchData] = useState<BatchRitiriData>({ notifiche: [] });
  const [riderStatus, setRiderStatus] = useState<string>("");
  const [newTerminal, setNewTerminal] = useState({
    id: "",
    label: "",
    provider: "",
  });

  const farmacieConBatch = useMemo(() => {
    const map = new Map<number, { id: number; nome: string }>();
    for (const notifica of batchData.notifiche || []) {
      const farmaciaId = Number(notifica.farmaciaId || notifica.farmacia?.id);
      if (!Number.isFinite(farmaciaId) || farmaciaId <= 0) {
        continue;
      }
      const nome = notifica.farmacia?.nome || `Farmacia #${farmaciaId}`;
      map.set(farmaciaId, { id: farmaciaId, nome });
    }
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [batchData]);

  const activeTerminals = useMemo(
    () => config.terminals.filter((terminal) => terminal.enabled !== false),
    [config.terminals]
  );
  const batchDisabledByRiderStatus =
    riderStatus !== "" && !BATCH_ENABLED_RIDER_STATI.has(riderStatus);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileResponse, multiPosResponse] = await Promise.all([
        api.get<ApiOkResponse<{ stato?: string }>>("/delivery/rider/profile"),
        api.get<ApiOkResponse<RiderMultiPosConfig>>("/delivery/rider/multipos"),
      ]);
      const riderRawStatus = String((profileResponse.data as any)?.data?.stato || "")
        .trim()
        .toLowerCase();
      setRiderStatus(riderRawStatus);

      let ritiriData: BatchRitiriData = { notifiche: [] };
      const canLoadBatch =
        riderRawStatus === "" || BATCH_ENABLED_RIDER_STATI.has(riderRawStatus);
      if (canLoadBatch) {
        const ritiriResponse = await api.get<BatchRitiriData>("/delivery/batch/ritiri/ordini-pronti");
        ritiriData = ritiriResponse.data || { notifiche: [] };
      }

      setConfig(normalizeConfig(multiPosResponse.data));
      setBatchData(ritiriData);
    } catch (error: any) {
      const message = String(error?.response?.data?.message || "").toLowerCase();
      if (message.includes("rider non attivo")) {
        setBatchData({ notifiche: [] });
        return;
      }

      toast({
        title: "Errore caricamento",
        description:
          error?.response?.data?.message ||
          "Impossibile caricare configurazione POS e ritiri batch",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const persistConfig = async (nextConfig: RiderMultiPosConfig) => {
    try {
      setSaving(true);
      const response = await api.put<ApiOkResponse<RiderMultiPosConfig>>(
        "/delivery/rider/multipos",
        {
          terminals: nextConfig.terminals,
          defaultTerminalByFarmacia: nextConfig.defaultTerminalByFarmacia,
        }
      );

      setConfig(normalizeConfig(response.data));
      toast({
        title: "Configurazione salvata",
        description: "Impostazioni POS aggiornate con successo",
      });
    } catch (error: any) {
      toast({
        title: "Errore salvataggio",
        description:
          error?.response?.data?.message ||
          "Impossibile salvare la configurazione POS",
        variant: "destructive",
      });
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const addTerminal = async () => {
    const id = newTerminal.id.trim();
    const label = newTerminal.label.trim();
    const provider = newTerminal.provider.trim();

    if (!id || !label) {
      toast({
        title: "Dati mancanti",
        description: "Inserisci ID e nome del terminale",
        variant: "destructive",
      });
      return;
    }

    const exists = config.terminals.some(
      (terminal) => terminal.id.toLowerCase() === id.toLowerCase()
    );

    if (exists) {
      toast({
        title: "Terminale duplicato",
        description: "Esiste gia un terminale con questo ID",
        variant: "destructive",
      });
      return;
    }

    const nextConfig: RiderMultiPosConfig = {
      ...config,
      terminals: [
        ...config.terminals,
        {
          id,
          label,
          provider: provider || undefined,
          enabled: true,
        },
      ],
    };

    await persistConfig(nextConfig);
    setNewTerminal({ id: "", label: "", provider: "" });
  };

  const toggleTerminal = async (terminalId: string) => {
    const nextTerminals = config.terminals.map((terminal) =>
      terminal.id === terminalId
        ? { ...terminal, enabled: terminal.enabled === false }
        : terminal
    );

    const nextDefaults = Object.entries(config.defaultTerminalByFarmacia).reduce<
      Record<string, string>
    >((acc, [farmaciaId, selectedTerminalId]) => {
      const selectedTerminal = nextTerminals.find((t) => t.id === selectedTerminalId);
      if (selectedTerminal && selectedTerminal.enabled !== false) {
        acc[farmaciaId] = selectedTerminalId;
      }
      return acc;
    }, {});

    await persistConfig({
      ...config,
      terminals: nextTerminals,
      defaultTerminalByFarmacia: nextDefaults,
    });
  };

  const removeTerminal = async (terminalId: string) => {
    const nextTerminals = config.terminals.filter(
      (terminal) => terminal.id !== terminalId
    );

    const nextDefaults = Object.entries(config.defaultTerminalByFarmacia).reduce<
      Record<string, string>
    >((acc, [farmaciaId, selectedTerminalId]) => {
      if (selectedTerminalId !== terminalId) {
        acc[farmaciaId] = selectedTerminalId;
      }
      return acc;
    }, {});

    await persistConfig({
      ...config,
      terminals: nextTerminals,
      defaultTerminalByFarmacia: nextDefaults,
    });
  };

  const changeDefaultTerminal = async (farmaciaId: number, terminalId: string) => {
    const nextConfig: RiderMultiPosConfig = {
      ...config,
      defaultTerminalByFarmacia: {
        ...config.defaultTerminalByFarmacia,
        [String(farmaciaId)]: terminalId,
      },
    };

    await persistConfig(nextConfig);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Gestione POS Rider</h1>
          <p className="text-muted-foreground mt-1">
            Configura i terminali POS da usare nei ritiri batch multi-farmacia
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={saving}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Aggiorna
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Terminali POS Disponibili
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="terminal-id">ID terminale</Label>
              <Input
                id="terminal-id"
                value={newTerminal.id}
                onChange={(event) =>
                  setNewTerminal((prev) => ({ ...prev, id: event.target.value }))
                }
                placeholder="es. POS-BLU-01"
              />
            </div>
            <div>
              <Label htmlFor="terminal-label">Nome terminale</Label>
              <Input
                id="terminal-label"
                value={newTerminal.label}
                onChange={(event) =>
                  setNewTerminal((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="es. POS Blu"
              />
            </div>
            <div>
              <Label htmlFor="terminal-provider">Provider (opzionale)</Label>
              <Input
                id="terminal-provider"
                value={newTerminal.provider}
                onChange={(event) =>
                  setNewTerminal((prev) => ({ ...prev, provider: event.target.value }))
                }
                placeholder="es. Nexi"
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void addTerminal()}
            disabled={saving || !newTerminal.id.trim() || !newTerminal.label.trim()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Aggiungi terminale
          </Button>

          <div className="space-y-3">
            {config.terminals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessun terminale configurato. Aggiungi almeno un POS.
              </p>
            ) : (
              config.terminals.map((terminal) => (
                <div
                  key={terminal.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{terminal.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {terminal.id}
                      {terminal.provider ? ` | ${terminal.provider}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={terminal.enabled === false ? "secondary" : "default"}
                    >
                      {terminal.enabled === false ? "Disattivo" : "Attivo"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void toggleTerminal(terminal.id)}
                      disabled={saving}
                    >
                      {terminal.enabled === false ? "Riattiva" : "Disattiva"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void removeTerminal(terminal.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>POS predefinito per farmacia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {batchDisabledByRiderStatus ? (
            <p className="text-sm text-muted-foreground">
              Ritiri batch non disponibili con stato rider "{riderStatus.replace(/_/g, " ")}".
            </p>
          ) : farmacieConBatch.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna farmacia con ordini batch pronti in questo momento.
            </p>
          ) : (
            farmacieConBatch.map((farmacia) => (
              <div
                key={farmacia.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{farmacia.nome}</p>
                  <p className="text-xs text-muted-foreground">ID: {farmacia.id}</p>
                </div>
                <div className="w-full md:w-72">
                  <Select
                    value={config.defaultTerminalByFarmacia[String(farmacia.id)] || ""}
                    onValueChange={(value) =>
                      void changeDefaultTerminal(farmacia.id, value)
                    }
                    disabled={saving || activeTerminals.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona POS predefinito" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTerminals.map((terminal) => (
                        <SelectItem key={terminal.id} value={terminal.id}>
                          {terminal.label}
                          {terminal.provider ? ` (${terminal.provider})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
