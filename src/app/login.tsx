import { Redirect, router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useLoginDestination } from "@/hooks/use-login-destination";

import {
  getDefaultPoliticianRoute,
  loginPolitician,
  logoutPolitician,
} from "@/services/authentication";
import { Eye, EyeOff, Lock, Phone, X } from "lucide-react-native";

export default function LoginScreen() {
  const destination = useLoginDestination();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [loginError, setLoginError] = useState("");
  const passwordInputRef = useRef<TextInput>(null);

  async function handleLogin() {
    if (loading) return;
    const nextPhoneError = !phone.trim()
      ? "Phone number is required."
      : phone.trim().length !== 10
        ? "Enter a valid 10 digit phone number."
        : "";
    const nextPasswordError = !password ? "Password is required." : "";
    setPhoneError(nextPhoneError);
    setPasswordError(nextPasswordError);
    setLoginError("");
    if (nextPhoneError || nextPasswordError) return;

    setLoading(true);
    try {
      const { user } = await loginPolitician({ phone: phone.trim(), password });
      const nextRoute = getDefaultPoliticianRoute(user);

      if (!nextRoute) {
        logoutPolitician();
        setLoginError(
          "No mobile pages are enabled for this politician account.",
        );
        return;
      }

      router.replace(nextRoute);
    } catch (error: any) {
      setLoginError(error?.message ?? "Unable to login. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!destination) return null;
  if (destination !== "/login") return <Redirect href={destination} />;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
        style={styles.container}>
        <ScrollView
          style={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* Header / Logo Section */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image
                  source={require("../../assets/icons/logo.png")}
                  style={styles.logoIcon}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandTitle}>
                Politic<Text style={styles.brandTitleBold}>Ease</Text>
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
                  onChangeText={(value) => {
                    setPhone(value.replace(/\D/g, "").slice(0, 10));
                    setPhoneError("");
                    setLoginError("");
                  }}
                  keyboardType="phone-pad"
                  placeholder="Enter 10 digit number"
                  placeholderTextColor="#A0AEC0"
                  returnKeyType="next"
                  style={styles.input}
                  maxLength={10}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                />
                {phone ? (
                  <Pressable
                    accessibilityLabel="Clear phone number"
                    accessibilityRole="button"
                    onPress={() => {
                      setPhone("");
                      setPhoneError("");
                      setLoginError("");
                    }}
                    style={styles.clearButton}>
                    <X size={20} color="#718096" strokeWidth={2} />
                  </Pressable>
                ) : null}
              </View>
              {phoneError ? (
                <Text accessibilityRole="alert" style={styles.fieldError}>
                  {phoneError}
                </Text>
              ) : null}

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
                  onChangeText={(value) => {
                    setPassword(value);
                    setPasswordError("");
                    setLoginError("");
                  }}
                  placeholder="••••••••"
                  placeholderTextColor="#A0AEC0"
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  style={styles.input}
                  onSubmitEditing={handleLogin}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.eyeButton}>
                  {showPassword ? (
                    <EyeOff size={20} color="#718096" strokeWidth={2} />
                  ) : (
                    <Eye size={20} color="#718096" strokeWidth={2} />
                  )}
                </Pressable>
              </View>
              {passwordError ? (
                <Text accessibilityRole="alert" style={styles.fieldError}>
                  {passwordError}
                </Text>
              ) : null}

              {/* Sign In Button */}
              <Pressable
                // Keep NativeWind from processing Pressable's style callback.
                cssInterop={false}
                accessibilityRole="button"
                disabled={loading}
                onPress={handleLogin}
                style={({ pressed }) => [
                  styles.loginButton,
                  (pressed || loading) && styles.loginButtonPressed,
                ]}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>Sign in</Text>
                )}
              </Pressable>
              {loginError ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {loginError}
                </Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    lineHeight: 18,
  },
  fieldError: {
    color: "#B91C1C",
    fontSize: 13,
    lineHeight: 18,
    marginTop: -12,
    marginBottom: 20,
  },
  safe: {
    flex: 1,
    backgroundColor: "#F4F7F6", // MATCHED: Light background from inner pages
  },
  container: {
    flex: 1,
    backgroundColor: "#F4F7F6", // MATCHED
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
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
    backgroundColor: "#12474B", // Kept dark green for brand identity
    borderRadius: 16,
    shadowColor: "#12474B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logoIcon: {
    width: 48,
    height: 48,
  },
  brandTitle: {
    fontSize: 24,
    color: "#1A202C", // MATCHED: Dark text for light background
    fontWeight: "400",
    letterSpacing: 1,
    marginBottom: 4,
  },
  brandTitleBold: {
    fontWeight: "900",
    color: "#0F4C4E", // MATCHED: Dark green instead of bright cyan
  },
  brandMeta: {
    color: "#0F4C4E", // MATCHED
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: "#FFFFFF", // MATCHED: White card like inner pages
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0", // MATCHED: Light border
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headline: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A202C", // MATCHED
    marginBottom: 4,
  },
  subHeadline: {
    fontSize: 14,
    color: "#718096", // MATCHED
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4A5568", // MATCHED
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC", // Slightly lighter gray for inputs
    borderRadius: 8,
    height: 52,
    marginBottom: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
  loginButton: {
    height: 52,
    borderRadius: 8,
    backgroundColor: "#0F4C4E", // Kept as requested
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 8,
    width: "100%",
  },
  loginButtonPressed: {
    opacity: 0.85,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
  footerText: {
    textAlign: "center",
    fontSize: 11,
    color: "#718096", // MATCHED: Darker gray so it's readable on light bg
    marginTop: 32,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
