import React, { useEffect, useMemo, useState } from 'react';
import { playlist, type PlaylistItem } from '../services/playlist';
import { videosAPI, downloadFile, formatTimestamp } from '../services/api';
import { Trash2, Download, ExternalLink } from 'lucide-react';

const PlaylistPage: React.FC = () => {
  const [active, setActive] = useState<string>(playlist.getActive());
  const [items, setItems] = useState<PlaylistItem[]>(playlist.getAll());
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const onUpdate = () => {
      setActive(playlist.getActive());
      setItems(playlist.getAll());
    };
    window.addEventListener('playlist:updated', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('playlist:updated', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);

  const remove = (id: string) => playlist.remove(id);
  const clear = () => playlist.clear();
  const playlists = useMemo(() => playlist.getPlaylists(), [active, items.length]);
  const setActiveList = (name: string) => playlist.setActive(name);
  const createList = () => {
    const name = newName.trim() || 'Untitled';
    playlist.create(name);
    playlist.setActive(name);
    setNewName('');
  };
  const renameList = (oldName: string) => {
    const next = prompt('Rename playlist', oldName)?.trim();
    if (next && next !== oldName) playlist.rename(oldName, next);
  };
  const deleteList = (name: string) => {
    if (window.confirm(`Delete playlist "${name}"?`)) playlist.removePlaylist(name);
  };

  const exportText = () => {
    const lines = items.map(it => {
      const date = it.date ? `[${String(it.date).slice(0,10)}]` : '';
      const place = it.place ? `[${it.place}]` : '';
      const start = `[${formatTimestamp(Math.floor(it.startSeconds || 0))}]`;
      const who = it.speaker || '';
      const vt = it.videoTitle ? ` — ${it.videoTitle}` : '';
      const text = it.text || (it.label || '') || '';
      return [date, place, start, who ? `${who}:` : '', text + vt].filter(Boolean).join(' ').trim();
    });
    const blob = new Blob([lines.join('\n\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    downloadFile(blob, `playlist_${new Date().toISOString().replace(/[:.]/g,'-')}.txt`);
  };

  const exportLinks = () => {
    // New format: group contiguous items per video, output combined range and texts,
    // then a single header with date/place/title and one link.
    type GroupMeta = {
      videoId: number;
      title: string;
      date?: string | null;
      place?: string | null;
      url: string; // base video url
    };

    const byVideo = new Map<number, { meta: GroupMeta; items: PlaylistItem[] }>();
    items.forEach(it => {
      const urlBase = it.vimeoId ? `https://vimeo.com/${it.vimeoId}` : (it.vimeoEmbedUrl || it.videoUrl) || '';
      const existing = byVideo.get(it.videoId);
      if (!existing) {
        byVideo.set(it.videoId, {
          meta: {
            videoId: it.videoId,
            title: it.videoTitle,
            date: it.date ?? null,
            place: it.place ?? null,
            url: urlBase,
          },
          items: [it],
        });
      } else {
        existing.items.push(it);
      }
    });

    const lines: string[] = [];

    Array.from(byVideo.values()).forEach(({ meta, items: videoItems }) => {
      // Sort by start time
      const sorted = [...videoItems].sort((a, b) => (a.startSeconds || 0) - (b.startSeconds || 0));
      type Cluster = { start: number; end: number; items: PlaylistItem[] };
      const clusters: Cluster[] = [];

      const getEnd = (it: PlaylistItem): number => {
        const s = Math.floor(it.startSeconds || 0);
        const d = Math.max(0, Math.floor(it.durationSeconds || 0));
        return d > 0 ? s + d : s;
      };

      const GAP_TOL = 1; // seconds allowed between segments to still consider contiguous

      let current: Cluster | null = null;
      for (const it of sorted) {
        const s = Math.floor(it.startSeconds || 0);
        const e = getEnd(it);
        if (!current) {
          current = { start: s, end: e, items: [it] };
          continue;
        }
        if (s <= current.end + GAP_TOL) {
          current.items.push(it);
          if (e > current.end) current.end = e;
        } else {
          clusters.push(current);
          current = { start: s, end: e, items: [it] };
        }
      }
      if (current) clusters.push(current);

      for (const c of clusters) {
        // Date line (only date)
        const dateStr = meta.date ? `[${String(meta.date).slice(0, 10)}]` : '';
        if (dateStr) lines.push(dateStr);

        // Combined range line
        const range = [
          `[${formatTimestamp(Math.floor(c.start))}]`,
          c.end > c.start ? `[${formatTimestamp(Math.floor(c.end))}]` : '',
        ].filter(Boolean).join(' ');
        if (range) lines.push(range);
        lines.push('');

        // Each item's text/label on its own paragraph
        c.items.forEach((it, idx) => {
          const content = (it.text || it.label || '').toString().replace(/\s+/g, ' ').trim();
          if (content) lines.push(content);
          if (idx < c.items.length - 1) lines.push('');
        });

        lines.push('');
        // Title line (plain, no brackets/em dash)
        const titleLine = meta.title || '';
        if (titleLine) lines.push(titleLine);

        // Single link with #t at cluster start
        if (meta.url) {
          let url = meta.url;
          if (url.includes('vimeo.com')) {
            const s = Math.max(0, Math.floor(c.start));
            const hh = Math.floor(s / 3600);
            const mm = Math.floor((s % 3600) / 60);
            const ss = s % 60;
            const frag = `${hh>0?hh+'h':''}${mm>0?mm+'m':''}${ss}s`;
            url = `${url}#t=${frag}`;
          }
          lines.push(url);
        }

        lines.push('');
        lines.push('--------------');
        lines.push('');
      }
    });

    const output = lines.join('\n').replace(/\n\n+$/,'\n');
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    downloadFile(blob, `playlist_links_${new Date().toISOString().replace(/[:.]/g,'-')}.txt`);
  };

  const downloadClipsZip = async () => {
    // For simplicity, download per-video zip for items that have durationSeconds
    const byVideo = new Map<number, PlaylistItem[]>();
    items.forEach(it => {
      if (it.durationSeconds && it.durationSeconds > 0) {
        const arr = byVideo.get(it.videoId) || [];
        arr.push(it);
        byVideo.set(it.videoId, arr);
      }
    });
    if (byVideo.size === 0) return alert('No clip items with duration in playlist.');

    for (const [videoId, arr] of Array.from(byVideo.entries())) {
      const clipItems = arr.map((it: PlaylistItem) => ({
        start_seconds: it.startSeconds,
        duration_seconds: it.durationSeconds as number,
        label: it.label || it.speaker || undefined,
      }));
      try {
        const blob = await videosAPI.downloadClipsZip(videoId, clipItems);
        downloadFile(blob, `video_${videoId}_clips.zip`);
      } catch (e) {
        console.error('Failed to download clips for video', videoId, e);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Playlist</h1>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-300">Active:</label>
              <select
                value={active}
                onChange={(e) => setActiveList(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {playlists.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New playlist name"
                className="text-sm border border-gray-300 rounded-md px-2 py-1 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              />
              <button onClick={createList} className="btn btn-outline">Create</button>
              <button onClick={() => renameList(active)} className="btn btn-outline">Rename</button>
              {playlists.length > 1 && (
                <button onClick={() => deleteList(active)} className="btn btn-outline text-red-600">Delete</button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportText} className="btn btn-outline"><Download className="h-4 w-4 mr-1" />Export Text</button>
            <button onClick={exportLinks} className="btn btn-outline"><ExternalLink className="h-4 w-4 mr-1" />Export Links</button>
            <button onClick={downloadClipsZip} className="btn btn-primary">Download Clips (per video)</button>
            <button onClick={clear} className="btn btn-outline text-red-600"><Trash2 className="h-4 w-4 mr-1" />Clear</button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">Your playlist is empty.</div>
        ) : (
          <ul className="space-y-3">
            {items.map(it => (
              <li key={it.id} className="bg-white border border-gray-200 rounded-md p-4 flex items-start justify-between dark:bg-gray-800 dark:border-gray-700">
                <div className="pr-4">
                  <div className="text-sm text-gray-500 mb-1 dark:text-gray-400">{it.type.toUpperCase()} • Video #{it.videoId} • Added {new Date(it.addedAt).toLocaleString()}</div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{it.videoTitle}</div>
                  <div className="text-sm text-gray-700 mt-1 dark:text-gray-300">
                    {it.speaker && <span className="mr-2">{it.speaker}:</span>}
                    {it.text || it.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 dark:text-gray-400">
                    {it.date && <span className="mr-2">{String(it.date).slice(0,10)}</span>}
                    {it.place && <span className="mr-2">{it.place}</span>}
                    <span>[{formatTimestamp(Math.floor(it.startSeconds || 0))}{it.durationSeconds ? ` - ${formatTimestamp(Math.floor((it.startSeconds || 0) + (it.durationSeconds || 0)))}` : ''}]</span>
                  </div>
                </div>
                <button onClick={() => remove(it.id)} className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-500"><Trash2 className="h-5 w-5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PlaylistPage;
