import { AuthSessionGuard } from "@/features/auth/AuthSessionGuard";
import { AppUpdateGate } from "@/features/app-updates/AppUpdateGate";
import "@/global.css";
import * as Linking from "expo-linking";
import {
  DarkTheme,
  DefaultTheme,
  router,
  Stack,
  ThemeProvider,
  usePathname,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedSplashOverlay } from "@/components/animated-icon";

SplashScreen.preventAutoHideAsync();

function StatusBarBackground() {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: insets.top,
        backgroundColor: "#087568",
        zIndex: 999,
      }}
    />
  );
}
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const isLoginScreen = pathname === "/login";

  // Deep Linking Handler
  useEffect(() => {
    // Function to handle incoming links
    const handleDeepLink = (event: { url: string }) => {
      const { path, queryParams } = Linking.parse(event.url);

      if (path === "politician/voter-slip" && queryParams?.voterId) {
        router.push({
          pathname: "/politician/voter-detail",
          params: { id: queryParams.voterId },
        });
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    // Cleanup
    return () => subscription.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar barStyle="light-content" backgroundColor="#087568" />
      {!isLoginScreen && <StatusBarBackground />}
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="location-map" />
        <Stack.Screen name="banner-generation" />
        <Stack.Screen name="politician/voters" />
        <Stack.Screen name="politician/templates" />
        <Stack.Screen name="politician/voter-slip" />
        <Stack.Screen name="politician/survey" />
        <Stack.Screen name="politician/survey-report" />
        <Stack.Screen name="politician/voter-detail" />
      </Stack>
      <AuthSessionGuard />
      <AppUpdateGate />
    </ThemeProvider>
  );
}
