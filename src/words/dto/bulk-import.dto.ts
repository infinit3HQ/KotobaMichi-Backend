export interface BulkImportResultDto {
  total: number;
  imported: number;
  duplicates: number;
  errors: number;
  errorDetails: string[];
}

export interface ImportStatsDto {
  totalWords: number;
  recentImports: number;
  lastImportTime: Date | null;
}
