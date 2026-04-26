import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
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
  const { userProfile } = useAuth();
  const { friends, activity, searchResults, loading, searching, addingFriendId, refresh, search, addFriend, clearSearch } =
    useFriends();
  const [showAddModal, setShowAddModal] = useState(false);
  const [query, setQuery] = useState('');
  const [challenges, setChallenges] = useState<FriendChallengeProgress[]>([]);

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
      <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
        <Text style={styles.addButtonText}>Add Friend</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading && friends.length === 0) {
    return (
      <SafeAreaView style={styles.loadingState}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#e53935" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
      >
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
                  router.push({ pathname: '../friend/[id]', params: { id: friend.user.uid } })
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
      </ScrollView>

      <Modal visible={showAddModal} animationType="slide" onRequestClose={closeModal}>
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar style="dark" />
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
            placeholderTextColor="#aaa"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {searching ? (
            <View style={styles.modalState}>
              <ActivityIndicator color="#e53935" />
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
                      <ActivityIndicator color="#fff" />
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
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingState: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontWeight: '800',
    color: '#222',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: '#777',
    maxWidth: 240,
  },
  addButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#e53935',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#222',
  },
  emptyCard: {
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#777',
  },
  emptyButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffeaea',
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e53935',
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffeaea',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#e53935',
  },
  friendBody: {
    flex: 1,
    gap: 2,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  friendUsername: {
    fontSize: 13,
    color: '#888',
  },
  friendMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
  },
  friendChevron: {
    fontSize: 22,
    color: '#bbb',
  },
  activityCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#fff6f3',
    borderWidth: 1,
    borderColor: '#f5ddd7',
    gap: 4,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },
  activityMeta: {
    fontSize: 13,
    color: '#777',
  },
  challengeCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#fff6e7',
    borderWidth: 1,
    borderColor: '#f0d7a0',
    gap: 4,
  },
  challengeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#8b6a1d',
  },
  challengeText: {
    fontSize: 13,
    color: '#6e5723',
  },
  challengeMeta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8b6a1d',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontWeight: '800',
    color: '#222',
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e53935',
  },
  searchInput: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fafafa',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#222',
  },
  searchResults: {
    paddingTop: 16,
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  searchRowBody: {
    flex: 1,
    gap: 2,
  },
  searchName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222',
  },
  searchUsername: {
    fontSize: 13,
    color: '#888',
  },
  searchAddButton: {
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#e53935',
  },
  searchAddButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  modalState: {
    paddingTop: 24,
    alignItems: 'center',
  },
});
