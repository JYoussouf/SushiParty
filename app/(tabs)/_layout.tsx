import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../src/contexts/ThemeContext';
import type { Theme } from '../../src/theme/themes';
import { useAuth } from '../../src/contexts/AuthContext';
import { Avatar } from '../../src/components';

function EmojiIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

function ProfileTabIcon({ avatar, focused, t }: { avatar?: string | undefined; focused: boolean; t: Theme }) {
  return (
    <View style={[styles.profileIcon, { borderColor: focused ? t.color.tabActive : 'transparent' }]}>
      <Avatar value={avatar} size={26} />
    </View>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const { userProfile } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.color.tabActive,
        tabBarInactiveTintColor: t.color.tabInactive,
        tabBarLabelStyle: { fontFamily: t.font.bodySemibold, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: t.color.tabBar,
          borderTopColor: t.color.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: () => <EmojiIcon emoji="🏠" /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Explore', tabBarIcon: () => <EmojiIcon emoji="🍣" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <ProfileTabIcon avatar={userProfile?.avatar} focused={focused} t={t} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: () => <EmojiIcon emoji="⚙️" /> }}
      />

      {/* Routable screens kept out of the tab bar (reached from Profile). */}
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="friends" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  profileIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
});
