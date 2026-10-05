import React, {useMemo, useState} from 'react';
import SettingsSection from '../../../components/ui/SettingsSection';
import SettingsSliderRow from '../../../components/ui/SettingsSliderRow';
import SettingsSwitchRow from '../../../components/ui/SettingsSwitchRow';
import {syncParallelStreaming} from '../../../lib/parallelStreaming';
import {getSafeBufferTotalMB} from '../../../lib/deviceMemory';
import {BUFFER_LIMITS, settingsStorage} from '../../../lib/storage';

const formatSize = (mb: number) => (mb === 0 ? 'Off' : `${mb} MB`);

/**
 * Player forward and back buffer sizes, capped together at what this device
 * can safely hold. Applies from the next video.
 */
const BufferPreference = () => {
  const safeTotal = useMemo(getSafeBufferTotalMB, []);
  const [parallelStreaming, setParallelStreaming] = useState(() =>
    settingsStorage.getParallelStreaming(),
  );
  const [back, setBack] = useState(() =>
    Math.min(
      settingsStorage.getBackBufferMB(),
      safeTotal - BUFFER_LIMITS.forwardMin,
    ),
  );
  // Forward always leaves one step for the back slider, so neither slider
  // ever collapses to an empty range.
  const forwardLimit = (backMB: number) =>
    Math.min(
      BUFFER_LIMITS.forwardMax,
      safeTotal - Math.max(backMB, BUFFER_LIMITS.step),
    );
  const [forward, setForward] = useState(() =>
    Math.min(settingsStorage.getForwardBufferMB(), forwardLimit(back)),
  );

  const forwardMax = forwardLimit(back);
  const backMax = Math.min(BUFFER_LIMITS.backMax, safeTotal - forward);

  return (
    <SettingsSection title="Buffering">
      <SettingsSliderRow
        title="Forward buffer"
        description={`Memory for video loaded ahead of playback. This device: up to ${safeTotal} MB for both buffers`}
        icon="fast-forward"
        value={forward}
        min={BUFFER_LIMITS.forwardMin}
        max={forwardMax}
        step={BUFFER_LIMITS.step}
        valueDisplay={formatSize(forward)}
        widestValue={formatSize(BUFFER_LIMITS.forwardMax)}
        onValueChange={next => {
          setForward(next);
          settingsStorage.setForwardBufferMB(next);
        }}
      />
      <SettingsSliderRow
        title="Back buffer"
        description="Memory for already-played video, for instant rewind"
        icon="rewind"
        value={back}
        min={0}
        max={backMax}
        step={BUFFER_LIMITS.step}
        valueDisplay={formatSize(back)}
        widestValue={formatSize(BUFFER_LIMITS.backMax)}
        onValueChange={next => {
          setBack(next);
          settingsStorage.setBackBufferMB(next);
        }}
      />
      <SettingsSwitchRow
        title="Faster playback on slow servers"
        description="When one connection is slower than 1.5 MB/s, loads the next part of the video over up to 4 connections. Direct video links only, not HLS"
        value={parallelStreaming}
        divider={false}
        onValueChange={enabled => {
          setParallelStreaming(enabled);
          settingsStorage.setParallelStreaming(enabled);
          syncParallelStreaming(enabled);
        }}
      />
    </SettingsSection>
  );
};

export default BufferPreference;
