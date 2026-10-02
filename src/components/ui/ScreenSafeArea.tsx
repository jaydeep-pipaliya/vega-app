import React from 'react';
import {SafeAreaView, type SafeAreaViewProps} from 'react-native-safe-area-context';
import {isTV} from '../../lib/tv';

// Standard pages keep controls below the status bar. The tab bar owns the
// bottom inset; full-screen artwork and players handle their own overlays.
const ScreenSafeArea = ({style, ...props}: SafeAreaViewProps) => (
  <SafeAreaView
    {...props}
    edges={isTV ? [] : ['top', 'left', 'right']}
    style={[{flex: 1}, style]}
  />
);

export default ScreenSafeArea;
