import { AlertCircle, X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

type LoginErrorModalProps = {
  message: string;
  onClose: () => void;
};

export function LoginErrorModal({ message, onClose }: LoginErrorModalProps) {
  return (
    <Modal
      transparent
      visible={Boolean(message)}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close login error"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close login error"
            onPress={onClose}
            style={styles.closeButton}
          >
            <X color="#64748B" size={21} />
          </Pressable>
          <View style={styles.icon}>
            <AlertCircle color="#B91C1C" size={29} />
          </View>
          <Text style={styles.title}>Unable to sign in</Text>
          <Text accessibilityRole="alert" style={styles.message}>
            {message}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 24,
    paddingTop: 30,
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 66,
    height: 66,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 33,
    backgroundColor: "#FEF2F2",
    marginBottom: 18,
  },
  title: { color: "#0F172A", fontSize: 19, fontWeight: "800" },
  message: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    width: "100%",
    minHeight: 48,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#087568",
  },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
});
