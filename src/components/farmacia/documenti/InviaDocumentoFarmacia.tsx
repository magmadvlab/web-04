'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Plus, X } from 'lucide-react';
import { FileUploader, UploadResult } from '@/components/shared/FileUploader';

interface InviaDocumentoFarmaciaProps {
  pazienteId: number;
  farmaciaId?: number;
  pazienteName?: string;
}

export function InviaDocumentoFarmacia({
  pazienteId,
  farmaciaId,
  pazienteName,
}: InviaDocumentoFarmaciaProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [fileData, setFileData] = useState<UploadResult | null>(null);

  const [formData, setFormData] = useState({
    tipoDocumento: 'conferma-consegna' as const,
    titolo: '',
    descrizione: '',
    medicineIds: [] as string[],
    medicineInput: '',
    dataConsegna: new Date().toISOString().split('T')[0],
    importo: '',
    metodoInvio: 'sms' as const,
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleAddMedicine = () => {
    if (formData.medicineInput.trim()) {
      setFormData({
        ...formData,
        medicineIds: [...formData.medicineIds, formData.medicineInput],
        medicineInput: '',
      });
    }
  };

  const handleRemoveMedicine = (index: number) => {
    setFormData({
      ...formData,
      medicineIds: formData.medicineIds.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const metadati: any = {};

      if (formData.medicineIds.length > 0) {
        metadati.medicineIds = formData.medicineIds;
      }

      if (formData.dataConsegna) {
        metadati.dataConsegna = formData.dataConsegna;
      }

      if (formData.importo) {
        metadati.importo = parseFloat(formData.importo);
      }

      const payload: any = {
        pazienteId,
        tipoDocumento: formData.tipoDocumento,
        titolo: formData.titolo,
        descrizione: formData.descrizione,
        metodoInvio: formData.metodoInvio,
        metadati: Object.keys(metadati).length > 0 ? metadati : undefined,
      };

      if (fileData) {
        payload.urlDocumento = fileData.url;
        payload.cloudinaryPublicId = fileData.cloudinaryPublicId;
        payload.fileDimensione = fileData.size;
        payload.fileMimeType = fileData.mimeType;
      }

      const res = await fetch('/api/farmacia/documenti/invia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Errore invio documento');
      }

      setSuccess(true);
      setFileData(null);
      setFormData({
        tipoDocumento: 'conferma-consegna',
        titolo: '',
        descrizione: '',
        medicineIds: [],
        medicineInput: '',
        dataConsegna: new Date().toISOString().split('T')[0],
        importo: '',
        metodoInvio: 'sms',
      });

      setTimeout(() => {
        router.refresh();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invia Documento al Paziente</CardTitle>
        <CardDescription>
          {pazienteName && `Paziente: ${pazienteName}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Documento inviato con successo
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* TIPO DOCUMENTO */}
          <div className="space-y-2">
            <Label htmlFor="tipoDocumento">Tipo Documento *</Label>
            <Select
              value={formData.tipoDocumento}
              onValueChange={(value) => handleInputChange('tipoDocumento', value)}
            >
              <SelectTrigger id="tipoDocumento">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conferma-consegna">Conferma Consegna</SelectItem>
                <SelectItem value="ricetta">Ricetta</SelectItem>
                <SelectItem value="consigli">Consigli Farmacologici</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* TITOLO */}
          <div className="space-y-2">
            <Label htmlFor="titolo">Titolo *</Label>
            <Input
              id="titolo"
              placeholder="Es. Consegna medicinali ordinati"
              value={formData.titolo}
              onChange={(e) => handleInputChange('titolo', e.target.value)}
              required
            />
          </div>

          {/* DESCRIZIONE */}
          <div className="space-y-2">
            <Label htmlFor="descrizione">Descrizione *</Label>
            <Textarea
              id="descrizione"
              placeholder="Dettagli della consegna o consigli"
              value={formData.descrizione}
              onChange={(e) => handleInputChange('descrizione', e.target.value)}
              required
              rows={4}
            />
          </div>

          {/* MEDICINALI */}
          <div className="space-y-2">
            <Label>Medicinali Consegnati</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Aggiungi medicinale (es. Tachipirina 500mg)"
                value={formData.medicineInput}
                onChange={(e) =>
                  handleInputChange('medicineInput', e.target.value)
                }
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddMedicine();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddMedicine}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {formData.medicineIds.length > 0 && (
              <div className="space-y-2 mt-3">
                {formData.medicineIds.map((medicine, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-slate-100 p-2 rounded"
                  >
                    <span className="text-sm">{medicine}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMedicine(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DATA CONSEGNA */}
          <div className="space-y-2">
            <Label htmlFor="dataConsegna">Data Consegna</Label>
            <Input
              id="dataConsegna"
              type="date"
              value={formData.dataConsegna}
              onChange={(e) =>
                handleInputChange('dataConsegna', e.target.value)
              }
            />
          </div>

          {/* IMPORTO */}
          <div className="space-y-2">
            <Label htmlFor="importo">Importo Totale (€)</Label>
            <Input
              id="importo"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.importo}
              onChange={(e) => handleInputChange('importo', e.target.value)}
            />
          </div>

          {/* METODO INVIO */}
          <div className="space-y-2">
            <Label htmlFor="metodoInvio">Metodo Invio *</Label>
            <Select
              value={formData.metodoInvio}
              onValueChange={(value) => handleInputChange('metodoInvio', value)}
            >
              <SelectTrigger id="metodoInvio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="push">Notifica Push</SelectItem>
                <SelectItem value="portale">Portale</SelectItem>
                <SelectItem value="multiplo">Multiplo (SMS + Email)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ALLEGATO FILE */}
          <FileUploader
            label="Allega File (opzionale)"
            onUploadComplete={(result) => setFileData(result)}
            onUploadError={() => setFileData(null)}
          />

          {/* BUTTONS */}
          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Invio in corso...' : 'Invia Documento'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  tipoDocumento: 'conferma-consegna',
                  titolo: '',
                  descrizione: '',
                  medicineIds: [],
                  medicineInput: '',
                  dataConsegna: new Date().toISOString().split('T')[0],
                  importo: '',
                  metodoInvio: 'sms',
                });
              }}
            >
              Cancella
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
