import {useState} from 'react';
export function useControlVisibility(external: boolean | undefined, initial: boolean) {
  const [visible, setVisible] = useState(external ?? initial);
  const [previousExternal, setPreviousExternal] = useState(external);
  // Apply parent changes before children commit; local timeouts still notify
  // the parent when its external value has not changed.
  if (external !== previousExternal) {
    setPreviousExternal(external);
    if (typeof external === 'boolean') setVisible(external);
  }
  return [visible, setVisible] as const;
}
