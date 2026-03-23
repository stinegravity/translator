import { useEffect, useRef } from 'react';

interface RecordingVisualizerProps {
  stream: MediaStream;
}

export function RecordingVisualizer({ stream }: RecordingVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stream) return;

    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        // Gradient color for a premium look
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#3b82f6'); // Blue
        gradient.addColorStop(1, '#60a5fa'); // Lighter blue

        ctx.fillStyle = gradient;
        
        // Rounded bars
        const radius = 2;
        const currentY = (canvas.height - barHeight) / 2;
        
        ctx.beginPath();
        ctx.roundRect(x, currentY, barWidth - 1, barHeight, radius);
        ctx.fill();

        x += barWidth;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      void audioContext.close();
    };
  }, [stream]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={60}
      style={{
        width: '200px',
        height: '60px',
        maxWidth: '100%',
      }}
    />
  );
}
