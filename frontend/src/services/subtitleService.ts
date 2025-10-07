'use client';

export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  format: 'vtt' | 'srt';
  url: string;
  default?: boolean;
  active?: boolean;
}

export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  position?: string;
  align?: string;
  line?: string;
  size?: string;
}

export interface SubtitleOptions {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  textShadow?: boolean;
  position?: 'bottom' | 'top' | 'center';
  opacity?: number;
}

export class SubtitleService {
  private tracks: Map<string, SubtitleTrack> = new Map();
  private cues: Map<string, SubtitleCue[]> = new Map();
  private activeTrack: string | null = null;
  private currentCues: SubtitleCue[] = [];
  private eventListeners: Map<string, Set<Function>> = new Map();

  /**
   * Add subtitle track
   */
  async addTrack(track: SubtitleTrack): Promise<void> {
    this.tracks.set(track.id, track);

    try {
      const cues = await this.loadSubtitles(track.url, track.format);
      this.cues.set(track.id, cues);

      if (track.default) {
        this.setActiveTrack(track.id);
      }

      this.emit('trackAdded', { track });
    } catch (error) {
      console.error(`Failed to load subtitle track ${track.id}:`, error);
      this.emit('trackError', { trackId: track.id, error });
    }
  }

  /**
   * Remove subtitle track
   */
  removeTrack(trackId: string): void {
    this.tracks.delete(trackId);
    this.cues.delete(trackId);

    if (this.activeTrack === trackId) {
      this.activeTrack = null;
      this.currentCues = [];
      this.emit('trackChanged', { trackId: null });
    }

    this.emit('trackRemoved', { trackId });
  }

  /**
   * Set active subtitle track
   */
  setActiveTrack(trackId: string | null): void {
    // Clear previous active track
    if (this.activeTrack) {
      const prevTrack = this.tracks.get(this.activeTrack);
      if (prevTrack) {
        prevTrack.active = false;
      }
    }

    this.activeTrack = trackId;

    // Set new active track
    if (trackId && this.tracks.has(trackId)) {
      const track = this.tracks.get(trackId)!;
      track.active = true;
    }

    this.emit('trackChanged', { trackId });
  }

  /**
   * Get all available tracks
   */
  getTracks(): SubtitleTrack[] {
    return Array.from(this.tracks.values());
  }

  /**
   * Get active track
   */
  getActiveTrack(): SubtitleTrack | null {
    return this.activeTrack ? this.tracks.get(this.activeTrack) || null : null;
  }

  /**
   * Get current subtitle cues for given time
   */
  getCurrentCues(time: number): SubtitleCue[] {
    if (!this.activeTrack || !this.cues.has(this.activeTrack)) {
      return [];
    }

    const trackCues = this.cues.get(this.activeTrack)!;
    const activeCues = trackCues.filter(
      cue => time >= cue.startTime && time <= cue.endTime
    );

    // Update current cues if changed
    if (!this.areCuesEqual(activeCues, this.currentCues)) {
      this.currentCues = activeCues;
      this.emit('cuesChanged', { cues: activeCues, time });
    }

    return activeCues;
  }

  /**
   * Load subtitles from URL
   */
  private async loadSubtitles(url: string, format: 'vtt' | 'srt'): Promise<SubtitleCue[]> {
    try {
      const response = await fetch(url);
      const text = await response.text();

      switch (format) {
        case 'vtt':
          return this.parseVTT(text);
        case 'srt':
          return this.parseSRT(text);
        default:
          throw new Error(`Unsupported subtitle format: ${format}`);
      }
    } catch (error) {
      console.error(`Failed to load subtitles from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Parse VTT (WebVTT) subtitles
   */
  private parseVTT(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const lines = content.split('\n');
    let i = 0;

    // Skip WEBVTT header
    while (i < lines.length && !lines[i].startsWith('WEBVTT')) {
      i++;
    }
    i++; // Skip WEBVTT line

    while (i < lines.length) {
      // Skip empty lines
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }

      if (i >= lines.length) break;

      let cueId = '';
      let timeLine = '';
      let textLines: string[] = [];

      // Check if first line is an ID or timestamp
      if (lines[i].includes('-->')) {
        timeLine = lines[i];
        i++;
      } else {
        cueId = lines[i];
        i++;
        if (i < lines.length && lines[i].includes('-->')) {
          timeLine = lines[i];
          i++;
        }
      }

      // Parse timestamp line
      const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2}.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}.\d{3})/);
      if (!timeMatch) {
        i++;
        continue;
      }

      const startTime = this.parseTimestamp(timeMatch[1]);
      const endTime = this.parseTimestamp(timeMatch[2]);

      // Extract cue settings if present
      const settings = this.parseCueSettings(timeLine);

      // Collect text lines until empty line or end
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i]);
        i++;
      }

      if (textLines.length > 0) {
        cues.push({
          id: cueId || `cue-${cues.length}`,
          startTime,
          endTime,
          text: textLines.join('\n'),
          ...settings,
        });
      }
    }

    return cues;
  }

  /**
   * Parse SRT subtitles
   */
  private parseSRT(content: string): SubtitleCue[] {
    const cues: SubtitleCue[] = [];
    const blocks = content.split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;

      const id = lines[0].trim();
      const timeLine = lines[1].trim();
      const textLines = lines.slice(2);

      // Parse timestamp line (SRT format: 00:00:20,000 --> 00:00:24,400)
      const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
      if (!timeMatch) continue;

      const startTime = this.parseTimestamp(timeMatch[1].replace(',', '.'));
      const endTime = this.parseTimestamp(timeMatch[2].replace(',', '.'));

      // Clean up text (remove SRT formatting tags)
      const text = textLines
        .join('\n')
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\{[^}]*\}/g, '') // Remove SRT formatting
        .trim();

      cues.push({
        id,
        startTime,
        endTime,
        text,
      });
    }

    return cues;
  }

  /**
   * Parse timestamp to seconds
   */
  private parseTimestamp(timestamp: string): number {
    const parts = timestamp.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const secondsParts = parts[2].split('.');
    const seconds = parseInt(secondsParts[0], 10);
    const milliseconds = parseInt(secondsParts[1], 10);

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  /**
   * Parse VTT cue settings
   */
  private parseCueSettings(timeLine: string): Partial<SubtitleCue> {
    const settings: Partial<SubtitleCue> = {};
    const parts = timeLine.split(' ');

    for (const part of parts) {
      if (part.startsWith('position:')) {
        settings.position = part.substring(9);
      } else if (part.startsWith('align:')) {
        settings.align = part.substring(6);
      } else if (part.startsWith('line:')) {
        settings.line = part.substring(5);
      } else if (part.startsWith('size:')) {
        settings.size = part.substring(5);
      }
    }

    return settings;
  }

  /**
   * Compare two cue arrays for equality
   */
  private areCuesEqual(cues1: SubtitleCue[], cues2: SubtitleCue[]): boolean {
    if (cues1.length !== cues2.length) return false;

    return cues1.every((cue1, index) => {
      const cue2 = cues2[index];
      return cue1.id === cue2.id &&
             cue1.startTime === cue2.startTime &&
             cue1.endTime === cue2.endTime;
    });
  }

  /**
   * Search subtitles by text
   */
  searchSubtitles(query: string, trackId?: string): Array<{ cue: SubtitleCue; trackId: string }> {
    const results: Array<{ cue: SubtitleCue; trackId: string }> = [];
    const searchTracks = trackId ? [trackId] : Array.from(this.cues.keys());

    for (const tid of searchTracks) {
      const trackCues = this.cues.get(tid);
      if (!trackCues) continue;

      for (const cue of trackCues) {
        if (cue.text.toLowerCase().includes(query.toLowerCase())) {
          results.push({ cue, trackId: tid });
        }
      }
    }

    return results;
  }

  /**
   * Export subtitles in specified format
   */
  exportSubtitles(trackId: string, format: 'vtt' | 'srt'): string {
    const cues = this.cues.get(trackId);
    if (!cues) {
      throw new Error(`Track ${trackId} not found`);
    }

    switch (format) {
      case 'vtt':
        return this.exportVTT(cues);
      case 'srt':
        return this.exportSRT(cues);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export as VTT format
   */
  private exportVTT(cues: SubtitleCue[]): string {
    let content = 'WEBVTT\n\n';

    for (const cue of cues) {
      if (cue.id) {
        content += `${cue.id}\n`;
      }

      const startTime = this.formatTimestamp(cue.startTime);
      const endTime = this.formatTimestamp(cue.endTime);

      let timeLine = `${startTime} --> ${endTime}`;

      if (cue.position) timeLine += ` position:${cue.position}`;
      if (cue.align) timeLine += ` align:${cue.align}`;
      if (cue.line) timeLine += ` line:${cue.line}`;
      if (cue.size) timeLine += ` size:${cue.size}`;

      content += `${timeLine}\n`;
      content += `${cue.text}\n\n`;
    }

    return content;
  }

  /**
   * Export as SRT format
   */
  private exportSRT(cues: SubtitleCue[]): string {
    let content = '';

    cues.forEach((cue, index) => {
      const startTime = this.formatTimestamp(cue.startTime, true);
      const endTime = this.formatTimestamp(cue.endTime, true);

      content += `${index + 1}\n`;
      content += `${startTime} --> ${endTime}\n`;
      content += `${cue.text}\n\n`;
    });

    return content;
  }

  /**
   * Format timestamp for export
   */
  private formatTimestamp(seconds: number, srtFormat = false): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    const separator = srtFormat ? ',' : '.';

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}${separator}${ms.toString().padStart(3, '0')}`;
  }

  // Event system
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in subtitle event listener:', error);
        }
      });
    }
  }

  /**
   * Clear all tracks and cues
   */
  clear(): void {
    this.tracks.clear();
    this.cues.clear();
    this.activeTrack = null;
    this.currentCues = [];
  }

  /**
   * Get subtitle statistics
   */
  getStats(trackId?: string): {
    trackCount: number;
    totalCues: number;
    duration: number;
    averageCueLength: number;
  } {
    const tracks = trackId ? [trackId] : Array.from(this.cues.keys());
    let totalCues = 0;
    let totalDuration = 0;
    let totalTextLength = 0;

    for (const tid of tracks) {
      const cues = this.cues.get(tid);
      if (!cues) continue;

      totalCues += cues.length;

      for (const cue of cues) {
        totalDuration += cue.endTime - cue.startTime;
        totalTextLength += cue.text.length;
      }
    }

    return {
      trackCount: tracks.length,
      totalCues,
      duration: totalDuration,
      averageCueLength: totalCues > 0 ? totalTextLength / totalCues : 0,
    };
  }
}

// Export singleton instance
export const subtitleService = new SubtitleService();