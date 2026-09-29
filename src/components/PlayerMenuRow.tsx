import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, {useState} from 'react';
import {Pressable, Text, TouchableOpacity, View} from 'react-native';
import {useTVFocusBorderColor} from '../lib/tv/useTVFocusBorderColor';
import {isTV} from '../lib/tv/constants';

type PlayerMenuRowProps = {
  title: string;
  detail?: string;
  quality?: string;
  tags?: string[];
  selected?: boolean;
  accentColor: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  hasTVPreferredFocus?: boolean;
  onTVFocus?: () => void;
  onPress: () => void;
};

const PlayerMenuRow = React.forwardRef<View, PlayerMenuRowProps>(({
  title,
  detail,
  quality,
  tags,
  selected = false,
  accentColor,
  icon,
  hasTVPreferredFocus = false,
  onTVFocus,
  onPress,
}, ref) => {
  const focusBorderColor = useTVFocusBorderColor(accentColor);
  const [tvFocused, setTvFocused] = useState(false);
  const allTags = [
    ...(quality && quality.trim() ? [quality.trim()] : []),
    ...(tags || []),
  ];

  const content = (
    <>
      {icon && (
        <MaterialIcons
          name={icon}
          size={21}
          color={selected ? accentColor : 'rgba(255,255,255,0.78)'}
          style={{marginRight: 12}}
        />
      )}
      <View className="min-w-0 flex-1">
        <Text
          className="text-base font-semibold text-white"
          numberOfLines={1}>
          {title}
        </Text>
        {allTags.length > 0 && (
          <View className="flex-row items-center gap-1.5 flex-wrap mt-1">
            {allTags.map((t, idx) => (
              <View
                key={idx}
                className="rounded-md px-2 py-0.5"
                style={{backgroundColor: 'rgba(255,255,255,0.12)'}}>
                <Text className="text-[10px] font-bold text-white uppercase tracking-wider">
                  {t}
                </Text>
              </View>
            ))}
          </View>
        )}
        {!!detail && (
          <Text
            className="mt-0.5 text-xs text-white/55"
            numberOfLines={1}>
            {detail}
          </Text>
        )}
      </View>
      {selected && (
        <MaterialIcons
          name="check-circle"
          size={22}
          color={accentColor}
          style={{marginLeft: 12}}
        />
      )}
    </>
  );

  if (!isTV) {
    return (
      <TouchableOpacity
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityState={{selected}}
        className="mx-1 my-1 min-h-12 flex-row items-center rounded-xl px-3 py-2.5"
        style={{
          backgroundColor: selected
            ? 'rgba(255,255,255,0.11)'
            : 'rgba(255,255,255,0.045)',
          borderWidth: 1,
          borderColor: selected ? accentColor : 'rgba(255,255,255,0.07)',
        }}
        onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <Pressable
      ref={ref as any}
      accessibilityRole="button"
      accessibilityState={{selected}}
      focusable
      isTVSelectable
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={() => {
        setTvFocused(true);
        onTVFocus?.();
      }}
      onBlur={() => setTvFocused(false)}
      className="mx-1 my-1 min-h-12 flex-row items-center rounded-xl px-3 py-2.5"
      style={{
        backgroundColor: 'rgba(255,255,255,0.045)',
        borderWidth: tvFocused ? 2.5 : 1,
        borderColor: tvFocused ? focusBorderColor : 'rgba(255,255,255,0.07)',
      }}
      onPress={onPress}>
      {content}
    </Pressable>
  );
});

export default PlayerMenuRow;

