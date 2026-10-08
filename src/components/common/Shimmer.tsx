import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View, type ViewProps } from "react-native";

export function Shimmer({ children, style, ...props }: ViewProps) {
  const [progress] = useState(() => new Animated.Value(0));
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!width) return;
    progress.setValue(0);
    const animation = Animated.loop(Animated.timing(progress, {
      toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true,
      isInteraction: false,
    }));
    animation.start();
    return () => animation.stop();
  }, [progress, width]);
  return <View {...props} style={[style, { overflow: "hidden" }]} onLayout={(event) => {
    setWidth(event.nativeEvent.layout.width);
    props.onLayout?.(event);
  }}>
    {children}
    {width > 0 && <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.shine, {
      transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-80, width + 80] }) }],
    }]}>
      {[0.08, 0.18, 0.3, 0.4, 0.3, 0.18, 0.08].map((opacity, index) => <View key={index} style={{ flex: 1, backgroundColor: `rgba(255,255,255,${opacity})` }} />)}
    </Animated.View>}
  </View>;
}
const styles = StyleSheet.create({ shine: { position: "absolute", top: 0, bottom: 0, left: 0, width: 80, flexDirection: "row" } });
