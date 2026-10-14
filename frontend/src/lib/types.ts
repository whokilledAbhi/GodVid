export type JobStatus =
  | "pending"
  | "analyzing"
  | "ready"
  | "downloading"
  | "merging"
  | "completed"
  | "failed"
  | "cancelled";

export interface VideoFormatInfo {
  format_id: string;
  resolution?: string;
  height?: number;
  width?: number;
  ext: string;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
  tbr?: number;
  fps?: number;
  is_video: boolean;
  is_audio: boolean;
  is_muxed: boolean;
  note?: string;
}

export interface VideoMetadata {
  url: string;
  title: string;
  source_host: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  available_resolutions: string[];
  available_codecs: string[];
  available_containers: string[];
  estimated_size_bytes?: number;
  is_direct_file: boolean;
  formats: VideoFormatInfo[];
  extraction_error?: string;
}

export interface JobProgress {
  percentage: number;
  downloaded_bytes: number;
  total_bytes?: number;
  speed_bytes_sec?: number;
  eta_seconds?: number;
  elapsed_seconds: number;
  current_step: string;
}

export interface DownloadJob {
  id: string;
  url: string;
  source_host: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  status: JobStatus;
  requested_quality: string;
  actual_quality?: string;
  preferred_container: string;
  actual_container?: string;
  output_filename?: string;
  output_filepath?: string;
  file_size_bytes?: number;
  error_message?: string;
  error_category?: string;
  retry_count: number;
  max_retries: number;
  progress: JobProgress;
  available_resolutions: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface QueueSummary {
  total: number;
  pending: number;
  analyzing: number;
  active: number;
  completed: number;
  failed: number;
  cancelled: number;
  overall_percentage: number;
  concurrency_limit: number;
}

export interface SystemStatus {
  status: string;
  ffmpeg_available: boolean;
  ffmpeg_version?: string;
  ffprobe_available: boolean;
  active_workers: number;
  concurrency_limit: number;
  disk_free_gb: number;
  total_jobs: number;
}

export interface BatchAnalyzeResponse {
  valid_urls: string[];
  invalid_urls: { url: string; error: string }[];
  total_detected: number;
  deduplicated_count: number;
  items: VideoMetadata[];
}
