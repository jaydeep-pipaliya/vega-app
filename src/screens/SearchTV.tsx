import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  StyleSheet,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SearchStackParamList} from '../App';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import {MMKV} from '../lib/Mmkv';
import {SafeAreaView} from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import {useM3Colors} from '../theme/M3PaletteContext';
import {useTVFocusBorderColor} from '../lib/tv/useTVFocusBorderColor';

const MAX_HISTORY_ITEMS = 30;

const HistoryItem = ({
  search,
  onPress,
  primaryColor,
}: {
  search: string;
  onPress: (text: string) => void;
  primaryColor: string;
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const focusBorderColor = useTVFocusBorderColor();

  return (
    <Pressable
      onPress={() => onPress(search)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      focusable={true}
      isTVSelectable={true}
      style={({pressed}) => ({
        transform: [{scale: isFocused ? 1.03 : pressed ? 0.98 : 1}],
      })}>
      <View
        style={[
          styles.historyItemRow,
          {
            borderColor: isFocused ? focusBorderColor : 'transparent',
            borderWidth: isFocused ? 2.5 : 1,
            backgroundColor: isFocused ? 'rgba(255,255,255,0.14)' : '#161616',
          },
        ]}>
        <View style={styles.historyIconContainer}>
          <Ionicons name="time-outline" size={20} color={isFocused ? focusBorderColor : primaryColor} />
        </View>
        <Text style={[styles.historyText, {fontWeight: isFocused ? '700' : '400'}]}>{search}</Text>
        <MaterialIcons name="arrow-forward" size={20} color={isFocused ? focusBorderColor : '#666666'} />
      </View>
    </Pressable>
  );
};

const ClearButton = ({onPress}: {onPress: () => void}) => {
  const colors = useM3Colors();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      focusable={true}
      isTVSelectable={true}
      style={({pressed}) => ({
        transform: [{scale: isFocused ? 1.08 : pressed ? 0.95 : 1}],
      })}>
      <View
        style={[
          styles.clearButton,
          {
            backgroundColor: isFocused ? colors.error : colors.errorContainer,
            borderColor: isFocused ? '#FFFFFF' : 'transparent',
            borderWidth: isFocused ? 2 : 0,
          },
        ]}>
        <Text
          style={[
            styles.clearButtonText,
            {color: isFocused ? colors.onError : colors.onErrorContainer},
          ]}>
          Clear All
        </Text>
      </View>
    </Pressable>
  );
};

const SearchTV: React.FC = () => {
  const colors = useM3Colors();
  const navigation = useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const [searchText, setSearchText] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>(
    () => MMKV.getArray<string>('searchHistory') || [],
  );

  const handleSearch = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      const prevSearches = MMKV.getArray<string>('searchHistory') || [];
      const updated = [trimmed, ...prevSearches.filter(s => s !== trimmed)].slice(
        0,
        MAX_HISTORY_ITEMS,
      );
      MMKV.setArray('searchHistory', updated);
      setSearchHistory(updated);

      navigation.navigate('SearchResults', {
        filter: trimmed,
      });
    },
    [navigation],
  );

  const clearHistory = useCallback(() => {
    MMKV.setArray('searchHistory', []);
    setSearchHistory([]);
  }, []);

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const focusBorderColor = useTVFocusBorderColor();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.headerTitle}>Search</Text>

        <View
          style={[
            styles.searchBarContainer,
            {
              borderColor: isSearchFocused ? focusBorderColor : 'transparent',
              borderWidth: isSearchFocused ? 2.5 : 1,
              transform: [{scale: isSearchFocused ? 1.02 : 1}],
            },
          ]}>
          <MaterialIcons name="search" size={30} color={isSearchFocused ? focusBorderColor : colors.primary} />
          <TextInput
            style={styles.input}
            hasTVPreferredFocus={true}
            placeholder="Search movies, shows..."
            placeholderTextColor="#666666"
            value={searchText}
            focusable={true}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onChangeText={setSearchText}
            onSubmitEditing={e => handleSearch(e.nativeEvent.text)}
            returnKeyType="search"
          />
        </View>

        {searchHistory.length > 0 ? (
          <>
            <View style={styles.historyHeader}>
              <Text style={styles.recentTitle}>Recent Searches</Text>
              <ClearButton onPress={clearHistory} />
            </View>

            <FlatList
              data={searchHistory}
              keyExtractor={(item, index) => `${item}-${index}`}
              showsVerticalScrollIndicator={false}
              renderItem={({item}) => (
                <HistoryItem
                  search={item}
                  onPress={handleSearch}
                  primaryColor={colors.primary}
                />
              )}
            />
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="search-outline" size={56} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Search for your favorite content</Text>
            <Text style={styles.emptySubtitle}>Your recent searches will appear here</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    paddingTop: 24,
  },
  headerTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 34,
    marginBottom: 20,
  },
  searchBarContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 20,
    marginLeft: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  recentTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 20,
    fontWeight: '600',
  },
  historyItemRow: {
    backgroundColor: '#161616',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyIconContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 8,
    marginRight: 14,
  },
  historyText: {
    color: '#ffffff',
    fontSize: 18,
    flex: 1,
  },
  clearButton: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  emptyIconCircle: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 80,
    padding: 24,
    marginBottom: 16,
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
  },
});

export default React.memo(SearchTV);
