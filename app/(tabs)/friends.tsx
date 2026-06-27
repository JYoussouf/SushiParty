import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { useFriends } from '../../src/hooks/useFriends';
import { getFriendChallenges } from '../../src/lib/challenges';
import { getFriendSessions } from '../../src/lib/local/friends';
import { getAllSessions } from '../../src/lib/cloudflare/sessions';
import type { FriendChallengeProgress } from '../../src/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function FriendsScreen() {
  const router = useRouter();
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { userProfile } = useAuth();
  const { friends, activity, searchResults, loading, searching, addingFriendId, refresh, search, addFriend, clearSearch } =
    useFriends();
  const [showAddModal, setShowAddModal] = useState(false);
  const [query, setQuery] = useState('');
  const [challenges, setChallenges] = useState<FriendChallengeProgress[]>([]);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      if (!userProfile) {
        setChallenges([]);
        return;
      }

      try {
        const userSessions = await getAllSessions();
        const friendSessions = (
          await Promise.all(friends.map((friend) => getFriendSessions(friend.user.uid)))
        ).flat();
        if (!active) return;
        setChallenges(
          getFriendChallenges(
            userSessions,
            friendSessions,
            userProfile.uid,
            friends.map((friend) => friend.user.uid),
          ),
        );
      } catch {
        if (active) setChallenges([]);
      }
    })();

    return () => {
      active = false;
    };
  }, [friends, userProfile]);

  const handleSearchChange = (nextQuery: string) => {
    setQuery(nextQuery);
    void search(nextQuery);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setQuery('');
    clearSearch();
  };

  const handleAddFriend = async (friendId: string) => {
    try {
      await addFriend(friendId);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not add that friend.';
      Alert.alert('Add friend failed', message);
    }
  };

  const header = (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>Friends</Text>
        <Text style={styles.subtitle}>Add people and keep an eye on their sushi runs.</Text>
      </View>
      <TouchableOpacity style={styles.addShadow} onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
        <LinearGradient
          colors={t.color.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>Add Friend</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  if (loading && friends.length === 0) {
    return (
      <View style={styles.loadingState}>
        <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={t.color.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
      >
        <Animated.View style={entranceStyle}>
        {header}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Challenges</Text>
          {challenges.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No active challenges yet</Text>
              <Text style={styles.emptyText}>Add friends to compare weekly and monthly progress.</Text>
            </View>
          ) : (
            challenges.map((challenge) => (
              <View key={challenge.id} style={styles.challengeCard}>
                <Text style={styles.challengeTitle}>{challenge.title}</Text>
                <Text style={styles.challengeText}>{challenge.description}</Text>
                <Text style={styles.challengeMeta}>
                  You: {challenge.currentUserProgress}/{challenge.target} {challenge.unit} • Friends avg:{' '}
                  {challenge.friendAverageProgress.toFixed(1)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Friends</Text>
          {friends.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No friends added yet</Text>
              <Text style={styles.emptyText}>
                Search by username to build your sushi circle and unlock activity here.
              </Text>
              <TouchableOpacity style={styles.emptyButton} onPress={() => setShowAddModal(true)}>
                <Text style={styles.emptyButtonText}>Find friends</Text>
              </TouchableOpacity>
            </View>
          ) : (
            friends.map((friend) => (
              <TouchableOpacity
                key={friend.user.uid}
                style={styles.friendCard}
                onPress={() =>
                  router.push({ pathname: '/friend/[id]', params: { id: friend.user.uid } })
                }
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(friend.user.displayName)}</Text>
                </View>
                <View style={styles.friendBody}>
                  <Text style={styles.friendName}>{friend.user.displayName}</Text>
                  <Text style={styles.friendUsername}>@{friend.user.username}</Text>
                  <Text style={styles.friendMeta}>
                    {friend.lastActivity
                      ? `${friend.lastActivity.restaurantName} • ${friend.lastActivity.totalPieces} pcs`
                      : 'No shared activity yet'}
                  </Text>
                </View>
                <Text style={styles.friendChevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Feed</Text>
          {activity.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing recent yet</Text>
              <Text style={styles.emptyText}>
                Added friends with recent parties will show up here in reverse chronological order.
              </Text>
            </View>
          ) : (
            activity.map((entry) => (
              <View key={`${entry.sessionId}-${entry.userId}`} style={styles.activityCard}>
                <Text style={styles.activityTitle}>
                  {entry.displayName} ate {entry.totalPieces} pieces
                </Text>
                <Text style={styles.activityMeta}>
                  {entry.restaurantName} • {new Date(entry.submittedAt).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </View>
        </Animated.View>
      </ScrollView>
      </SafeAreaView>

      <Modal visible={showAddModal} animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalContainer}>
          <LinearGradient colors={t.color.bgGradient} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={styles.modalSafe}>
          <StatusBar style={t.isDark ? 'light' : 'dark'} />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
          >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleSearchChange}
            placeholder="Search username or display name"
            placeholderTextColor={t.color.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {searching ? (
            <View style={styles.modalState}>
              <ActivityIndicator color={t.color.accent} />
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.uid}
              contentContainerStyle={styles.searchResults}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View style={styles.searchRow}>
                  <View style={styles.searchRowBody}>
                    <Text style={styles.searchName}>{item.displayName}</Text>
                    <Text style={styles.searchUsername}>@{item.username}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.searchAddButton}
                    onPress={() => void handleAddFriend(item.uid)}
                    disabled={addingFriendId === item.uid}
                  >
                    {addingFriendId === item.uid ? (
                      <ActivityIndicator color={t.color.onAccent} />
                    ) : (
                      <Text style={styles.searchAddButtonText}>Add</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.modalState}>
                  <Text style={styles.emptyText}>
                    {query.trim()
                      ? 'No users matched that search.'
                      : 'Start typing to search the local friend directory.'}
                  </Text>
                </View>
              }
            />
          )}
          </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.color.bg,
  },
  safe: {
    flex: 1,
  },
  loadingState: {
    flex: 1,
    backgroundColor: t.color.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: t.font.display,
    color: t.color.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
    maxWidth: 240,
  },
  addShadow: {
    borderRadius: t.radius.button,
    ...t.shadow.glow(t.color.accent),
  },
  addButton: {
    borderRadius: t.radius.button,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: t.font.display,
    color: t.color.textPrimary,
  },
  emptyCard: {
    borderRadius: t.radius.lg,
    padding: 18,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: t.font.bodyBold,
    color: t.color.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
  },
  emptyButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: t.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: t.color.accentSoft,
  },
  emptyButtonText: {
    fontSize: 14,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: t.radius.lg,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    ...t.shadow.card,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.color.accentSoft,
  },
  avatarText: {
    fontSize: 16,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
  },
  friendBody: {
    flex: 1,
    gap: 2,
  },
  friendName: {
    fontSize: 16,
    fontFamily: t.font.bodyBold,
    color: t.color.textPrimary,
  },
  friendUsername: {
    fontSize: 13,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
  },
  friendMeta: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
  },
  friendChevron: {
    fontSize: 22,
    color: t.color.textTertiary,
  },
  activityCard: {
    borderRadius: t.radius.lg,
    padding: 16,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    gap: 4,
  },
  activityTitle: {
    fontSize: 15,
    fontFamily: t.font.bodyBold,
    color: t.color.textPrimary,
  },
  activityMeta: {
    fontSize: 13,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
  },
  challengeCard: {
    borderRadius: t.radius.lg,
    padding: 16,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
    gap: 4,
  },
  challengeTitle: {
    fontSize: 15,
    fontFamily: t.font.bodyBold,
    color: t.color.amber,
  },
  challengeText: {
    fontSize: 13,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
  },
  challengeMeta: {
    fontSize: 13,
    fontFamily: t.font.bodyBold,
    color: t.color.amber,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: t.color.bg,
  },
  modalSafe: {
    flex: 1,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: t.font.display,
    color: t.color.textPrimary,
  },
  modalClose: {
    fontSize: 16,
    fontFamily: t.font.bodySemibold,
    color: t.color.accent,
  },
  searchInput: {
    height: 50,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.color.border,
    backgroundColor: t.color.surface,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: t.font.body,
    color: t.color.textPrimary,
  },
  searchResults: {
    paddingTop: 16,
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: t.radius.md,
    padding: 16,
    backgroundColor: t.color.surface,
    borderWidth: 1,
    borderColor: t.color.border,
  },
  searchRowBody: {
    flex: 1,
    gap: 2,
  },
  searchName: {
    fontSize: 16,
    fontFamily: t.font.bodyBold,
    color: t.color.textPrimary,
  },
  searchUsername: {
    fontSize: 13,
    fontFamily: t.font.body,
    color: t.color.textSecondary,
  },
  searchAddButton: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: t.color.accent,
  },
  searchAddButtonText: {
    fontSize: 14,
    fontFamily: t.font.bodyBold,
    color: t.color.onAccent,
  },
  modalState: {
    paddingTop: 24,
    alignItems: 'center',
  },
});
