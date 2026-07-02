import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { RestaurantCard } from '../../src/components';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useNearbyFeed } from '../../src/hooks/useNearbyFeed';
import { openDirections } from '../../src/lib/maps';
import { getSavedPlaceIds, toggleSavedPlace } from '../../src/lib/local/placeHistory';

export default function ExploreScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const feed = useNearbyFeed();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getSavedPlaceIds().then((ids) => setSavedIds(new Set(ids)));
  }, []);

  const handleToggleSave = async (id: string) => {
    const nowSaved = await toggleSavedPlace(id);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (nowSaved) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              // Cold-start load is owned by the centered indicator; the pull
              // spinner only shows when refreshing an already-populated list.
              refreshing={feed.loading && feed.restaurants.length > 0}
              onRefresh={() => void feed.refresh()}
              tintColor={t.color.accent}
            />
          }
        >
          <Text style={styles.title}>Explore</Text>
          <Text style={styles.subtitle}>Sushi spots near you. Tap one for directions.</Text>

          {feed.loading && feed.restaurants.length === 0 ? (
            <View style={styles.feedState}>
              <ActivityIndicator color={t.color.accent} />
            </View>
          ) : feed.permission === 'denied-permanent' ? (
            <View style={styles.feedStateCard}>
              <Text style={styles.feedStateText}>
                Location is turned off. Enable it in Settings to see sushi spots near you.
              </Text>
              <TouchableOpacity onPress={() => void Linking.openSettings()}>
                <Text style={styles.feedStateLink}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          ) : feed.permission === 'denied' ? (
            <View style={styles.feedStateCard}>
              <Text style={styles.feedStateText}>Enable location to see sushi spots near you.</Text>
              <TouchableOpacity onPress={() => void feed.refresh()}>
                <Text style={styles.feedStateLink}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : feed.error ? (
            <View style={styles.feedStateCard}>
              <Text style={styles.feedStateText}>{feed.error}</Text>
              <TouchableOpacity onPress={() => void feed.refresh()}>
                <Text style={styles.feedStateLink}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : feed.restaurants.length === 0 ? (
            <View style={styles.feedStateCard}>
              <Text style={styles.feedStateText}>No sushi spots found nearby yet.</Text>
              <TouchableOpacity onPress={() => void feed.refresh()}>
                <Text style={styles.feedStateLink}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.feedList}>
              {feed.restaurants.map((r) => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  saved={savedIds.has(r.id)}
                  onToggleSave={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    void handleToggleSave(r.id);
                  }}
                  onPress={async () => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const ok = await openDirections(r.location, r.name);
                    if (!ok) {
                      Alert.alert('Could not open Maps', `We couldn't open directions to ${r.name}.`);
                    }
                  }}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.color.bg },
    safe: { flex: 1 },
    scroll: { padding: 20, paddingBottom: 40, gap: 6 },
    title: { fontSize: 30, fontFamily: t.font.display, color: t.color.textPrimary, letterSpacing: -0.3 },
    subtitle: { fontSize: 15, fontFamily: t.font.body, color: t.color.textSecondary, marginBottom: 12 },
    feedList: { gap: 12 },
    feedState: { paddingVertical: 28, alignItems: 'center' },
    feedStateCard: {
      borderRadius: t.radius.lg,
      padding: 18,
      backgroundColor: t.color.surface,
      borderWidth: 1,
      borderColor: t.color.border,
      gap: 8,
    },
    feedStateText: { fontSize: 14, lineHeight: 20, fontFamily: t.font.body, color: t.color.textSecondary },
    feedStateLink: { fontSize: 14, fontFamily: t.font.bodyBold, color: t.color.accent },
  });
