import ytdl from 'ytdl-core';

const MAX_YOUTUBE_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_YOUTUBE_DURATION_SECONDS = 20 * 60;

interface DownloadedYouTubeAudio {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export class YouTubeService {
  isSupportedUrl(url: string) {
    return ytdl.validateURL(url);
  }

  async downloadAudio(url: string): Promise<DownloadedYouTubeAudio> {
    if (!this.isSupportedUrl(url)) {
      throw new Error('Invalid YouTube URL');
    }

    const info = await ytdl.getInfo(url);
    const durationSeconds = Number(info.videoDetails.lengthSeconds || 0);
    if (durationSeconds > MAX_YOUTUBE_DURATION_SECONDS) {
      throw new Error('YouTube video exceeds the 20 minute limit');
    }

    const audioFormats = info.formats
      .filter((format) => format.hasAudio && !format.hasVideo)
      .sort((left, right) => {
        const leftLength = Number(left.contentLength || Number.MAX_SAFE_INTEGER);
        const rightLength = Number(right.contentLength || Number.MAX_SAFE_INTEGER);
        if (leftLength !== rightLength) return leftLength - rightLength;
        return (left.audioBitrate || 0) - (right.audioBitrate || 0);
      });

    const selectedFormat = audioFormats.find((format) => Number(format.contentLength || 0) > 0 && Number(format.contentLength) <= MAX_YOUTUBE_AUDIO_BYTES)
      ?? audioFormats[0];

    if (!selectedFormat) {
      throw new Error('No downloadable audio stream found for this YouTube video');
    }

    const expectedBytes = Number(selectedFormat.contentLength || 0);
    if (expectedBytes > MAX_YOUTUBE_AUDIO_BYTES) {
      throw new Error('YouTube audio exceeds the 25 MB processing limit');
    }

    const stream = ytdl.downloadFromInfo(info, {
      quality: selectedFormat.itag,
      filter: 'audioonly',
      highWaterMark: 1 << 25,
    });

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_YOUTUBE_AUDIO_BYTES) {
          stream.destroy(new Error('YouTube audio exceeds the 25 MB processing limit'));
          return;
        }
        chunks.push(chunk);
      });
      stream.on('end', () => resolve());
      stream.on('error', (error) => reject(error));
    });

    const mimeType = selectedFormat.mimeType?.split(';')[0] || 'audio/webm';
    const extension = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('mpeg') ? 'mp3' : 'webm';
    const safeTitle = info.videoDetails.title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 80) || 'youtube_audio';

    return {
      buffer: Buffer.concat(chunks),
      originalName: `${safeTitle}.${extension}`,
      mimeType,
    };
  }
}

export const youTubeService = new YouTubeService();
