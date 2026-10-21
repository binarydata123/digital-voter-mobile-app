import { Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  InteractionManager,
  StyleSheet,
  Text,
  View,
} from "react-native";

export function EmptyState({
  title = "No data found",
  message,
}: {
  title?: string;
  message: string;
}) {
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(15));
  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    // Wait for all interactions and layout calculations to finish
    const task = InteractionManager.runAfterInteractions(() => {
      // 1. Entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // 2. Infinite pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    return () => {
      task.cancel();
    };
  }, [fadeAnim, slideAnim, pulseAnim]);

  // ... rest of the component

  return (
    <Animated.View
      style={[
        styles.emptyState,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Animated Icon Container */}
      <View style={styles.iconWrapper}>
        <Animated.View
          style={[
            styles.iconGlow,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        <View style={styles.iconCircle}>
          <Search size={26} color="#087568" strokeWidth={2.5} />
        </View>
      </View>

      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconGlow: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E6F4EA", // Soft green tint
    opacity: 0.8,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#087568",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 2,
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
});
