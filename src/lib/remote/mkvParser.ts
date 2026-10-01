import axios from 'axios';
import { RemoteAudioTrack, RemoteQuality, RemoteSubtitleTrack } from './types';

// Map 2-letter and 3-letter ISO language codes to human-readable names
const LANGUAGE_MAP: Record<string, string> = {
  hin: 'Hindi',
  hi: 'Hindi',
  eng: 'English',
  en: 'English',
  twi: 'Twi',
  tw: 'Twi',
  jpn: 'Japanese',
  ja: 'Japanese',
  spa: 'Spanish',
  es: 'Spanish',
  fre: 'French',
  fra: 'French',
  fr: 'French',
  ger: 'German',
  deu: 'German',
  de: 'German',
  ita: 'Italian',
  it: 'Italian',
  kor: 'Korean',
  ko: 'Korean',
  chi: 'Chinese',
  zho: 'Chinese',
  zh: 'Chinese',
  rus: 'Russian',
  ru: 'Russian',
  por: 'Portuguese',
  pt: 'Portuguese',
  tam: 'Tamil',
  ta: 'Tamil',
  tel: 'Telugu',
  te: 'Telugu',
  mal: 'Malayalam',
  ml: 'Malayalam',
  kan: 'Kannada',
  kn: 'Kannada',
  ben: 'Bengali',
  bn: 'Bengali',
  pan: 'Punjabi',
  pa: 'Punjabi',
  mar: 'Marathi',
  mr: 'Marathi',
  guj: 'Gujarati',
  gu: 'Gujarati',
  urd: 'Urdu',
  ur: 'Urdu',
  ara: 'Arabic',
  ar: 'Arabic',
  ind: 'Indonesian',
  id: 'Indonesian',
  tha: 'Thai',
  th: 'Thai',
  vie: 'Vietnamese',
  vi: 'Vietnamese',
  tur: 'Turkish',
  tr: 'Turkish',
};

function formatLanguageName(
  code?: string,
  fallbackIndex?: number,
  fallbackLabel = 'Audio Track',
): string {
  if (!code || code === 'und') {
    return fallbackIndex !== undefined ? `${fallbackLabel} ${fallbackIndex}` : 'Unknown';
  }
  const clean = code.toLowerCase().trim();
  return LANGUAGE_MAP[clean] || clean.toUpperCase();
}

function formatCodecName(codec?: string): string {
  if (!codec) return '';
  if (codec.includes('EAC3') || codec.includes('E-AC-3')) return 'E-AC-3';
  if (codec.includes('AAC')) return 'AAC';
  if (codec.includes('AC3')) return 'AC-3';
  if (codec.includes('DTS')) return 'DTS';
  if (codec.includes('TRUEHD')) return 'TrueHD';
  if (codec.includes('OPUS')) return 'Opus';
  if (codec.includes('VORBIS')) return 'Vorbis';
  if (codec.includes('FLAC')) return 'FLAC';
  if (codec.includes('MP3') || codec.includes('MPEG/L3')) return 'MP3';
  if (codec.includes('UTF8') || codec.includes('SUBRIP')) return 'SRT';
  if (codec.includes('ASS')) return 'ASS';
  if (codec.includes('SSA')) return 'SSA';
  if (codec.includes('PGS')) return 'PGS';
  if (codec.includes('VOBSUB')) return 'VobSub';
  if (codec.includes('AVC')) return 'H.264';
  if (codec.includes('HEVC')) return 'H.265';
  return codec.replace(/^[AVS]_/, '');
}

function readVint(bytes: Uint8Array, offset: number) {
  if (offset >= bytes.length) return null;
  const b = bytes[offset];
  let mask = 0x80;
  let len = 1;
  while ((b & mask) === 0 && len <= 8) {
    mask >>= 1;
    len++;
  }
  if (len > 8 || offset + len > bytes.length) return null;
  let val = 0;
  for (let i = 0; i < len; i++) {
    val = val * 256 + bytes[offset + i];
  }
  return { id: val, length: len };
}

function readVintDataSize(bytes: Uint8Array, offset: number) {
  if (offset >= bytes.length) return null;
  const b = bytes[offset];
  let mask = 0x80;
  let len = 1;
  while ((b & mask) === 0 && len <= 8) {
    mask >>= 1;
    len++;
  }
  if (len > 8 || offset + len > bytes.length) return null;
  let val = b & ~mask;
  for (let i = 1; i < len; i++) {
    val = val * 256 + bytes[offset + i];
  }
  return { size: val, length: len };
}

function readUint(bytes: Uint8Array, offset: number, length: number): number {
  let val = 0;
  for (let i = 0; i < length; i++) {
    val = val * 256 + bytes[offset + i];
  }
  return val;
}

function readUtf8(bytes: Uint8Array, offset: number, length: number): string {
  try {
    const slice = bytes.slice(offset, offset + length);
    // Simple ASCII / UTF-8 decode
    let s = '';
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 0) break;
      s += String.fromCharCode(slice[i]);
    }
    return s.trim();
  } catch {
    return '';
  }
}

function readFloat(bytes: Uint8Array, offset: number, length: number): number {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, length);
    if (length === 4) return view.getFloat32(0, false);
    if (length === 8) return view.getFloat64(0, false);
  } catch {}
  return 0;
}

export interface ParsedMkvResult {
  audioTracks: RemoteAudioTrack[];
  subtitleTracks: RemoteSubtitleTrack[];
  videoQualities: RemoteQuality[];
  durationSeconds: number;
  hasVideo: boolean;
}

export function parseMkvBuffer(bytes: Uint8Array, filenameOrUrl?: string): ParsedMkvResult {
  // 1. Scan for Info element (0x1549a966) to extract media duration
  let durationSeconds = 0;
  const infoId = [0x15, 0x49, 0xa9, 0x66];
  for (let i = 0; i <= bytes.length - 4; i++) {
    if (
      bytes[i] === infoId[0] &&
      bytes[i + 1] === infoId[1] &&
      bytes[i + 2] === infoId[2] &&
      bytes[i + 3] === infoId[3]
    ) {
      let offset = i + 4;
      const sizeInfo = readVintDataSize(bytes, offset);
      if (sizeInfo) {
        offset += sizeInfo.length;
        const infoEnd = Math.min(offset + sizeInfo.size, bytes.length);
        let timecodeScale = 1000000; // default 1ms (1,000,000 ns)
        let rawDuration = 0;
        while (offset < infoEnd) {
          const elemId = readVint(bytes, offset);
          if (!elemId) break;
          offset += elemId.length;
          const elemSize = readVintDataSize(bytes, offset);
          if (!elemSize) break;
          offset += elemSize.length;
          const dataLen = Math.min(elemSize.size, bytes.length - offset);
          if (elemId.id === 0x2ad7b1) {
            timecodeScale = readUint(bytes, offset, dataLen) || 1000000;
          } else if (elemId.id === 0x4489) {
            rawDuration = readFloat(bytes, offset, dataLen);
          }
          offset += elemSize.size;
        }
        if (rawDuration > 0) {
          durationSeconds = (rawDuration * timecodeScale) / 1_000_000_000.0;
        }
      }
      break;
    }
  }

  const tracksId = [0x16, 0x54, 0xae, 0x6b];

  // Find Tracks element (ignore early seekhead candidate if near byte 0-100)
  let tracksOffset = -1;
  for (let i = 0; i <= bytes.length - 4; i++) {
    if (
      bytes[i] === tracksId[0] &&
      bytes[i + 1] === tracksId[1] &&
      bytes[i + 2] === tracksId[2] &&
      bytes[i + 3] === tracksId[3]
    ) {
      if (i > 100) {
        tracksOffset = i;
        break;
      }
    }
  }

  // Fallback: take any occurrence
  if (tracksOffset === -1) {
    for (let i = 0; i <= bytes.length - 4; i++) {
      if (
        bytes[i] === tracksId[0] &&
        bytes[i + 1] === tracksId[1] &&
        bytes[i + 2] === tracksId[2] &&
        bytes[i + 3] === tracksId[3]
      ) {
        tracksOffset = i;
        break;
      }
    }
  }

  if (tracksOffset === -1) {
    return { audioTracks: [], subtitleTracks: [], videoQualities: [], durationSeconds, hasVideo: false };
  }

  let offset = tracksOffset + 4;
  const sizeInfo = readVintDataSize(bytes, offset);
  if (!sizeInfo) {
    return { audioTracks: [], subtitleTracks: [], videoQualities: [], durationSeconds, hasVideo: false };
  }
  offset += sizeInfo.length;
  const tracksEnd = Math.min(offset + sizeInfo.size, bytes.length);

  const rawEntries: any[] = [];

  while (offset < tracksEnd) {
    const elemId = readVint(bytes, offset);
    if (!elemId) break;
    offset += elemId.length;

    const elemSize = readVintDataSize(bytes, offset);
    if (!elemSize) break;
    offset += elemSize.length;

    const nextElem = offset + elemSize.size;

    if (elemId.id === 0xae) {
      // TrackEntry
      const track: any = {};
      let entryOffset = offset;
      while (entryOffset < nextElem && entryOffset < bytes.length) {
        const subId = readVint(bytes, entryOffset);
        if (!subId) break;
        entryOffset += subId.length;

        const subSize = readVintDataSize(bytes, entryOffset);
        if (!subSize) break;
        entryOffset += subSize.length;

        const dataEnd = Math.min(entryOffset + subSize.size, bytes.length);
        const dataLen = dataEnd - entryOffset;

        if (subId.id === 0xd7) {
          track.number = readUint(bytes, entryOffset, dataLen);
        } else if (subId.id === 0x83) {
          track.type = readUint(bytes, entryOffset, dataLen); // 1=video, 2=audio, 17=sub
        } else if (subId.id === 0x86) {
          track.codec = readUtf8(bytes, entryOffset, dataLen);
        } else if (subId.id === 0x22b59c) {
          track.language = readUtf8(bytes, entryOffset, dataLen);
        } else if (subId.id === 0x536e) {
          track.name = readUtf8(bytes, entryOffset, dataLen);
        } else if (subId.id === 0xe0) {
          // Video settings
          let vOff = entryOffset;
          while (vOff < dataEnd) {
            const vidId = readVint(bytes, vOff);
            if (!vidId) break;
            vOff += vidId.length;
            const vidSize = readVintDataSize(bytes, vOff);
            if (!vidSize) break;
            vOff += vidSize.length;
            const vdLen = Math.min(vidSize.size, dataEnd - vOff);
            if (vidId.id === 0xb0) track.width = readUint(bytes, vOff, vdLen);
            if (vidId.id === 0xba) track.height = readUint(bytes, vOff, vdLen);
            vOff += vidSize.size;
          }
        } else if (subId.id === 0xe1) {
          // Audio settings
          let aOff = entryOffset;
          while (aOff < dataEnd) {
            const aid = readVint(bytes, aOff);
            if (!aid) break;
            aOff += aid.length;
            const aSize = readVintDataSize(bytes, aOff);
            if (!aSize) break;
            aOff += aSize.length;
            const adLen = Math.min(aSize.size, dataEnd - aOff);
            if (aid.id === 0x9f) track.channels = readUint(bytes, aOff, adLen);
            aOff += aSize.size;
          }
        }

        entryOffset = dataEnd;
      }
      rawEntries.push(track);
    }

    offset = nextElem;
  }

  // Process tracks into structured Vega Remote types
  const audioTracks: RemoteAudioTrack[] = [];
  const subtitleTracks: RemoteSubtitleTrack[] = [];
  const videoQualities: RemoteQuality[] = [];
  let hasVideo = false;

  const rawAudios = rawEntries.filter(e => e.type === 2);
  const isDualOrMulti = rawAudios.length > 1;
  const isHinEngRelease = /hin[-_.]?eng/i.test(filenameOrUrl || '');

  rawEntries.forEach((entry, idx) => {
    // 1. Video
    if (entry.type === 1) {
      hasVideo = true;
      if (entry.height) {
        const res = `${entry.height}p`;
        videoQualities.push({
          id: String(entry.number || idx),
          label: res,
          width: entry.width || undefined,
          height: entry.height,
          resolution: res,
        });
      }
    }

    // 2. Audio
    if (entry.type === 2) {
      const audioIdx = audioTracks.length;
      let langCode = entry.language && entry.language !== 'und' ? entry.language : '';

      // Infer missing language for dual-audio releases
      if (!langCode && isDualOrMulti) {
        if (audioIdx === 0 && isHinEngRelease) {
          langCode = 'hin';
        } else if (audioIdx === 1 && isHinEngRelease) {
          langCode = 'eng';
        } else if (audioIdx === 1 && audioTracks[0]?.language === 'hin') {
          langCode = 'eng';
        }
      }

      const langName = formatLanguageName(langCode, audioIdx + 1);
      const friendlyCodec = formatCodecName(entry.codec);
      const channelStr = entry.channels === 6 ? '5.1' : entry.channels === 2 ? '2.0' : entry.channels ? `${entry.channels}ch` : '';

      // Filter out promotional/watermark track names like "1VegaMovies.tw"
      const rawName = entry.name?.trim() || '';
      const isWatermark = /vegamovies|hubcloud|1vega|\.tw|\.com|\.org/i.test(rawName);
      const trackTitle = !isWatermark && rawName ? rawName : langName;

      audioTracks.push({
        id: `audio_${entry.number ?? audioIdx}`,
        index: audioIdx,
        language: langCode || 'und',
        title: channelStr ? `${trackTitle} (${channelStr})` : trackTitle,
        codec: [friendlyCodec, channelStr].filter(Boolean).join(' '),
        channels: entry.channels || 2,
        isSelected: audioIdx === 0,
      });
    }

    // 3. Subtitles
    if (entry.type === 17 || entry.type === 0x11) {
      const subIdx = subtitleTracks.length;
      const rawName = entry.name?.trim() || '';
      const isWatermark = /vegamovies|hubcloud|1vega|\.tw|\.com|\.org/i.test(rawName);

      // Matroska defaults a missing Language element to English, as ExoPlayer does.
      const language = entry.language === undefined ? 'eng' : entry.language;
      const langCode = language && language !== 'und' ? language : '';

      const langName = formatLanguageName(langCode, subIdx + 1, 'Subtitle');
      const subTitle = !isWatermark && rawName ? rawName : langCode ? `${langName} (Embedded)` : langName;

      subtitleTracks.push({
        id: `sub_mkv_${entry.number ?? subIdx}`,
        index: subIdx,
        language: langCode || 'und',
        title: subTitle,
        isEmbedded: true,
      });
    }
  });

  return { audioTracks, subtitleTracks, videoQualities, durationSeconds, hasVideo };
}

/**
 * Fetch and parse MKV header via HTTP Range request (first 64KB, or up to 256KB if duration is missing) using axios arraybuffer
 */
export async function fetchAndParseMkvHeader(
  url: string,
  headers?: Record<string, string>,
  maxBytes = 65536,
): Promise<ParsedMkvResult | null> {
  const controller = new AbortController();
  try {
    const res = await axios.get(url, {
      headers: {
        ...headers,
        Range: `bytes=0-${maxBytes - 1}`,
      },
      responseType: 'arraybuffer',
      timeout: 8000,
      signal: controller.signal,
      // A server that ignores Range would otherwise send the whole film;
      // XHR buffers the full body before the status is checked.
      onDownloadProgress: event => {
        if (event.loaded > maxBytes * 2) controller.abort();
      },
      validateStatus: status => status === 206,
    });

    if (!res.data || res.data.byteLength === 0) {
      return null;
    }

    const bytes = new Uint8Array(res.data);
    const parsed = parseMkvBuffer(bytes, url);
    // If Duration wasn't found in first 64KB, try a fast 256KB probe before giving up
    if (parsed && parsed.durationSeconds === 0 && maxBytes === 65536) {
      try {
        const extended = await fetchAndParseMkvHeader(url, headers, 262144);
        if (extended && extended.durationSeconds > 0) {
          return extended;
        }
      } catch {}
    }
    return parsed;
  } catch (e: any) {
    console.warn('Direct MKV EBML parse failed via axios:', e?.message || e);
    return null;
  }
}
