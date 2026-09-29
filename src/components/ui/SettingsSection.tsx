import React, {ReactNode} from 'react';
import {View} from 'react-native';
import Surface from './Surface';
import AppText from './Text';
import {isTV} from '../../lib/tv';

interface SettingsSectionProps {
  title: string;
  children: ReactNode;
}

const SettingsSection = ({title, children}: SettingsSectionProps) => (
  <View className="mb-6">
    <AppText role="labelLarge" className="mb-3 text-m3-on-surface-variant">
      {title}
    </AppText>
    <Surface level="low" className={isTV ? undefined : 'overflow-hidden'}>
      {children}
    </Surface>
  </View>
);

export default SettingsSection;
