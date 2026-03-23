import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024;

interface UseRecordingOptions {
  onRecordingComplete: (blob: Blob) => void;
}

export function useRecording({ onRecordingComplete }: UseRecordingOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onCompleteRef = useRef(onRecordingComplete);
  onCompleteRef.current = onRecordingComplete;

  useEffect(() => {
    if (!isRecording) return;
    const interval = window.setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  const startRecording = useCallback(() => {
    setRecordingError(null);
    chunksRef.current = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      setActiveStream(stream);
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setIsRecording(false);
        setRecordingDuration(0);
        setActiveStream(null);
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onCompleteRef.current(blob);
      };
      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
    }).catch((err) => setRecordingError(err instanceof Error ? err.message : 'Microphone access denied'));
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setRecordingError('Only audio files are supported.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      setRecordingError('Audio file exceeds the 25 MB limit.');
      event.target.value = '';
      return;
    }

    onCompleteRef.current(file);
    event.target.value = '';
  }, []);

  const clearError = useCallback(() => setRecordingError(null), []);

  return {
    isRecording,
    recordingDuration,
    recordingError,
    activeStream,
    startRecording,
    stopRecording,
    handleFileUpload,
    clearError,
  };
}
