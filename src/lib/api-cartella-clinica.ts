import api from './api';
import type { ApiResponse } from '@/types/api';
import type {
  DiarioSalute,
  CreateDiarioEntryDto,
  RegistrazioneStatoSalute,
  CreateStatoSaluteDto,
  MisurazioneFebbre,
  CreateMisurazioneFebbreDto,
  MisurazioneAntropometrica,
  CreateMisurazioneAntropometricaDto,
  DocumentoCartellaClinica,
  CreateDocumentoDto,
  PermessoCondivisione,
  CreatePermessoCondivisioneDto,
  RegistrazionePandemiaEpidemia,
  CreateEsposizionePandemiaDto,
  AccessoCartellaClinicaAudit,
  DashboardStats,
} from '@/types/cartella-clinica';

// Gateway triplo-wrappa: { data: { data: actual } }
// Questa funzione risolve qualsiasi livello di wrapping
function unwrap<T>(response: any): T {
  return response.data?.data?.data ?? response.data?.data ?? response.data;
}

// ============================================
// DIARIO SALUTE
// ============================================

export const cartellaClinicaApi = {
  // Diario Salute
  getDiarioEntries: async (params?: {
    categoria?: string;
    tag?: string;
    dataInizio?: string;
    dataFine?: string;
    limit?: number;
    offset?: number;
  }): Promise<DiarioSalute[]> => {
    const queryParams = new URLSearchParams();
    if (params?.categoria) queryParams.append('categoria', params.categoria);
    if (params?.tag) queryParams.append('tag', params.tag);
    if (params?.dataInizio) queryParams.append('dataInizio', params.dataInizio);
    if (params?.dataFine) queryParams.append('dataFine', params.dataFine);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    
    const response = await api.get<ApiResponse<DiarioSalute[]>>(
      `/paziente/cartella-clinica/diario?${queryParams.toString()}`
    );
    return unwrap(response);
  },

  getDiarioEntry: async (id: number): Promise<DiarioSalute> => {
    const response = await api.get<ApiResponse<DiarioSalute>>(
      `/paziente/cartella-clinica/diario/${id}`
    );
    return unwrap(response);
  },

  createDiarioEntry: async (data: CreateDiarioEntryDto): Promise<DiarioSalute> => {
    const response = await api.post<ApiResponse<DiarioSalute>>(
      '/paziente/cartella-clinica/diario',
      data
    );
    return unwrap(response);
  },

  updateDiarioEntry: async (id: number, data: Partial<CreateDiarioEntryDto>): Promise<DiarioSalute> => {
    const response = await api.put<ApiResponse<DiarioSalute>>(
      `/paziente/cartella-clinica/diario/${id}`,
      data
    );
    return unwrap(response);
  },

  deleteDiarioEntry: async (id: number): Promise<void> => {
    await api.delete(`/paziente/cartella-clinica/diario/${id}`);
  },

  searchDiario: async (query: string): Promise<DiarioSalute[]> => {
    const response = await api.get<ApiResponse<DiarioSalute[]>>(
      `/paziente/cartella-clinica/diario/search?q=${encodeURIComponent(query)}`
    );
    return unwrap(response);
  },

  // Stati Salute
  getStatiSalute: async (params?: {
    tipo?: string;
    dataInizio?: string;
    dataFine?: string;
  }): Promise<RegistrazioneStatoSalute[]> => {
    const queryParams = new URLSearchParams();
    if (params?.tipo) queryParams.append('tipo', params.tipo);
    if (params?.dataInizio) queryParams.append('dataInizio', params.dataInizio);
    if (params?.dataFine) queryParams.append('dataFine', params.dataFine);
    
    const response = await api.get<ApiResponse<RegistrazioneStatoSalute[]>>(
      `/paziente/cartella-clinica/stati-salute?${queryParams.toString()}`
    );
    return unwrap(response);
  },

  getStatoSalute: async (id: number): Promise<RegistrazioneStatoSalute> => {
    const response = await api.get<ApiResponse<RegistrazioneStatoSalute>>(
      `/paziente/cartella-clinica/stati-salute/${id}`
    );
    return unwrap(response);
  },

  registraStatoSalute: async (data: CreateStatoSaluteDto): Promise<RegistrazioneStatoSalute> => {
    const response = await api.post<ApiResponse<RegistrazioneStatoSalute>>(
      '/paziente/cartella-clinica/stati-salute',
      data
    );
    return unwrap(response);
  },

  // Misurazioni Febbre
  registraMisurazioneFebbre: async (statoId: number, data: CreateMisurazioneFebbreDto): Promise<MisurazioneFebbre> => {
    const response = await api.post<ApiResponse<MisurazioneFebbre>>(
      `/paziente/cartella-clinica/stati-salute/${statoId}/febbre`,
      data
    );
    return unwrap(response);
  },

  getStoricoFebbre: async (params?: {
    dataInizio?: string;
    dataFine?: string;
  }): Promise<MisurazioneFebbre[]> => {
    const queryParams = new URLSearchParams();
    if (params?.dataInizio) queryParams.append('dataInizio', params.dataInizio);
    if (params?.dataFine) queryParams.append('dataFine', params.dataFine);
    
    const response = await api.get<ApiResponse<MisurazioneFebbre[]>>(
      `/paziente/cartella-clinica/febbre/storico?${queryParams.toString()}`
    );
    return unwrap(response);
  },

  // Misurazioni Antropometriche
  getMisurazioni: async (params?: {
    tipo?: string;
    dataInizio?: string;
    dataFine?: string;
  }): Promise<MisurazioneAntropometrica[]> => {
    const queryParams = new URLSearchParams();
    if (params?.tipo) queryParams.append('tipo', params.tipo);
    if (params?.dataInizio) queryParams.append('dataInizio', params.dataInizio);
    if (params?.dataFine) queryParams.append('dataFine', params.dataFine);
    
    const response = await api.get<ApiResponse<MisurazioneAntropometrica[]>>(
      `/paziente/cartella-clinica/misurazioni?${queryParams.toString()}`
    );
    return unwrap(response);
  },

  registraMisurazione: async (data: CreateMisurazioneAntropometricaDto): Promise<MisurazioneAntropometrica> => {
    const response = await api.post<ApiResponse<MisurazioneAntropometrica>>(
      '/paziente/cartella-clinica/misurazioni',
      data
    );
    return unwrap(response);
  },

  // Documenti
  getDocumenti: async (params?: {
    tipo?: string;
    categoria?: string;
    tag?: string;
    dataInizio?: string;
    dataFine?: string;
  }): Promise<DocumentoCartellaClinica[]> => {
    const queryParams = new URLSearchParams();
    if (params?.tipo) queryParams.append('tipo', params.tipo);
    if (params?.categoria) queryParams.append('categoria', params.categoria);
    if (params?.tag) queryParams.append('tag', params.tag);
    if (params?.dataInizio) queryParams.append('dataInizio', params.dataInizio);
    if (params?.dataFine) queryParams.append('dataFine', params.dataFine);
    
    const response = await api.get<ApiResponse<DocumentoCartellaClinica[]>>(
      `/paziente/cartella-clinica/documenti?${queryParams.toString()}`
    );
    return unwrap(response);
  },

  getDocumento: async (id: number): Promise<DocumentoCartellaClinica> => {
    const response = await api.get<ApiResponse<DocumentoCartellaClinica>>(
      `/paziente/cartella-clinica/documenti/${id}`
    );
    return unwrap(response);
  },

  createDocumento: async (data: CreateDocumentoDto, file?: File): Promise<DocumentoCartellaClinica> => {
    const formData = new FormData();
    formData.append('data', JSON.stringify(data));
    if (file) {
      formData.append('file', file);
    }
    
    const response = await api.post<ApiResponse<DocumentoCartellaClinica>>(
      '/paziente/cartella-clinica/documenti',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return unwrap(response);
  },

  updateDocumento: async (id: number, data: Partial<CreateDocumentoDto>): Promise<DocumentoCartellaClinica> => {
    const response = await api.put<ApiResponse<DocumentoCartellaClinica>>(
      `/paziente/cartella-clinica/documenti/${id}`,
      data
    );
    return unwrap(response);
  },

  deleteDocumento: async (id: number): Promise<void> => {
    await api.delete(`/paziente/cartella-clinica/documenti/${id}`);
  },

  // Permessi
  getPermessi: async (): Promise<PermessoCondivisione[]> => {
    const response = await api.get<ApiResponse<PermessoCondivisione[]>>(
      '/paziente/cartella-clinica/permessi'
    );
    return unwrap(response);
  },

  createPermesso: async (data: CreatePermessoCondivisioneDto): Promise<PermessoCondivisione> => {
    const response = await api.post<ApiResponse<PermessoCondivisione>>(
      '/paziente/cartella-clinica/permessi',
      data
    );
    return unwrap(response);
  },

  revocaPermesso: async (id: number): Promise<void> => {
    await api.delete(`/paziente/cartella-clinica/permessi/${id}`);
  },

  getPermessiMedico: async (): Promise<PermessoCondivisione[]> => {
    const response = await api.get<ApiResponse<PermessoCondivisione[]>>(
      '/medico/pazienti'
    );
    return unwrap(response);
  },

  getDocumentiMedico: async (pazienteId: number): Promise<DocumentoCartellaClinica[]> => {
    const response = await api.get<ApiResponse<DocumentoCartellaClinica[]>>(
      `/paziente/cartella-clinica/medico/pazienti/${pazienteId}/documenti`
    );
    return unwrap(response);
  },

  getReportMedico: async (pazienteId: number, params?: { dataInizio?: string; dataFine?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.dataInizio) queryParams.append('dataInizio', params.dataInizio);
    if (params?.dataFine) queryParams.append('dataFine', params.dataFine);
    const response = await api.get<ApiResponse<any>>(
      `/paziente/cartella-clinica/medico/pazienti/${pazienteId}/report?${queryParams.toString()}`
    );
    return unwrap(response);
  },

  // Esposizioni Pandemia/Epidemia
  getEsposizioni: async (params?: {
    tipo?: string;
    dataInizio?: string;
    dataFine?: string;
  }): Promise<RegistrazionePandemiaEpidemia[]> => {
    const queryParams = new URLSearchParams();
    if (params?.tipo) queryParams.append('tipo', params.tipo);
    if (params?.dataInizio) queryParams.append('dataInizio', params.dataInizio);
    if (params?.dataFine) queryParams.append('dataFine', params.dataFine);
    
    const response = await api.get<ApiResponse<RegistrazionePandemiaEpidemia[]>>(
      `/paziente/cartella-clinica/esposizioni?${queryParams.toString()}`
    );
    return unwrap(response);
  },

  registraEsposizione: async (data: CreateEsposizionePandemiaDto): Promise<RegistrazionePandemiaEpidemia> => {
    const response = await api.post<ApiResponse<RegistrazionePandemiaEpidemia>>(
      '/paziente/cartella-clinica/esposizioni',
      data
    );
    return unwrap(response);
  },

  // Report e Export
  generaReportCompleto: async (params: {
    formato: 'json' | 'summary' | 'pdf';
    dataInizio?: string;
    dataFine?: string;
  }): Promise<Blob | any> => {
    if (params.formato === 'pdf') {
      const response = await api.post(
        '/paziente/cartella-clinica/report/completo',
        {
          formato: params.formato,
          dataInizio: params.dataInizio,
          dataFine: params.dataFine,
        },
        {
          responseType: 'blob',
        }
      );
      return response.data;
    } else {
      const response = await api.post<ApiResponse<any>>(
        '/paziente/cartella-clinica/report/completo',
        {
          formato: params.formato,
          dataInizio: params.dataInizio,
          dataFine: params.dataFine,
        }
      );
      return unwrap(response);
    }
  },

  exportDati: async (formato: 'json' | 'csv'): Promise<Blob> => {
    const response = await api.get(
      `/paziente/cartella-clinica/export?formato=${formato}`,
      {
        responseType: 'blob',
      }
    );
    return response.data;
  },

  // Audit Log
  getAuditLog: async (params?: {
    tipoOperazione?: string;
    entitaTipo?: string;
    dataInizio?: string;
    dataFine?: string;
    utenteId?: number;
    limit?: number;
    offset?: number;
  }): Promise<AccessoCartellaClinicaAudit[]> => {
    const queryParams = new URLSearchParams();
    if (params?.tipoOperazione) queryParams.append('tipoOperazione', params.tipoOperazione);
    if (params?.entitaTipo) queryParams.append('entitaTipo', params.entitaTipo);
    if (params?.dataInizio) queryParams.append('dataInizio', params.dataInizio);
    if (params?.dataFine) queryParams.append('dataFine', params.dataFine);
    if (params?.utenteId) queryParams.append('utenteId', params.utenteId.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    
    const response = await api.get<ApiResponse<AccessoCartellaClinicaAudit[]>>(
      `/paziente/cartella-clinica/audit?${queryParams.toString()}`
    );
    return unwrap(response);
  },

  getAuditLogByEntita: async (entitaTipo: string, entitaId: number): Promise<AccessoCartellaClinicaAudit[]> => {
    const response = await api.get<ApiResponse<AccessoCartellaClinicaAudit[]>>(
      `/paziente/cartella-clinica/audit/${entitaTipo}/${entitaId}`
    );
    return unwrap(response);
  },
};

