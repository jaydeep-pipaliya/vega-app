import React, {ReactNode, RefObject, useState} from 'react';
import {Platform, StyleSheet, TouchableHighlight, TouchableHighlightProps} from 'react-native';
import {styles} from './styles';
import {useTVFocusBorderColor} from '../../../lib/tv/useTVFocusBorderColor';

interface ControlProps extends Omit<TouchableHighlightProps, 'children'> {
  children: ReactNode;
  callback?: () => void;
  controlRef?: RefObject<any>;
  disabled?: boolean;
  style?: any;
  resetControlTimeout?: () => void;
}

export const Control = ({
  children,
  callback,
  controlRef,
  disabled,
  style = {},
  resetControlTimeout,
  ...props
}: ControlProps) => {
  const focusBorderColor = useTVFocusBorderColor();
  const [focused, setFocused] = useState(false);

  const setFocusedState = () => setFocused(true);
  const cancelFocusedState = () => setFocused(false);

  const flattenedStyle = StyleSheet.flatten(style) || {};
  const borderRadius =
    flattenedStyle.borderRadius !== undefined
      ? flattenedStyle.borderRadius
      : 20;

  const focusedStyle = focused && Platform.isTV
    ? {
        borderColor: focusBorderColor,
        borderWidth: 2.5,
        borderRadius,
        backgroundColor: 'rgba(255, 255, 255, 0.16)',
        transform: [{scale: 1.18}],
        opacity: 1,
      }
    : focused ? {opacity: 1} : {};

  return (
    <TouchableHighlight
      focusable={Platform.isTV ? !disabled : undefined}
      {...(Platform.isTV ? {isTVSelectable: !disabled} as any : {})}
      onFocus={setFocusedState as any}
      onBlur={cancelFocusedState as any}
      disabled={disabled}
      ref={controlRef}
      underlayColor="transparent"
      activeOpacity={1}
      onPress={() => {
        callback && callback();
        resetControlTimeout && resetControlTimeout();
      }}
      style={[styles.control, style, focusedStyle]}
      {...props}>
      {children}
    </TouchableHighlight>
  );
};
