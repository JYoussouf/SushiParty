import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#e53935',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { borderTopColor: '#f0f0f0' },
      }}
    >
      <Tabs.Screen
        name="scoreboard"
        options={{
          title: 'Scoreboard',
          tabBarIcon: () => <TabIcon emoji="🍣" />,
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
