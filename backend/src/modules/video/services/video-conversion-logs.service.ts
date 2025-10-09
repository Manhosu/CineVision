import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface VideoConversionLog {
  id?: string;
  content_id: string;
  input_file_path: string;
  input_format?: string;
  input_size_bytes?: number;
  output_format?: string;
  output_hls_path?: string;
  conversion_type: 'mkv_to_mp4' | 'mp4_to_hls' | 'mkv_to_hls' | 'direct_upload';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  qualities_generated?: string[];
  duration_seconds?: number;
  processing_time_seconds?: number;
  error_message?: string;
  started_at?: Date;
  completed_at?: Date;
}

@Injectable()
export class VideoConversionLogsService {
  private readonly logger = new Logger(VideoConversionLogsService.name);
  private readonly supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Create a new conversion log entry
   */
  async createLog(log: VideoConversionLog): Promise<VideoConversionLog> {
    try {
      const { data, error } = await this.supabase
        .from('video_conversion_logs')
        .insert({
          content_id: log.content_id,
          input_file_path: log.input_file_path,
          input_format: log.input_format,
          input_size_bytes: log.input_size_bytes,
          output_format: log.output_format,
          output_hls_path: log.output_hls_path,
          conversion_type: log.conversion_type,
          status: log.status || 'pending',
          progress: log.progress || 0,
          qualities_generated: log.qualities_generated,
          duration_seconds: log.duration_seconds,
          processing_time_seconds: log.processing_time_seconds,
          error_message: log.error_message,
          started_at: log.started_at || new Date(),
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Error creating conversion log:', error);
        throw error;
      }

      this.logger.log(`Conversion log created for content ${log.content_id}`);
      return data;
    } catch (error) {
      this.logger.error('Failed to create conversion log:', error);
      throw error;
    }
  }

  /**
   * Update conversion log
   */
  async updateLog(
    contentId: string,
    updates: Partial<VideoConversionLog>
  ): Promise<VideoConversionLog> {
    try {
      const { data, error } = await this.supabase
        .from('video_conversion_logs')
        .update({
          ...updates,
          updated_at: new Date(),
        })
        .eq('content_id', contentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .select()
        .single();

      if (error) {
        this.logger.error('Error updating conversion log:', error);
        throw error;
      }

      return data;
    } catch (error) {
      this.logger.error('Failed to update conversion log:', error);
      throw error;
    }
  }

  /**
   * Get conversion log by content ID
   */
  async getLogByContentId(contentId: string): Promise<VideoConversionLog | null> {
    try {
      const { data, error } = await this.supabase
        .from('video_conversion_logs')
        .select('*')
        .eq('content_id', contentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = not found
        this.logger.error('Error fetching conversion log:', error);
        throw error;
      }

      return data || null;
    } catch (error) {
      this.logger.error('Failed to fetch conversion log:', error);
      return null;
    }
  }

  /**
   * Get all logs with optional filters
   */
  async getLogs(filters?: {
    status?: string;
    conversion_type?: string;
    limit?: number;
  }): Promise<VideoConversionLog[]> {
    try {
      let query = this.supabase
        .from('video_conversion_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.conversion_type) {
        query = query.eq('conversion_type', filters.conversion_type);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        this.logger.error('Error fetching conversion logs:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.error('Failed to fetch conversion logs:', error);
      return [];
    }
  }

  /**
   * Mark log as processing
   */
  async markAsProcessing(contentId: string): Promise<void> {
    await this.updateLog(contentId, {
      status: 'processing',
      started_at: new Date(),
    });
  }

  /**
   * Mark log as completed
   */
  async markAsCompleted(
    contentId: string,
    result: {
      outputFormat: string;
      outputHlsPath?: string;
      qualitiesGenerated?: string[];
      processingTime: number;
    }
  ): Promise<void> {
    await this.updateLog(contentId, {
      status: 'completed',
      output_format: result.outputFormat,
      output_hls_path: result.outputHlsPath,
      qualities_generated: result.qualitiesGenerated,
      processing_time_seconds: result.processingTime,
      progress: 100,
      completed_at: new Date(),
    });
  }

  /**
   * Mark log as failed
   */
  async markAsFailed(contentId: string, errorMessage: string): Promise<void> {
    await this.updateLog(contentId, {
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date(),
    });
  }

  /**
   * Update progress
   */
  async updateProgress(contentId: string, progress: number): Promise<void> {
    await this.updateLog(contentId, {
      progress: Math.min(100, Math.max(0, progress)),
    });
  }

  /**
   * Get processing statistics
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    averageProcessingTime: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('video_conversion_logs')
        .select('status, processing_time_seconds');

      if (error) {
        throw error;
      }

      const stats = {
        total: data.length,
        pending: data.filter(l => l.status === 'pending').length,
        processing: data.filter(l => l.status === 'processing').length,
        completed: data.filter(l => l.status === 'completed').length,
        failed: data.filter(l => l.status === 'failed').length,
        averageProcessingTime: 0,
      };

      const completedLogs = data.filter(
        l => l.status === 'completed' && l.processing_time_seconds
      );

      if (completedLogs.length > 0) {
        const totalTime = completedLogs.reduce(
          (sum, l) => sum + (l.processing_time_seconds || 0),
          0
        );
        stats.averageProcessingTime = Math.round(totalTime / completedLogs.length);
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get statistics:', error);
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        averageProcessingTime: 0,
      };
    }
  }
}
