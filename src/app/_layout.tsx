import * as Linking from "expo-linking";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  router,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Deep Linking Handler
  useEffect(() => {
    // Function to handle incoming links
    const handleDeepLink = (event: { url: string }) => {
      const { path, queryParams } = Linking.parse(event.url);

      // Check karein ki link hamare voter-slip ka hai aur usme voterId hai
      if (path === "politician/voter-slip" && queryParams?.voterId) {
        router.push({
          pathname: "/politician/voter-detail",
          params: { id: queryParams.voterId },
        });
      }
    };

    // 1. Jab app already open ho aur tab link click ho
    const subscription = Linking.addEventListener("url", handleDeepLink);

    // 2. Jab app band ho aur link click karne par app khule
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
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="politician/voters" />
        <Stack.Screen name="politician/voter-slip" />
        <Stack.Screen name="politician/survey" />
        <Stack.Screen name="politician/scan" />
        <Stack.Screen name="politician/voter-detail" />
      </Stack>
    </ThemeProvider>
  );
}
