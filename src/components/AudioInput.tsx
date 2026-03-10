import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Upload, Scissors, Play, Pause, Link2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import WaveSurfer from 'wavesurfer.js';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface AudioInputProps {
  isRecording: boolean;
  recordingDuration?: number;
  loading: boolean;
  canTrim?: boolean;
  youtubeUrl?: string;
  onYoutubeUrlChange?: (value: string) => void;
  onTranscribeUrl?: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSendTrimmed?: (blob: Blob) => void;
}

export function AudioInput({
  isRecording,
  recordingDuration = 0,
  loading,
  canTrim = false,
  youtubeUrl = '',
  onYoutubeUrlChange,
  onTranscribeUrl,
  onStartRecording,
  onStopRecording,
  onFileUpload,
  onSendTrimmed,
}: AudioInputProps) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(100);
  const [duration, setDuration] = useState(0);

  const destroyWavesurfer = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }
    setIsPlaying(false);
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(100);
  }, []);

  useEffect(() => {
    return () => destroyWavesurfer();
  }, [destroyWavesurfer]);

  const loadAudioForTrim = useCallback((file: File) => {
    destroyWavesurfer();
    setAudioFile(file);

    if (!waveRef.current) return;

    const ws = WaveSurfer.create({
      container: waveRef.current,
      waveColor: 'rgba(79, 70, 229, 0.4)',
      progressColor: 'rgba(79, 70, 229, 0.8)',
      cursorColor: 'var(--color-highlight)',
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      backend: 'WebAudio',
    });

    ws.on('ready', () => {
      setDuration(ws.getDuration());
    });
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));

    ws.loadBlob(file);
    wsRef.current = ws;
  }, [destroyWavesurfer]);

  const handleTrimFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('audio/')) return;
    loadAudioForTrim(file);
    e.target.value = '';
  };

  const handleTrimAndSend = async () => {
    if (!audioFile || !onSendTrimmed) return;

    const ctx = new AudioContext();
    const arrayBuf = await audioFile.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuf);

    const startSec = (trimStart / 100) * audioBuffer.duration;
    const endSec = (trimEnd / 100) * audioBuffer.duration;
    const trimDuration = endSec - startSec;

    if (trimDuration < 0.5) return;

    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      Math.ceil(trimDuration * audioBuffer.sampleRate),
      audioBuffer.sampleRate
    );

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0, startSec, trimDuration);

    const rendered = await offlineCtx.startRendering();

    const wavBlob = audioBufferToWav(rendered);
    destroyWavesurfer();
    setAudioFile(null);
    onSendTrimmed(wavBlob);
    await ctx.close();
  };

  const cancelTrim = () => {
    destroyWavesurfer();
    setAudioFile(null);
  };

  const togglePlayback = () => {
    if (!wsRef.current) return;
    wsRef.current.playPause();
  };

  if (canTrim && audioFile) {
    return (
      <motion.div key="trim-section" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="audio-card">
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Trim audio
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-tertiary)' }}>
              {duration > 0 ? formatDuration(Math.round(duration)) : ''}
            </span>
          </div>
          <div ref={waveRef} style={{ borderRadius: '12px', overflow: 'hidden', background: 'var(--color-surface)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-tertiary)' }}>Start {Math.round(trimStart)}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={trimStart}
              onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd - 1))}
              style={{ accentColor: 'var(--color-highlight)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-tertiary)' }}>End {Math.round(trimEnd)}%</span>
            <input
              type="range"
              min={0}
              max={100}
              value={trimEnd}
              onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart + 1))}
              style={{ accentColor: 'var(--color-highlight)' }}
            />
          </label>
        </div>

        <div className="audio-buttons">
          <motion.button type="button" className="secondary-btn" onClick={togglePlayback} whileTap={{ scale: 0.96 }}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            {isPlaying ? 'Pause' : 'Preview'}
          </motion.button>
          <motion.button
            type="button"
            className="secondary-btn"
            onClick={handleTrimAndSend}
            disabled={loading}
            whileTap={{ scale: 0.96 }}
          >
            <Scissors size={18} />
            Trim & Translate
          </motion.button>
          <motion.button type="button" className="secondary-btn" onClick={cancelTrim} whileTap={{ scale: 0.96 }} style={{ color: 'var(--color-muted)' }}>
            Cancel
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div key="audio-section" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="audio-card">
      <div className="recording-status">
        <div className={cn('mic-orb', isRecording && 'recording')}>
          {isRecording ? <Square size={28} /> : <Mic size={28} />}
        </div>
        {isRecording && (
          <motion.div id="recording-indicator" className="recording-label" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.5, repeat: Infinity }}>
            Listening... {formatDuration(recordingDuration)}
          </motion.div>
        )}
      </div>
      <div className="audio-buttons">
        {!isRecording ? (
          <motion.button
            id="start-record-btn"
            type="button"
            className={`secondary-btn ${loading ? 'loading' : ''}`}
            onClick={onStartRecording}
            disabled={loading}
            whileTap={{ scale: 0.96 }}
            whileHover={!loading ? { scale: 1.02 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Mic size={18} />
            Start Record
          </motion.button>
        ) : (
          <motion.button
            id="stop-record-btn"
            type="button"
            className="secondary-btn"
            onClick={onStopRecording}
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Square size={18} />
            Stop & Translate
          </motion.button>
        )}

        {canTrim ? (
        <motion.label
          className={`secondary-btn file-upload ${loading ? 'loading' : ''}`}
            whileTap={{ scale: 0.96 }}
            whileHover={!loading && !isRecording ? { scale: 1.02 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Scissors size={18} />
            Upload & Trim
            <input type="file" accept="audio/*" onChange={handleTrimFileSelect} style={{ display: 'none' }} disabled={loading || isRecording} />
          </motion.label>
        ) : null}

        <motion.label
          id="upload-label"
          className={`secondary-btn file-upload ${loading ? 'loading' : ''}`}
          whileTap={{ scale: 0.96 }}
          whileHover={!loading && !isRecording ? { scale: 1.02 } : {}}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <Upload size={18} />
          Upload File
          <input id="audio-upload-input" type="file" accept="audio/*" onChange={onFileUpload} style={{ display: 'none' }} disabled={loading || isRecording} />
        </motion.label>
      </div>

      <div className="audio-url-box">
        <div className="audio-url-header">
          <span>YouTube link</span>
          <span>Paste a public video URL to transcribe</span>
        </div>
        <div className="audio-url-row">
          <div className="audio-url-input">
            <Link2 size={16} />
            <input
              type="url"
              value={youtubeUrl}
              onChange={(event) => onYoutubeUrlChange?.(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={loading || isRecording}
            />
          </div>
          <motion.button
            type="button"
            className={`secondary-btn ${loading ? 'loading' : ''}`}
            onClick={() => onTranscribeUrl?.()}
            disabled={loading || isRecording || !youtubeUrl.trim()}
            whileTap={{ scale: 0.96 }}
          >
            <Link2 size={18} />
            Transcribe Link
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  const length = channels[0].length;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = length * numChannels * (bitsPerSample / 8);
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}
