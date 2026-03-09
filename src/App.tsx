import { useState, useRef } from 'react';
import './App.css';

type Direction = 'tw-en' | 'en-tw';
type InputMode = 'text' | 'audio';

const API_BASE = import.meta.env.VITE_API_URL || '';

function App() {
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [direction, setDirection] = useState<Direction>('tw-en');
  const [textInput, setTextInput] = useState('');
  const [result, setResult] = useState<{
    transcribed?: string;
    translated: string;
    source: string;
    target: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [copiedField, setCopiedField] = useState<'transcribed' | 'translated' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleTranslate = async () => {
    if (!textInput.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput, direction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed');
      setResult({ translated: data.translated, source: data.source, target: data.target });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Translation failed';
      if (msg.includes('API_KEY') && msg.includes('not set')) {
        setError(`${msg} Add it to your .env file. See README for setup.`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const startRecording = () => {
    chunksRef.current = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await sendAudio(blob);
      };
      recorder.start();
      setIsRecording(true);
    }).catch((err) => setError(err.message));
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const copyToClipboard = async (text: string, field: 'transcribed' | 'translated') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      setError('Could not copy to clipboard');
    }
  };

  const sendAudio = async (blob: Blob) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('direction', direction);
      const res = await fetch(`${API_BASE}/api/transcribe`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed');
      setResult({
        transcribed: data.transcribed,
        translated: data.translated,
        source: data.source,
        target: data.target,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed';
      if (msg.includes('API_KEY') && msg.includes('not set')) {
        setError(`${msg} Add it to your .env file. See README for setup.`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) sendAudio(file);
    e.target.value = '';
  };

  return (
    <div className="app">
      <header>
        <h1>Twi ↔ English</h1>
        <p className="subtitle">Translate text or transcribe audio between Twi and English</p>
      </header>

      <div className="controls">
        <div className="mode-toggle">
          <button
            className={inputMode === 'text' ? 'active' : ''}
            onClick={() => setInputMode('text')}
          >
            Text
          </button>
          <button
            className={inputMode === 'audio' ? 'active' : ''}
            onClick={() => setInputMode('audio')}
          >
            Audio
          </button>
        </div>
        <div className="direction-toggle">
          <button
            className={direction === 'tw-en' ? 'active' : ''}
            onClick={() => setDirection('tw-en')}
          >
            Twi → English
          </button>
          <button
            className={direction === 'en-tw' ? 'active' : ''}
            onClick={() => setDirection('en-tw')}
          >
            English → Twi
          </button>
        </div>
      </div>

      <main>
        {inputMode === 'text' ? (
          <div className="text-input-section">
            <textarea
              placeholder={direction === 'tw-en' ? 'Type or paste Twi text...' : 'Type or paste English text...'}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              rows={4}
            />
            <button onClick={handleTranslate} disabled={loading || !textInput.trim()}>
              {loading ? 'Translating...' : 'Translate'}
            </button>
          </div>
        ) : (
          <div className="audio-input-section">
            {isRecording && (
              <div className="recording-indicator">
                <span className="recording-dot" />
                Recording... Click Stop when done.
              </div>
            )}
            <div className="audio-actions">
              <button onClick={startRecording} disabled={loading || isRecording}>
                Record
              </button>
              <button onClick={stopRecording} disabled={loading || !isRecording}>
                Stop
              </button>
              <label className="file-upload">
                <input type="file" accept="audio/*" onChange={handleFileUpload} disabled={loading || isRecording} />
                Upload audio
              </label>
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}
        {result && (
          <div className="result">
            {result.transcribed ? (
              <div className="transcribed">
                <strong>Transcribed:</strong> {result.transcribed}
                <button
                  type="button"
                  className="copy-btn"
                  onClick={() => copyToClipboard(result.transcribed!, 'transcribed')}
                  title="Copy transcribed text"
                >
                  {copiedField === 'transcribed' ? 'Copied' : 'Copy'}
                </button>
              </div>
            ) : 'transcribed' in result && (
              <div className="transcribed empty">No speech detected. Try again with clearer audio.</div>
            )}
            <div className="translated">
              <strong>Translation:</strong> {result.translated}
              <button
                type="button"
                className="copy-btn"
                onClick={() => copyToClipboard(result.translated, 'translated')}
                title="Copy translation"
              >
                {copiedField === 'translated' ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
