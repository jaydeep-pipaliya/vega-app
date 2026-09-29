import React, {useState, useEffect} from 'react';
import {
  BackHandler,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Text from '../ui/Text';
import {useM3Colors} from '../../theme/M3PaletteContext';
import {isTV} from '../../lib/tv';
import {TVFocusable} from '../tv';

interface SeasonSearchSortBarProps {
  searchText: string;
  setSearchText: (text: string) => void;
  sortOrder: 'asc' | 'desc';
  toggleSortOrder: () => void;
  focusBorderColor: string;
}

export const SeasonSearchSortBar: React.FC<SeasonSearchSortBarProps> = ({
  searchText,
  setSearchText,
  sortOrder,
  toggleSortOrder,
  focusBorderColor,
}) => {
  const colors = useM3Colors();
  const [showTVSearchModal, setShowTVSearchModal] = useState(false);

  useEffect(() => {
    if (!isTV || !showTVSearchModal) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowTVSearchModal(false);
      return true;
    });
    return () => sub.remove();
  }, [showTVSearchModal]);

  return (
    <View className="flex-row items-center mt-2">
      {isTV ? (
        <TVFocusable
          accessibilityLabel={searchText ? `Filter: ${searchText}` : 'Find episode'}
          focusBorderColor={focusBorderColor}
          borderRadius={18}
          focusScale={1.02}
          style={{
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.outlineVariant,
            borderRadius: 18,
            borderWidth: 1,
            flex: 1,
            flexDirection: 'row',
            height: 48,
            marginRight: 10,
            alignItems: 'center',
            paddingHorizontal: 14,
          }}
          onPress={() => setShowTVSearchModal(true)}>
          {({focused}) => (
            <View style={styles.tvBarRow}>
              <MaterialCommunityIcons
                name="magnify"
                size={22}
                color={focused ? focusBorderColor : colors.primary}
              />
              <Text
                numberOfLines={1}
                style={{
                  color: searchText ? colors.onSurface : colors.onSurfaceVariant,
                  fontSize: 16,
                  marginLeft: 10,
                  flex: 1,
                }}>
                {searchText || 'Find episode'}
              </Text>
              {searchText ? (
                <TouchableOpacity
                  onPress={() => setSearchText('')}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </TVFocusable>
      ) : (
        <View
          style={{
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.outlineVariant,
            borderRadius: 18,
            borderWidth: 1,
            flex: 1,
            flexDirection: 'row',
            height: 48,
            marginRight: 10,
            overflow: 'hidden',
            alignItems: 'center',
          }}>
          <View
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              paddingLeft: 14,
            }}>
            <MaterialCommunityIcons
              name="magnify"
              size={22}
              color={colors.primary}
            />
          </View>
          <TextInput
            accessibilityLabel="Find episode"
            placeholder="Find episode"
            placeholderTextColor={colors.onSurfaceVariant}
            selectionColor={colors.primary}
            returnKeyType="search"
            style={{
              color: colors.onSurface,
              flex: 1,
              fontSize: 16,
              paddingHorizontal: 10,
              paddingVertical: 0,
            }}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <TouchableOpacity
              onPress={() => setSearchText('')}
              style={{paddingRight: 14}}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Sort order toggle button */}
      <TVFocusable
        accessibilityLabel={
          sortOrder === 'asc'
            ? 'Sort episodes descending'
            : 'Sort episodes ascending'
        }
        focusBorderColor={focusBorderColor}
        borderRadius={18}
        focusScale={1.05}
        style={{
          backgroundColor: colors.surfaceContainerHigh,
          borderColor: colors.outlineVariant,
          borderWidth: 1,
          borderRadius: 18,
          height: 48,
          width: 48,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onPress={toggleSortOrder}>
        {({focused}) => (
          <MaterialCommunityIcons
            name={sortOrder === 'asc' ? 'sort-ascending' : 'sort-descending'}
            size={24}
            color={focused ? focusBorderColor : colors.onSurface}
          />
        )}
      </TVFocusable>

      {/* TV Search Modal */}
      {isTV && showTVSearchModal && (
        <Modal
          visible={showTVSearchModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTVSearchModal(false)}>
          <View style={styles.tvModalBackdrop}>
            <View
              style={[
                styles.tvModalCard,
                {
                  backgroundColor: colors.surfaceContainerHigh || '#211F1E',
                  borderColor: colors.outlineVariant,
                },
              ]}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: colors.onSurface,
                  marginBottom: 16,
                }}>
                Find Episode
              </Text>
              <View
                style={[
                  styles.tvInputContainer,
                  {
                    backgroundColor: colors.surface || '#171717',
                    borderColor: focusBorderColor,
                  },
                ]}>
                <MaterialCommunityIcons
                  name="magnify"
                  size={24}
                  color={focusBorderColor}
                />
                <TextInput
                  autoFocus
                  placeholder="Type episode name or number..."
                  placeholderTextColor={colors.onSurfaceVariant}
                  selectionColor={focusBorderColor}
                  value={searchText}
                  onChangeText={setSearchText}
                  onSubmitEditing={() => setShowTVSearchModal(false)}
                  returnKeyType="search"
                  style={{
                    color: colors.onSurface,
                    fontSize: 16,
                    flex: 1,
                    marginLeft: 10,
                  }}
                />
                {searchText ? (
                  <TouchableOpacity onPress={() => setSearchText('')}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={22}
                      color={colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.tvModalActions}>
                {searchText ? (
                  <TVFocusable
                    onPress={() => {
                      setSearchText('');
                      setShowTVSearchModal(false);
                    }}
                    borderRadius={12}
                    focusBorderColor={focusBorderColor}
                    style={styles.tvModalCancelBtn}>
                    <Text
                      style={{
                        color: colors.onSurface,
                        fontSize: 14,
                        fontWeight: '600',
                      }}>
                      Clear Filter
                    </Text>
                  </TVFocusable>
                ) : null}
                <TVFocusable
                  hasTVPreferredFocus={true}
                  onPress={() => setShowTVSearchModal(false)}
                  borderRadius={12}
                  focusBorderColor={focusBorderColor}
                  style={[
                    styles.tvModalDoneBtn,
                    {backgroundColor: colors.primary},
                  ]}>
                  <Text
                    style={{
                      color: colors.onPrimary || '#000000',
                      fontSize: 14,
                      fontWeight: '700',
                    }}>
                    Done
                  </Text>
                </TVFocusable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tvBarRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  tvModalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  tvModalCard: {
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 520,
    padding: 24,
    width: '80%',
  },
  tvInputContainer: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    height: 52,
    marginBottom: 20,
    paddingHorizontal: 14,
  },
  tvModalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  tvModalCancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  tvModalDoneBtn: {
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
});

export default SeasonSearchSortBar;
