export const createGroupedDownloadId = (
  baseTitle: string,
  groupTitle: string,
  itemIndex: number,
): string => `${baseTitle}_S${groupTitle}_E${itemIndex + 1}`;

export const createSeriesDownloadId = createGroupedDownloadId;

export const createDirectDownloadId = (
  baseTitle: string,
  linkIndexOrGroupTitle: number | string,
  linkIndex?: number,
): string => {
  if (typeof linkIndexOrGroupTitle === 'number') {
    return `${baseTitle}_direct_${linkIndexOrGroupTitle}`;
  }
  if (typeof linkIndex === 'number') {
    return createGroupedDownloadId(
      baseTitle,
      linkIndexOrGroupTitle,
      linkIndex,
    );
  }
  return `${baseTitle}_direct_0`;
};

const MAX_FILE_NAME_LENGTH = 160;

export const sanitizeDownloadFileName = (value: string): string => {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|\[\]#%\x00-\x1f\x7f-\x9f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/g, '')
    .trim()
    .slice(0, MAX_FILE_NAME_LENGTH);

  return sanitized || 'download';
};

export const createDownloadFileName = (
  downloadId: string,
  episodeName?: string,
): string => sanitizeDownloadFileName(episodeName || downloadId);

export const createDownloadDirectoryName = (title: string): string =>
  sanitizeDownloadFileName(title);

export const createDownloadSeasonDirectoryName = (
  seasonTitle?: string,
): string | undefined =>
  seasonTitle ? createDownloadDirectoryName(seasonTitle) : undefined;

export const createDesktopCompatibleFileName = (
  title: string,
  type: 'movie' | 'series',
): string => sanitizeDownloadFileName(title);

export const createSubtitleFileName = (
  videoFileName: string,
  subtitleTitle: string,
): string =>
  `${sanitizeDownloadFileName(videoFileName)} - ${sanitizeDownloadFileName(
    subtitleTitle,
  )}`;

export const isSubtitleDownloadItem = (item?: {
  isSubtitle?: boolean;
  id?: string;
  videoType?: string | null;
  title?: string;
  displayFileName?: string;
  filePath?: string;
}): boolean => {
  if (!item) return false;
  if (item.isSubtitle) return true;
  if (item.id && item.id.includes('_subtitle_')) return true;
  const vt = (item.videoType || '').toLowerCase();
  if (
    vt === 'vtt' ||
    vt === 'srt' ||
    vt === 'subtitle' ||
    vt === 'text/vtt' ||
    vt === 'subrip' ||
    vt.includes('vtt') ||
    vt.includes('srt')
  ) {
    return true;
  }
  if (
    item.displayFileName?.endsWith('.vtt') ||
    item.displayFileName?.endsWith('.srt') ||
    item.filePath?.endsWith('.vtt') ||
    item.filePath?.endsWith('.srt')
  ) {
    return true;
  }
  return false;
};
