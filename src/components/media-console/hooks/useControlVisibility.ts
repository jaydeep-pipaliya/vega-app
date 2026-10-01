import {useEffect, useState} from 'react';

export function useControlVisibility(external: boolean | undefined, initial: boolean) {
  const [visible, setVisible] = useState(external ?? initial);
  // Only a new parent value overrides local taps/timeouts. Watching visible
  // here would undo auto-hide before the parent receives onHideControls.
  useEffect(() => {
    if (typeof external === 'boolean') setVisible(external);
  }, [external]);
  return [visible, setVisible] as const;
}
