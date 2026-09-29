import {View, Text, ScrollView, TouchableOpacity, BackHandler} from 'react-native';
import React, {useEffect} from 'react';
import useContentStore from '../lib/zustand/contentStore';
import {MaterialIcons} from '@expo/vector-icons';
import {useM3Colors} from '../theme/M3PaletteContext';
import {isTV} from '../lib/tv';
import {TVFocusable, TVFocusGuide} from './tv';
import {useTVFocusBorderColor} from '../lib/tv/useTVFocusBorderColor';

const ProviderDrawer = ({onClose}: {onClose: () => void}) => {
  const {provider, setProvider, installedProviders} = useContentStore(
    state => state,
  );
  const primary = useM3Colors().primary;
  const focusBorderColor = useTVFocusBorderColor(primary);
  const mountTimeRef = React.useRef<number>(Date.now());

  const handleClose = React.useCallback(() => {
    if (Date.now() - mountTimeRef.current < 350) return;
    onClose();
  }, [onClose]);

  const handleSelectProvider = React.useCallback(
    (item: any) => {
      if (Date.now() - mountTimeRef.current < 350) return;
      setProvider(item);
      onClose();
    },
    [setProvider, onClose],
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [handleClose]);

  return (
    <View className="flex-1" style={{backgroundColor: isTV ? '#121214' : 'rgba(0,0,0,0.85)'}}>
      <View
        style={{
          borderBottomColor: 'rgba(255,255,255,0.1)',
          borderBottomWidth: 1,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 16,
          paddingHorizontal: 16,
          paddingTop: isTV ? 28 : 40,
        }}>
        <View>
          <Text className="text-white text-2xl font-bold">Select Provider</Text>
          <Text className="text-gray-400 mt-1 text-sm">Content source</Text>
        </View>
        {isTV ? (
          <TVFocusable
            accessibilityRole="button"
            accessibilityLabel="Close drawer"
            hasTVPreferredFocus={false}
            onPress={handleClose}
            borderRadius={20}
            focusScale={1.1}
            focusBorderColor={focusBorderColor}
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 20,
              height: 40,
              justifyContent: 'center',
              width: 40,
            }}>
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TVFocusable>
        ) : null}
      </View>

      <TVFocusGuide
        autoFocus={true}
        trapFocusLeft={true}
        trapFocusRight={true}
        trapFocusUp={true}
        trapFocusDown={true}
        style={{flex: 1}}>
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-2">
          {installedProviders.map((item, index) => {
            const isSelected = provider.value === item.value;

            if (isTV) {
              return (
                <TVFocusable
                  key={item.value}
                  hasTVPreferredFocus={isSelected || index === 0}
                  onPress={() => handleSelectProvider(item)}
                  borderRadius={12}
                  focusScale={1.03}
                  focusBorderColor={focusBorderColor}
                  style={{
                    alignItems: 'center',
                    backgroundColor: isSelected
                      ? 'rgba(255, 255, 255, 0.15)'
                      : 'rgba(255, 255, 255, 0.04)',
                    borderRadius: 12,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginVertical: 4,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}>
                  {({focused}) => (
                    <>
                      <View style={{alignItems: 'center', flexDirection: 'row'}}>
                        <MaterialIcons
                          name="movie"
                          size={22}
                          color={focused || isSelected ? primary : '#888'}
                        />
                        <Text
                          style={{
                            color: focused || isSelected ? '#FFFFFF' : '#B0B0B0',
                            fontSize: 16,
                            fontWeight: focused || isSelected ? '700' : '500',
                            marginLeft: 12,
                          }}>
                          {item.display_name}
                        </Text>
                      </View>
                      {isSelected && (
                        <MaterialIcons name="check" size={22} color={primary} />
                      )}
                    </>
                  )}
                </TVFocusable>
              );
            }

            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => {
                  setProvider(item);
                  onClose();
                }}
                className={`flex-row items-center justify-between p-4 my-1 rounded-lg ${
                  isSelected ? 'bg-white/10' : 'bg-transparent'
                }`}>
                <View className="flex-row items-center">
                  <MaterialIcons
                    name="movie"
                    size={20}
                    color={isSelected ? primary : '#888'}
                  />
                  <Text
                    className={`ml-3 text-base ${
                      isSelected
                        ? 'text-white font-medium'
                        : 'text-gray-400'
                    }`}>
                    {item.display_name}
                  </Text>
                </View>
                {isSelected && (
                  <MaterialIcons name="check" size={20} color={primary} />
                )}
              </TouchableOpacity>
            );
          })}
          <View className="h-16" />
        </ScrollView>
      </TVFocusGuide>
    </View>
  );
};

export default ProviderDrawer;
