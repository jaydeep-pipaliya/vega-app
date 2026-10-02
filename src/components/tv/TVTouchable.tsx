import React, {useState} from 'react';
import {
  Pressable,
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
} from 'react-native';
import {isTV, TV_FOCUS_BORDER_WIDTH} from '../../lib/tv/constants';

export interface TVTouchableProps extends TouchableOpacityProps {
  className?: string;
  focusBorderColor?: string;
  focusBorderRadius?: number;
  hasTVPreferredFocus?: boolean;
}

/**
 * Drop-in TouchableOpacity that shows a focus ring on TV.
 *
 * Uses no theme or navigation context, so it also works inside error
 * boundaries and dialogs mounted outside the providers.
 */
const TVTouchable = ({
  children,
  style,
  focusBorderColor = '#FFFFFF',
  focusBorderRadius = 8,
  activeOpacity,
  onFocus,
  onBlur,
  ...props
}: TVTouchableProps) => {
  const [focused, setFocused] = useState(false);

  if (!isTV) {
    return (
      <TouchableOpacity
        {...props}
        activeOpacity={activeOpacity}
        onFocus={onFocus}
        onBlur={onBlur}
        style={style}>
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <Pressable
      {...(props as any)}
      // Keep a focused button focusable when it turns disabled, or focus is
      // lost. Presses stay blocked.
      disabled={props.disabled && !focused}
      onPress={props.disabled ? undefined : props.onPress}
      onLongPress={props.disabled ? undefined : props.onLongPress}
      focusable={!props.disabled || focused}
      onFocus={event => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={event => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={style}>
      {children}
      {focused ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: focusBorderRadius,
            borderWidth: TV_FOCUS_BORDER_WIDTH,
            borderColor: focusBorderColor,
          }}
        />
      ) : null}
    </Pressable>
  );
};

export default TVTouchable;
