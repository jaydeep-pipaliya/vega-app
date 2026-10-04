import React, {useMemo, useState} from 'react';
import SettingsSection from '../../../components/ui/SettingsSection';
import SettingsSliderRow from '../../../components/ui/SettingsSliderRow';
import {getSafeBufferTotalMB} from '../../../lib/deviceMemory';
import {BUFFER_LIMITS, settingsStorage} from '../../../lib/storage';

const formatSize = (mb: number) => (mb === 0 ? 'Off' : `${mb} MB`);

/**
 * Player forward and back buffer sizes, capped together at what this device
 * can safely hold. Applies from the next video.
 */
const BufferPreference = () => {
  const safeTotal = useMemo(getSafeBufferTotalMB, []);
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
        divider={false}
        onValueChange={next => {
          setBack(next);
          settingsStorage.setBackBufferMB(next);
        }}
      />
    </SettingsSection>
  );
};

export default BufferPreference;
