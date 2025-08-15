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

const LEGACY_STORAGE_KEY = 'pts_playlist_v1';
const META_KEY = 'pts_playlists_meta_v1';
const PLAYLIST_PREFIX = 'pts_playlist_v1::';

type Meta = { active: string; names: string[] };

let memoryStore: Record<string, PlaylistItem[]> = {};
let memoryMeta: Meta | null = null;

const storageAvailable = (): boolean => {
  try {
    const x = '__pts_test__';
    localStorage.setItem(x, x);
    localStorage.removeItem(x);
    return true;
  } catch {
    return false;
  }
};

const readMeta = (): Meta => {
  if (!storageAvailable()) {
    if (!memoryMeta) memoryMeta = { active: 'Default', names: ['Default'] };
    return memoryMeta;
  }
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) {
      const m = JSON.parse(raw) as Meta;
      if (m && m.active && Array.isArray(m.names) && m.names.length) return m;
    }
  } catch {}
  // Initialize meta and migrate legacy single playlist to Default
  const meta: Meta = { active: 'Default', names: ['Default'] };
  try {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      localStorage.setItem(PLAYLIST_PREFIX + 'Default', legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } else {
      // ensure Default exists
      const existing = localStorage.getItem(PLAYLIST_PREFIX + 'Default');
      if (!existing) localStorage.setItem(PLAYLIST_PREFIX + 'Default', '[]');
    }
  } catch {}
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {}
  return meta;
};

const writeMeta = (meta: Meta) => {
  if (!storageAvailable()) { memoryMeta = meta; return; }
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {}
};

const keyFor = (name: string) => PLAYLIST_PREFIX + name;

const readList = (name: string): PlaylistItem[] => {
  if (!storageAvailable()) return memoryStore[name] || [];
  try {
    const raw = localStorage.getItem(keyFor(name));
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data as PlaylistItem[];
  } catch {}
  return [];
};

const writeList = (name: string, items: PlaylistItem[]) => {
  if (storageAvailable()) {
    try { localStorage.setItem(keyFor(name), JSON.stringify(items)); }
    catch { memoryStore[name] = items; }
  } else {
    memoryStore[name] = items;
  }
  window.dispatchEvent(new CustomEvent('playlist:updated'));
};

export const playlist = {
  // Meta
  getPlaylists(): string[] {
    const m = readMeta();
    return [...m.names];
  },
  getActive(): string {
    return readMeta().active;
  },
  setActive(name: string) {
    const m = readMeta();
    if (!m.names.includes(name)) m.names.push(name);
    m.active = name;
    writeMeta(m);
    // Ensure list exists
    if (!storageAvailable()) {
      if (!memoryStore[name]) memoryStore[name] = [];
    } else {
      const raw = localStorage.getItem(keyFor(name));
      if (!raw) localStorage.setItem(keyFor(name), '[]');
    }
    window.dispatchEvent(new CustomEvent('playlist:updated'));
  },
  create(name: string) {
    const m = readMeta();
    if (!m.names.includes(name)) {
      m.names.push(name);
      writeMeta(m);
      writeList(name, []);
    }
  },
  rename(oldName: string, newName: string) {
    if (oldName === newName) return;
    const m = readMeta();
    if (!m.names.includes(oldName)) return;
    if (!m.names.includes(newName)) m.names.push(newName);
    const items = readList(oldName);
    writeList(newName, items);
    // remove old
    if (storageAvailable()) localStorage.removeItem(keyFor(oldName));
    else delete memoryStore[oldName];
    m.names = m.names.filter(n => n !== oldName);
    if (m.active === oldName) m.active = newName;
    writeMeta(m);
  },
  removePlaylist(name: string) {
    const m = readMeta();
    if (!m.names.includes(name)) return;
    // Delete items
    if (storageAvailable()) localStorage.removeItem(keyFor(name));
    else delete memoryStore[name];
    m.names = m.names.filter(n => n !== name);
    if (m.names.length === 0) { m.names = ['Default']; writeList('Default', []); m.active = 'Default'; }
    else if (m.active === name) { m.active = m.names[0]; }
    writeMeta(m);
    window.dispatchEvent(new CustomEvent('playlist:updated'));
  },

  // Items (active by default)
  getAll(name?: string): PlaylistItem[] {
    const target = name ?? readMeta().active;
    return readList(target);
  },
  count(name?: string): number {
    return playlist.getAll(name).length;
  },
  clear(name?: string) {
    writeList(name ?? readMeta().active, []);
  },
  remove(id: string, name?: string) {
    const target = name ?? readMeta().active;
    writeList(target, readList(target).filter(i => i.id !== id));
  },
  addSegment(seg: TranscriptSegment, name?: string) {
    if (!seg.video) return;
    const target = name ?? readMeta().active;
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
    writeList(target, [...readList(target), item]);
  },
  addClip(video: Video, startSeconds: number, durationSeconds: number, label?: string, name?: string) {
    const target = name ?? readMeta().active;
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
    writeList(target, [...readList(target), item]);
  },
  addSegments(segs: TranscriptSegment[], name?: string) {
    const target = name ?? readMeta().active;
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
    if (items.length) writeList(target, [...readList(target), ...items]);
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
