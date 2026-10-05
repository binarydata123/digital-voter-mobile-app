import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STATUS_MESSAGES = [
  "Connecting to election server…",
  "Fetching your assigned booths…",
  "Updating voter list…",
  "Verifying data integrity…",
];

// Helper: creates a stable Animated.Value that survives re-renders.
function useAnimatedValue(initial: number) {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}

export function VoterDataSetup() {
  // --- Animation values (stable across renders) ---
  const spin = useAnimatedValue(0);
  const spinReverse = useAnimatedValue(0);
  const pulse = useAnimatedValue(1);
  const float = useAnimatedValue(0);
  const glow = useAnimatedValue(0);
  const progress = useAnimatedValue(0);
  const shimmer = useAnimatedValue(-1);
  const dot1 = useAnimatedValue(0.3);
  const dot2 = useAnimatedValue(0.3);
  const dot3 = useAnimatedValue(0.3);
  const skel1 = useAnimatedValue(0.4);
  const skel2 = useAnimatedValue(0.4);
  const skel3 = useAnimatedValue(0.4);
  const titleFade = useAnimatedValue(0);
  const titleSlide = useAnimatedValue(16);
  const statusFade = useAnimatedValue(1);

  // --- Rotating status message ---
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
  
    spin.setValue(0);
    spinReverse.setValue(0);
    pulse.setValue(1);
    float.setValue(0);
    glow.setValue(0);
    progress.setValue(0);
    shimmer.setValue(-1);
    dot1.setValue(0.3);
    dot2.setValue(0.3);
    dot3.setValue(0.3);
    skel1.setValue(0.4);
    skel2.setValue(0.4);
    skel3.setValue(0.4);
    titleFade.setValue(0);
    titleSlide.setValue(16);
    statusFade.setValue(1);


    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      { resetBeforeIteration: true },
    );
    const spinReverseLoop = Animated.loop(
      Animated.timing(spinReverse, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      { resetBeforeIteration: true },
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      { resetBeforeIteration: true },
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -7,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      { resetBeforeIteration: true },
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      { resetBeforeIteration: true },
    );
    const progressLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ]),
      { resetBeforeIteration: true },
    );
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      { resetBeforeIteration: true },
    );

    const makeDotLoop = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.3,
            duration: 320,
            useNativeDriver: true,
          }),
          Animated.delay(500),
        ]),
        { resetBeforeIteration: true },
      );

    const d1 = makeDotLoop(dot1, 0);
    const d2 = makeDotLoop(dot2, 180);
    const d3 = makeDotLoop(dot3, 360);

    const makeSkeleton = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.delay(400),
        ]),
        { resetBeforeIteration: true },
      );

    const s1 = makeSkeleton(skel1, 0);
    const s2 = makeSkeleton(skel2, 150);
    const s3 = makeSkeleton(skel3, 300);

    // Start them all
    spinLoop.start();
    spinReverseLoop.start();
    pulseLoop.start();
    floatLoop.start();
    glowLoop.start();
    progressLoop.start();
    shimmerLoop.start();
    d1.start();
    d2.start();
    d3.start();
    s1.start();
    s2.start();
    s3.start();

    // --- Entry animation ---
    Animated.parallel([
      Animated.timing(titleFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(titleSlide, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // --- Rotating status messages ---
    const interval = setInterval(() => {
      Animated.timing(statusFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length);
        Animated.timing(statusFade, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 2400);

    // --- Cleanup ---
    return () => {
      clearInterval(interval);
      spinLoop.stop();
      spinReverseLoop.stop();
      pulseLoop.stop();
      floatLoop.stop();
      glowLoop.stop();
      progressLoop.stop();
      shimmerLoop.stop();
      d1.stop();
      d2.stop();
      d3.stop();
      s1.stop();
      s2.stop();
      s3.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Interpolations (memoized for stable identity) ---
  const spinInterpolate = useMemo(
    () =>
      spin.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      }),
    [spin],
  );
  const spinReverseInterpolate = useMemo(
    () =>
      spinReverse.interpolate({
        inputRange: [0, 1],
        outputRange: ["360deg", "0deg"],
      }),
    [spinReverse],
  );
  const glowScale = useMemo(
    () =>
      glow.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.25],
      }),
    [glow],
  );
  const glowOpacity = useMemo(
    () =>
      glow.interpolate({
        inputRange: [0, 1],
        outputRange: [0.35, 0],
      }),
    [glow],
  );
  const progressWidth = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: ["6%", "100%"],
      }),
    [progress],
  );
  const shimmerTranslate = useMemo(
    () =>
      shimmer.interpolate({
        inputRange: [-1, 1],
        outputRange: [-200, 400],
      }),
    [shimmer],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Hero with gradient overlay */}
        <View style={styles.hero}>
          <Image
            source={require("../../../../assets/images/vote.jpeg")}
            style={styles.heroImage}
            contentFit="cover"
            transition={120}
          />
          <View style={styles.heroOverlay} />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeDot}>●</Text>
            <Text style={styles.heroBadgeText}>SECURE SYNC</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Animated loader */}
          <View style={styles.loaderWrap}>
            {/* Soft glow halo behind everything */}
            <Animated.View
              style={[
                styles.glowHalo,
                {
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }],
                },
              ]}
            />

            {/* Static faint full-circle track */}
            <View style={styles.spinnerTrack} />

            {/* Rotating colored arc — orbits continuously clockwise */}
            <Animated.View
              style={[
                styles.spinnerArc,
                { transform: [{ rotate: spinInterpolate }] },
              ]}
            />

            {/* Inner reverse rotating arc — opposite direction */}
            <Animated.View
              style={[
                styles.spinnerArcInner,
                { transform: [{ rotate: spinReverseInterpolate }] },
              ]}
            />

            {/* Pulsing badge with floating ballot */}
            <Animated.View
              style={[styles.loaderBadge, { transform: [{ scale: pulse }] }]}
            >
              <Animated.Text
                style={[
                  styles.ballotEmoji,
                  { transform: [{ translateY: float }] },
                ]}
              >
                🗳️
              </Animated.Text>
            </Animated.View>
          </View>

          {/* Title with entry animation */}
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: titleFade,
                transform: [{ translateY: titleSlide }],
              },
            ]}
          >
            Setting up your voter data
          </Animated.Text>

          <Text style={styles.description}>
            Please wait while we download and update your voter list.
          </Text>

          {/* Progress bar with shimmer */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, { width: progressWidth }]}
            >
              <Animated.View
                style={[
                  styles.shimmer,
                  { transform: [{ translateX: shimmerTranslate }] },
                ]}
              />
            </Animated.View>
          </View>

          {/* Rotating status message */}
          <View style={styles.statusRow}>
            <Animated.View style={[styles.statusDot, { opacity: dot1 }]} />
            <Animated.View style={[styles.statusDot, { opacity: dot2 }]} />
            <Animated.View style={[styles.statusDot, { opacity: dot3 }]} />
            <Animated.Text style={[styles.statusText, { opacity: statusFade }]}>
              {STATUS_MESSAGES[statusIndex]}
            </Animated.Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4FBF7" },
  container: { flex: 1 },

  // --- Hero ---
  hero: {
    height: 220,
    overflow: "hidden",
    justifyContent: "flex-start",
    backgroundColor: "#A3C4B5",
  },
  heroImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "155%",
    height: "100%",
  },
  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(6, 95, 70, 0.25)",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 20,
    marginLeft: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.92)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  heroBadgeDot: { color: "#10B981", fontSize: 10 },
  heroBadgeText: {
    color: "#065F46",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },

  // --- Content ---
  content: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#F4FBF7",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -29,
    paddingHorizontal: 28,
    paddingTop: 32,
  },

  // --- Loader ---
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 120,
    width: 120,
    marginBottom: 20,
  },
  glowHalo: {
    position: "absolute",
    height: 110,
    width: 110,
    borderRadius: 55,
    backgroundColor: "#34D399",
  },
  // Static faint full circle — the "track"
  spinnerTrack: {
    position: "absolute",
    height: 112,
    width: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: "#BBF7D0",
  },
  // Rotating colored arc — full circle with only the top colored,
  // so it sweeps around the track as it rotates.
  spinnerArc: {
    position: "absolute",
    height: 112,
    width: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: "transparent",
    borderTopColor: "#087568",
    borderRightColor: "#087568",
  },
  // Inner arc — thinner, rotates the opposite way for a premium feel.
  spinnerArcInner: {
    position: "absolute",
    height: 94,
    width: 94,
    borderRadius: 47,
    borderWidth: 2,
    borderColor: "transparent",
    borderBottomColor: "#10B981",
    borderLeftColor: "#10B981",
  },
  loaderBadge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D1FAE5",
    borderRadius: 38,
    height: 76,
    width: 76,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  ballotEmoji: { fontSize: 34 },

  // --- Text ---
  title: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  description: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 330,
    textAlign: "center",
  },

  // --- Progress ---
  progressTrack: {
    marginTop: 24,
    width: "82%",
    height: 8,
    borderRadius: 8,
    backgroundColor: "#D1FAE5",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#10B981",
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: "rgba(255,255,255,0.55)",
    transform: [{ skewX: "-20deg" }],
  },

  // --- Status row ---
  statusRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#D1FAE5",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  statusDot: {
    backgroundColor: "#10B981",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  statusText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "800",
    marginLeft: 6,
  },

  // --- Skeleton voter cards ---
  skeletonCard: {
    width: "100%",
    marginTop: 28,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5F4EE",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  skelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skelAvatar: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: "#D1FAE5",
  },
  skelLines: { flex: 1, gap: 8 },
  skelLine: {
    height: 10,
    borderRadius: 6,
    backgroundColor: "#D1FAE5",
  },
});
