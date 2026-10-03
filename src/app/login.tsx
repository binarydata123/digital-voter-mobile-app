import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { Eye, EyeOff, Lock, Phone, X } from "lucide-react-native";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);

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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header / Logo Section */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require("../../assets/icons/new-bg.png")}
                style={styles.logoIcon}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>
              Lok<Text style={styles.brandTitleBold}>Setu</Text>
            </Text>
            <Text style={styles.brandMeta}>POLITICIAN APP</Text>
          </View>

          {/* Form Card Section */}
          <View style={styles.formCard}>
            <Text style={styles.headline}>Welcome Back</Text>
            <Text style={styles.subHeadline}>
              Access your politician portal
            </Text>

            {/* Phone Input */}
            <Text style={styles.label}>PHONE NUMBER</Text>
            <View style={styles.inputWrapper}>
              <Phone
                size={18}
                color="#4A5568"
                style={styles.inputIcon}
                strokeWidth={2}
              />
              <TextInput
                value={phone}
                onChangeText={(value) =>
                  setPhone(value.replace(/\D/g, "").slice(0, 10))
                }
                keyboardType="phone-pad"
                placeholder="Enter 10 digit number"
                placeholderTextColor="#718096"
                returnKeyType="next"
                style={styles.input}
                maxLength={10}
                onSubmitEditing={() => passwordInputRef.current?.focus()}
              />
              {phone ? (
                <Pressable
                  accessibilityLabel="Clear phone number"
                  accessibilityRole="button"
                  onPress={() => setPhone("")}
                  style={styles.clearButton}
                >
                  <X size={20} color="#718096" strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>

            {/* Password Input */}
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Lock
                size={18}
                color="#4A5568"
                style={styles.inputIcon}
                strokeWidth={2}
              />
              <TextInput
                ref={passwordInputRef}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#718096"
                secureTextEntry={!showPassword}
                returnKeyType="done"
                style={styles.input}
                onSubmitEditing={handleLogin}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowPassword((value) => !value)}
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#718096" strokeWidth={2} />
                ) : (
                  <Eye size={20} color="#718096" strokeWidth={2} />
                )}
              </Pressable>
            </View>

            {/* 
              SIGN IN BUTTON 
              Ab yeh ek proper button ki tarah dikhega (green background, white text)
            */}
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
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.loginButtonText}>Sign in</Text>
              )}
            </Pressable>
          </View>

          {/* Footer Text */}
          <Text style={styles.footerText}>
            Manage voters, booths, and election work securely. Login with your
            LokSetu politician account to access your assigned voter list.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0A1118",
  },
  container: {
    flex: 1,
    backgroundColor: "#0A1118",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoContainer: {
    width: 60,
    height: 60,
    marginBottom: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F4C4E",
    borderRadius: 16,
    shadowColor: "#0F4C4E",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
  },
  logoIcon: {
    width: 48,
    height: 48,
  },
  brandTitle: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "400",
    letterSpacing: 1,
    marginBottom: 4,
  },
  brandTitleBold: {
    fontWeight: "900",
    color: "#00B4D8",
  },
  brandMeta: {
    color: "#6EE7B7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: "#131C24",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1F2E3A",
  },
  headline: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subHeadline: {
    fontSize: 14,
    color: "#A0AEC0",
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A0AEC0",
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F4F8",
    borderRadius: 8,
    height: 52,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
    color: "#4A5568",
  },
  input: {
    flex: 1,
    height: "100%",
    color: "#1A202C",
    fontSize: 15,
    fontWeight: "500",
  },
  clearButton: {
    padding: 4,
  },
  eyeButton: {
    padding: 4,
  },
  // YAHAN BUTTON KA STYLE UPDATE KIYA GAYA HAI
  loginButton: {
    height: 52,
    borderRadius: 8,
    backgroundColor: "#0F4C4E", // Green background
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 8,
    width: "100%", // Full width button
  },
  loginButtonPressed: {
    opacity: 0.85,
  },
  loginButtonText: {
    color: "#FFFFFF", // White text
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center", // Text ko horizontally center karega
    width: "100%", // Poori width lega taaki center align ho sake
  },
  footerText: {
    textAlign: "center",
    fontSize: 11,
    color: "#4A5568",
    marginTop: 32,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
