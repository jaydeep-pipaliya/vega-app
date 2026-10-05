import React, {useMemo, useState} from 'react';
import {Text, View} from 'react-native';
import {buildSegmentCells} from '../../../lib/downloadSegmentMap';
import {
  formatDownloadBytes,
  formatDownloadSpeed,
} from '../../../lib/downloadFormatting';
import type {DownloadConnectionDetails} from '../../../lib/zustand/downloadConnectionsStore';
import {useM3Colors} from '../../../theme/M3PaletteContext';

const COLUMNS = 20;
const ROWS = 6;
const GAP = 2;

/**
 * IDM-style view of one download: a map of the file where each box fills as
 * its bytes arrive, and the connections working on it.
 */
const DownloadConnectionsPanel = ({
  details,
  totalBytes,
  primary,
}: {
  details: DownloadConnectionDetails;
  totalBytes: number;
  primary: string;
}) => {
  const colors = useM3Colors();
  const [width, setWidth] = useState(0);
  const cells = useMemo(
    () => buildSegmentCells(totalBytes, details.ranges, COLUMNS * ROWS),
    [totalBytes, details.ranges],
  );
  const activeRanges = details.ranges.filter(range => range.active);
  const cellSize = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;

  return (
    <View
      testID="download-connections-panel"
      className="mt-3 p-3"
      style={{backgroundColor: colors.surfaceContainer, borderRadius: 16}}>
      <View className="flex-row justify-between">
        <Text className="text-xs" style={{color: colors.onSurfaceVariant}}>
          Connections
        </Text>
        <Text
          className="text-xs font-semibold"
          style={{color: colors.onSurface}}>
          {details.connections} active · limit {details.connectionLimit}
        </Text>
      </View>

      <View
        className="mt-3 flex-row flex-wrap"
        style={{gap: GAP}}
        onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        {cellSize > 0 &&
          cells.map((cell, index) => (
            <View
              key={index}
              style={{
                width: cellSize,
                height: cellSize,
                borderRadius: 2,
                overflow: 'hidden',
                justifyContent: 'flex-end',
                borderWidth: cell.active ? 1 : 0,
                borderColor: colors.tertiary,
              }}>
              {/* Faded layer so boxes with nothing downloaded stay visible on
                  any theme, including ones where the surface tones match. */}
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  backgroundColor: colors.onSurface,
                  opacity: 0.12,
                }}
              />
              <View
                style={{
                  height: `${cell.fill * 100}%`,
                  backgroundColor: cell.active ? colors.tertiary : primary,
                }}
              />
            </View>
          ))}
      </View>

      {activeRanges.length > 0 && (
        <View className="mt-3 gap-1.5">
          {activeRanges.map((range, index) => (
            <View key={range.start} className="flex-row items-center">
              <Text
                className="w-6 text-xs font-semibold"
                style={{color: colors.tertiary}}>
                {index + 1}
              </Text>
              <Text
                className="flex-1 text-xs"
                numberOfLines={1}
                style={{color: colors.onSurfaceVariant}}>
                {formatDownloadBytes(range.start)} ·{' '}
                {formatDownloadBytes(range.end - range.start)} left
              </Text>
              <Text className="text-xs" style={{color: colors.onSurface}}>
                {formatDownloadSpeed(range.speed)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default DownloadConnectionsPanel;
