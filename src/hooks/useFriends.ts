import { useCallback, useEffect, useRef, useState } from 'react';
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the latest query so out-of-order responses can be discarded
  const latestQueryRef = useRef('');

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
    (query: string) => {
      latestQueryRef.current = query;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Below the minimum length: don't hit the network, clear stale results.
      if (!userProfile || query.trim().length < 2) {
        setSearchResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);
      debounceRef.current = setTimeout(() => {
        void searchUsersByUsername(query, [userProfile.uid, ...userProfile.friendIds])
          .then((results) => {
            // Ignore responses for a query that has since been superseded.
            if (latestQueryRef.current !== query) return;
            setSearchResults(results);
          })
          .catch(() => {
            if (latestQueryRef.current !== query) return;
            setSearchResults([]);
          })
          .finally(() => {
            if (latestQueryRef.current !== query) return;
            setSearching(false);
          });
      }, 300);
    },
    [userProfile],
  );

  const clearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    latestQueryRef.current = '';
    setSearchResults([]);
    setSearching(false);
  }, []);

  // Clear any pending debounced search on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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
