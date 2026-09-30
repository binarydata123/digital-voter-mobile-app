import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getDefaultPoliticianRoute,
  loginPolitician,
  logoutPolitician,
} from "@/services/authentication";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (phone.trim().length < 10 || !password) {
      Alert.alert(
        "Login required",
        "Enter politician phone number and password.",
      );
      return;
    }

    setLoading(true);
    try {
      const { user } = await loginPolitician({ phone: phone.trim(), password });
      const nextRoute = getDefaultPoliticianRoute(user);

      if (!nextRoute) {
        logoutPolitician();
        Alert.alert(
          "Access disabled",
          "No mobile pages are enabled for this politician account.",
        );
        return;
      }

      router.replace(nextRoute);
    } catch (error: any) {
      Alert.alert("Unable to login", error?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.hero}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Image
                source={require("../../assets/icons/election_icon_192x192.png")}
                style={styles.brandIcon}
                contentFit="contain"
              />
            </View>
            <View>
              <Text style={styles.brandTitle}>Digital Voter</Text>
              <Text style={styles.brandMeta}>POLITICIAN APP</Text>
            </View>
          </View>

          <Text style={styles.headline}>
            Manage voters, booths, and election work securely.
          </Text>
          <Text style={styles.subhead}>
            Login with your VoterSakha politician account to access your
            assigned voter list.
          </Text>
        </View>

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.formTitle}>Politician Login</Text>

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            value={phone}
            onChangeText={(value) =>
              setPhone(value.replace(/\D/g, "").slice(0, 10))
            }
            keyboardType="phone-pad"
            placeholder="Enter 10 digit number"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            maxLength={10}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowPassword((value) => !value)}
              style={styles.smallButton}
            >
              <Text style={styles.smallButtonText}>
                {showPassword ? "Hide" : "Show"}
              </Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.loginButton,
              (pressed || loading) && styles.loginButtonPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  hero: {
    backgroundColor: "#134E4A",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 71,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  brandIcon: {
    width: 40,
    height: 40,
  },
  brandTitle: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },
  brandMeta: {
    color: "#6EE7B7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  headline: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    marginBottom: 12,
    maxWidth: 350,
  },
  subhead: {
    color: "#CCFBF1",
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 350,
  },
  sheet: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 30,
    marginTop: -28,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 22,
  },
  formTitle: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 22,
  },
  label: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 15,
    marginBottom: 16,
    outlineWidth: 0,
    outlineColor: "transparent",
  },
  passwordRow: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 15,
    marginBottom: 20,
  },
  passwordInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 0,
    outlineWidth: 0,
    outlineColor: "transparent",
  },
  smallButton: {
    height: 40,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButtonText: {
    color: "#0F766E",
    fontSize: 12,
    fontWeight: "900",
  },
  loginButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#134E4A",
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonPressed: {
    opacity: 0.82,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});
