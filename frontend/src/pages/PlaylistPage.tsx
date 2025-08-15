import React, { useEffect, useState } from 'react';
import { playlist, type PlaylistItem } from '@/services/playlist';
import { videosAPI, downloadFile, formatTimestamp } from '@/services/api';
import { Trash2, Download, ExternalLink } from 'lucide-react';

const PlaylistPage: React.FC = () => {
  const [items, setItems] = useState<PlaylistItem[]>(playlist.getAll());

  useEffect(() => {
    const onUpdate = () => setItems(playlist.getAll());
    window.addEventListener('playlist:updated', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('playlist:updated', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);

  const remove = (id: string) => playlist.remove(id);
  const clear = () => playlist.clear();

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
    const lines = items.map(it => {
      const start = `[${formatTimestamp(Math.floor(it.startSeconds || 0))}]`;
      const end = it.durationSeconds ? `[${formatTimestamp(Math.floor((it.startSeconds || 0) + (it.durationSeconds || 0)))}]` : '';
      const header = [start, end].filter(Boolean).join(' ');
      const urlBase = it.vimeoId ? `https://vimeo.com/${it.vimeoId}` : (it.vimeoEmbedUrl || it.videoUrl) || '';
      const h = it.text || it.label || '';
      let url = urlBase;
      if (urlBase.includes('vimeo.com')) {
        // vimeo fragment
        const s = Math.max(0, Math.floor(it.startSeconds || 0));
        const hh = Math.floor(s / 3600);
        const mm = Math.floor((s % 3600) / 60);
        const ss = s % 60;
        const frag = `${hh>0?hh+'h':''}${mm>0?mm+'m':''}${ss}s`;
        url = `${urlBase}#t=${frag}`;
      }
      return `${header} ${h}\n${url}`.trim();
    });
    const blob = new Blob([lines.join('\n\n') + '\n'], { type: 'text/plain;charset=utf-8' });
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

    for (const [videoId, arr] of byVideo.entries()) {
      const clipItems = arr.map(it => ({
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Playlist</h1>
          <div className="flex items-center gap-2">
            <button onClick={exportText} className="btn btn-outline"><Download className="h-4 w-4 mr-1" />Export Text</button>
            <button onClick={exportLinks} className="btn btn-outline"><ExternalLink className="h-4 w-4 mr-1" />Export Links</button>
            <button onClick={downloadClipsZip} className="btn btn-primary">Download Clips (per video)</button>
            <button onClick={clear} className="btn btn-outline text-red-600"><Trash2 className="h-4 w-4 mr-1" />Clear</button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-gray-500">Your playlist is empty.</div>
        ) : (
          <ul className="space-y-3">
            {items.map(it => (
              <li key={it.id} className="bg-white border border-gray-200 rounded-md p-4 flex items-start justify-between">
                <div className="pr-4">
                  <div className="text-sm text-gray-500 mb-1">{it.type.toUpperCase()} • Video #{it.videoId} • Added {new Date(it.addedAt).toLocaleString()}</div>
                  <div className="font-medium text-gray-900">{it.videoTitle}</div>
                  <div className="text-sm text-gray-700 mt-1">
                    {it.speaker && <span className="mr-2">{it.speaker}:</span>}
                    {it.text || it.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {it.date && <span className="mr-2">{String(it.date).slice(0,10)}</span>}
                    {it.place && <span className="mr-2">{it.place}</span>}
                    <span>[{formatTimestamp(Math.floor(it.startSeconds || 0))}{it.durationSeconds ? ` - ${formatTimestamp(Math.floor((it.startSeconds || 0) + (it.durationSeconds || 0)))}` : ''}]</span>
                  </div>
                </div>
                <button onClick={() => remove(it.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-5 w-5" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PlaylistPage;

