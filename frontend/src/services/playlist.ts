import type { TranscriptSegment, Video } from '../types';
import { useEffect, useState } from 'react';

export type PlaylistItem = {
  id: string;
  type: 'segment' | 'clip';
  addedAt: string;
  videoId: number;
  videoTitle: string;
  videoUrl?: string | null;
  vimeoId?: string | null;
  vimeoEmbedUrl?: string | null;
  date?: string | null;
  place?: string | null;
  speaker?: string | null;
  text?: string | null;
  startSeconds: number;
  durationSeconds?: number | null;
  label?: string | null;
};

const STORAGE_KEY = 'pts_playlist_v1';

const read = (): PlaylistItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data as PlaylistItem[];
  } catch {}
  return [];
};

const write = (items: PlaylistItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('playlist:updated'));
};

export const playlist = {
  getAll(): PlaylistItem[] {
    return read();
  },
  count(): number {
    return read().length;
  },
  clear() {
    write([]);
  },
  remove(id: string) {
    write(read().filter(i => i.id !== id));
  },
  addSegment(seg: TranscriptSegment) {
    if (!seg.video) return;
    const item: PlaylistItem = {
      id: `seg_${seg.id}_${Date.now()}`,
      type: 'segment',
      addedAt: new Date().toISOString(),
      videoId: seg.video.id,
      videoTitle: seg.video.title,
      videoUrl: seg.video.video_url,
      vimeoId: seg.video.vimeo_video_id,
      vimeoEmbedUrl: seg.video.vimeo_embed_url,
      date: (seg.video as any).date ?? null,
      place: (seg.video as any).place ?? null,
      speaker: seg.speaker_name,
      text: seg.transcript_text,
      startSeconds: seg.video_seconds || 0,
      durationSeconds: seg.duration_seconds ?? null,
    };
    write([...read(), item]);
  },
  addClip(video: Video, startSeconds: number, durationSeconds: number, label?: string) {
    const item: PlaylistItem = {
      id: `clip_${video.id}_${Math.floor(startSeconds)}_${Date.now()}`,
      type: 'clip',
      addedAt: new Date().toISOString(),
      videoId: video.id,
      videoTitle: video.title,
      videoUrl: video.video_url,
      vimeoId: video.vimeo_video_id,
      vimeoEmbedUrl: video.vimeo_embed_url,
      date: (video as any).date ?? null,
      place: (video as any).place ?? null,
      startSeconds,
      durationSeconds,
      label: label || null,
    };
    write([...read(), item]);
  },
  addSegments(segs: TranscriptSegment[]) {
    const items = segs.filter(s => s.video).map(seg => ({
      id: `seg_${seg.id}_${Date.now()}`,
      type: 'segment',
      addedAt: new Date().toISOString(),
      videoId: seg.video!.id,
      videoTitle: seg.video!.title,
      videoUrl: seg.video!.video_url,
      vimeoId: seg.video!.vimeo_video_id,
      vimeoEmbedUrl: seg.video!.vimeo_embed_url,
      date: (seg.video as any).date ?? null,
      place: (seg.video as any).place ?? null,
      speaker: seg.speaker_name,
      text: seg.transcript_text,
      startSeconds: seg.video_seconds || 0,
      durationSeconds: seg.duration_seconds ?? null,
    } as PlaylistItem));
    if (items.length) write([...read(), ...items]);
  },
};

export const usePlaylistCount = (): number => {
  const [count, setCount] = useState<number>(playlist.count());
  useEffect(() => {
    const onUpdate = () => setCount(playlist.count());
    window.addEventListener('playlist:updated', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('playlist:updated', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);
  return count;
};
