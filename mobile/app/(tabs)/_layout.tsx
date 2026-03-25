import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../src/theme";

function TabIcon({
  name,
  focused,
  color,
}: {
  name: string;
  focused: boolean;
  color: string;
}) {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    home: focused ? "home" : "home-outline",
    profile: focused ? "person" : "person-outline",
  };
  return (
    <Ionicons
      name={icons[name] || "ellipse"}
      size={22}
      color={color}
      style={{ opacity: focused ? 1 : 0.5 }}
    />
  );
}

export default function TabsLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { 
          backgroundColor: theme.background,
          elevation: 0, // Remove shadow on Android
          shadowOpacity: 0, // Remove shadow on iOS
          borderBottomWidth: 0, // Remove border on Web
        },
        headerShadowVisible: false, // Ensures native header shadow is completely disabled
        headerTintColor: theme.text,
        headerTitleStyle: { fontWeight: "700" },
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused, color }) => <TabIcon name="home" focused={focused} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, color }) => <TabIcon name="profile" focused={focused} color={color} />,
        }}
      />
    </Tabs>
  );
}
