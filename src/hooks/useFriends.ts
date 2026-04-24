import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  addFriendToProfile,
  getFriendActivities,
  getFriendsByIds,
  searchUsersByUsername,
} from '../lib/local/friends';
import type { FriendActivity, User } from '../types';

export interface FriendListItem {
  user: User;
  lastActivity: FriendActivity | null;
}

export function useFriends() {
  const { userProfile, refreshProfile } = useAuth();
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [activity, setActivity] = useState<FriendActivity[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);

  const loadFriendData = useCallback(
    async (friendIds: string[]) => {
      const [friendUsers, friendActivity] = await Promise.all([
        getFriendsByIds(friendIds),
        getFriendActivities(friendIds),
      ]);

      const items = friendUsers.map((user) => ({
        user,
        lastActivity: friendActivity.find((entry) => entry.userId === user.uid) ?? null,
      }));

      setFriends(items);
      setActivity(friendActivity);
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!userProfile) {
      setFriends([]);
      setActivity([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await loadFriendData(userProfile.friendIds);
    } finally {
      setLoading(false);
    }
  }, [loadFriendData, userProfile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const search = useCallback(
    async (query: string) => {
      if (!userProfile) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const results = await searchUsersByUsername(query, [userProfile.uid, ...userProfile.friendIds]);
        setSearchResults(results);
      } finally {
        setSearching(false);
      }
    },
    [userProfile],
  );

  const clearSearch = useCallback(() => {
    setSearchResults([]);
  }, []);

  const addFriend = useCallback(
    async (friendId: string) => {
      setAddingFriendId(friendId);
      try {
        const updatedProfile = await addFriendToProfile(friendId);
        await loadFriendData(updatedProfile.friendIds);
        await refreshProfile();
        setSearchResults((prev) => prev.filter((user) => user.uid !== friendId));
      } finally {
        setAddingFriendId(null);
      }
    },
    [loadFriendData, refreshProfile],
  );

  return {
    friends,
    activity,
    searchResults,
    loading,
    searching,
    addingFriendId,
    refresh,
    search,
    clearSearch,
    addFriend,
  };
}
