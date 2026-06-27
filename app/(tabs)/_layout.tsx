import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTheme } from '../../src/contexts/ThemeContext';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.color.tabActive,
        tabBarInactiveTintColor: t.color.tabInactive,
        tabBarStyle: {
          display: 'none',
          backgroundColor: t.color.tabBar,
          borderTopColor: t.color.border,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: () => <TabIcon emoji="🏠" />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: () => <TabIcon emoji="📋" />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: () => <TabIcon emoji="👥" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: () => <TabIcon emoji="👤" />,
        }}
      />
    </Tabs>
  );
}
