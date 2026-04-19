'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, X, FileText, Image, File, CheckCircle, AlertCircle } from 'lucide-react';

export interface UploadResult {
  url: string;
  path: string;
  originalName: string;
  mimeType: string;
  size: number;
  cloudinaryPublicId?: string;
}

interface FileUploaderProps {
  /** API endpoint for upload (default: /api/upload/documento) */
  uploadEndpoint?: string;
  /** Allowed MIME types (default: images, PDF, DOCX, ZIP) */
  allowedTypes?: string[];
  /** Max file size in MB (default: 50) */
  maxSizeMB?: number;
  /** Label shown above the drop zone */
  label?: string;
  /** Called after successful upload */
  onUploadComplete?: (result: UploadResult) => void;
  /** Called on upload error */
  onUploadError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
}

const DEFAULT_ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip', 'application/x-zip-compressed',
  'application/dicom', 'application/octet-stream',
];

const FILE_TYPE_LABELS: Record<string, string> = {
  'image/jpeg': 'JPEG', 'image/jpg': 'JPEG', 'image/png': 'PNG',
  'image/webp': 'WebP', 'image/heic': 'HEIC', 'image/heif': 'HEIF',
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/zip': 'ZIP', 'application/x-zip-compressed': 'ZIP',
  'application/dicom': 'DICOM',
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="h-8 w-8 text-blue-500" />;
  if (mimeType === 'application/pdf') return <FileText className="h-8 w-8 text-red-500" />;
  return <File className="h-8 w-8 text-gray-500" />;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploader({
  uploadEndpoint = '/api/upload/documento',
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  maxSizeMB = 50,
  label = 'Allega File',
  onUploadComplete,
  onUploadError,
  className = '',
}: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback((file: File): string | null => {
    if (!allowedTypes.includes(file.type) && file.type !== '') {
      return `Tipo di file non supportato: ${file.type}`;
    }
    if (file.size > maxSizeBytes) {
      return `File troppo grande (${formatSize(file.size)}). Max: ${maxSizeMB}MB`;
    }
    return null;
  }, [allowedTypes, maxSizeBytes, maxSizeMB]);

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      onUploadError?.(validationError);
      return;
    }
    setError('');
    setUploadResult(null);
    setSelectedFile(file);
  }, [validateFile, onUploadError]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress(0);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const token = localStorage.getItem('token');

      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadEndpoint);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      const result = await new Promise<UploadResult>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve(response.data);
          } else {
            try {
              const errResponse = JSON.parse(xhr.responseText);
              reject(new Error(errResponse.message || 'Errore durante il caricamento'));
            } catch {
              reject(new Error('Errore durante il caricamento'));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Errore di rete'));
        xhr.send(formData);
      });

      setUploadResult(result);
      setProgress(100);
      onUploadComplete?.(result);
    } catch (err: any) {
      const msg = err.message || 'Errore durante il caricamento';
      setError(msg);
      onUploadError?.(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setProgress(0);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const acceptString = allowedTypes.join(',');

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="text-sm font-medium">{label}</label>

      {/* Upload success */}
      {uploadResult && (
        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800 truncate">
              {uploadResult.originalName}
            </p>
            <p className="text-xs text-green-600">{formatSize(uploadResult.size)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRemove}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Drop zone - show when no result yet */}
      {!uploadResult && (
        <>
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-colors duration-200
              ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${selectedFile ? 'bg-gray-50' : ''}
            `}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={acceptString}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
            />

            {selectedFile ? (
              <div className="flex items-center gap-3 justify-center">
                {getFileIcon(selectedFile.type)}
                <div className="text-left">
                  <p className="text-sm font-medium truncate max-w-[200px]">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatSize(selectedFile.size)}
                    {selectedFile.type && ` - ${FILE_TYPE_LABELS[selectedFile.type] || selectedFile.type}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-gray-400" />
                <p className="text-sm text-gray-600">
                  Trascina un file qui oppure <span className="text-blue-600 font-medium">sfoglia</span>
                </p>
                <p className="text-xs text-gray-400">
                  PDF, immagini, DOCX, ZIP - max {maxSizeMB}MB
                </p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-gray-500 text-center">{progress}%</p>
            </div>
          )}

          {/* Upload button */}
          {selectedFile && !uploading && (
            <Button onClick={handleUpload} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Carica File
            </Button>
          )}

          {uploading && (
            <Button disabled className="w-full">
              Caricamento in corso...
            </Button>
          )}
        </>
      )}
    </div>
  );
}
