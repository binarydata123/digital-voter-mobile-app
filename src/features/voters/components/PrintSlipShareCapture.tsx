import { exportBanner } from "@/features/banner-generation/export-banner";
import type { Voter } from "@/services/voters";
import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { VoterSlipPaper } from "./VoterSlipPreview";

export function PrintSlipShareCapture({ voter, bannerImage, onComplete }: { voter: Voter; bannerImage?: string; onComplete: () => void }) {
  const ref = useRef<View>(null);
  const started = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [bannerLoaded, setBannerLoaded] = useState(!bannerImage);
  const [bannerFailed, setBannerFailed] = useState(false);
  useEffect(() => {
    if (!bannerImage || bannerLoaded) return;
    const timeout = setTimeout(() => setBannerFailed(true), 15000);
    return () => clearTimeout(timeout);
  }, [bannerImage, bannerLoaded]);
  useEffect(() => {
    if (bannerFailed && !started.current) {
      started.current = true;
      Alert.alert("Share failed", "Unable to load the slip banner. Check your connection and try again.");
      onComplete();
      return;
    }
    if (!bannerLoaded) return;
    if (!size.width || !size.height || started.current) return;
    const frame = requestAnimationFrame(() => {
      started.current = true;
      exportBanner(ref, "share", size.width, size.height)
        .catch((error) => Alert.alert("Share failed", error instanceof Error ? error.message : "Unable to share the slip image."))
        .finally(onComplete);
    });
    return () => cancelAnimationFrame(frame);
  }, [size, onComplete, bannerLoaded, bannerFailed]);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", left: -10000, top: 0, width: 420 }}>
    <View ref={ref} collapsable={false} onLayout={(event) => {
      const { width, height } = event.nativeEvent.layout;
      setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    }}><VoterSlipPaper voter={voter} showBanner={Boolean(bannerImage)} bannerImage={bannerImage} onBannerLoad={() => setBannerLoaded(true)} onBannerError={() => setBannerFailed(true)} /></View>
  </View>;
}
