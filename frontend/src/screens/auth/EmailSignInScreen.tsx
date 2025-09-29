import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { BackButton } from '../../components/BackButton';

interface EmailSignInScreenProps {
  onSuccess: () => void;
  onBack?: () => void;
}

export const EmailSignInScreen: React.FC<EmailSignInScreenProps> = ({
  onSuccess,
  onBack,
}) => {
  const { colors } = useTheme();
  const { signIn, signUp, confirmSignUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'verify'>('signup');

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email, password);
      onSuccess();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Invalid Password', 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password);
      setMode('verify');
      Alert.alert('Check Your Email', 'We sent you a verification code. Please check your email and enter the code below.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit verification code');
      return;
    }

    setIsLoading(true);
    try {
      await confirmSignUp(email, verificationCode);
      Alert.alert(
        'Success!', 
        'Your account has been verified and you are now signed in.',
        [{ text: 'OK', onPress: onSuccess }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {onBack && <BackButton onPress={onBack} />}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="none"
          automaticallyAdjustKeyboardInsets={true}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Verify Email'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {mode === 'signin' ? 'Welcome back! Sign in to your account' : 
                 mode === 'signup' ? 'Create a new account to get started' :
                 `Enter the verification code sent to ${email}`}
              </Text>
            </View>

            <View style={styles.form}>
              {mode === 'verify' ? (
                <>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.text,
                        textAlign: 'center',
                        fontSize: 18,
                        letterSpacing: 4,
                      },
                    ]}
                    value={verificationCode}
                    onChangeText={(text) => setVerificationCode(text.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={6}
                  />

                  <TouchableOpacity
                    style={[
                      styles.button,
                      {
                        backgroundColor: verificationCode.length === 6 && !isLoading ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={handleVerifyCode}
                    disabled={verificationCode.length !== 6 || isLoading}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        {
                          color: verificationCode.length === 6 && !isLoading ? colors.background : colors.textSecondary,
                        },
                      ]}
                    >
                      {isLoading ? 'Verifying...' : 'Verify & Sign In'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => {
                      setMode('signup');
                      setVerificationCode('');
                    }}
                  >
                    <Text style={[styles.linkText, { color: colors.primary }]}>
                      Didn't receive code? Try again
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email Address"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    blurOnSubmit={false}
                  />

                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType={mode === 'signin' ? 'done' : 'next'}
                    blurOnSubmit={false}
                  />

                  {mode === 'signup' && (
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          color: colors.text,
                          letterSpacing: 0,
                        },
                      ]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm Password"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry
                      autoCapitalize="none"
                      autoComplete="password"
                      textContentType="password"
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  )}

                  <TouchableOpacity
                    style={[
                      styles.button,
                      {
                        backgroundColor: email && password && (mode === 'signin' || confirmPassword) && !isLoading ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={mode === 'signin' ? handleSignIn : handleSignUp}
                    disabled={!email || !password || (mode === 'signup' && !confirmPassword) || isLoading}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        {
                          color: email && password && (mode === 'signin' || confirmPassword) && !isLoading ? colors.background : colors.textSecondary,
                        },
                      ]}
                    >
                      {isLoading ? (mode === 'signin' ? 'Signing In...' : 'Creating Account...') : (mode === 'signin' ? 'Sign In' : 'Create Account')}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                    <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  </View>

                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => {
                      setMode(mode === 'signin' ? 'signup' : 'signin');
                      setPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    <Text style={[styles.linkText, { color: colors.primary }]}>
                      {mode === 'signin' ? 'Need an account? Sign Up' : 'Already have an account? Sign In'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    justifyContent: 'center',
    minHeight: 600,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  form: {
    gap: 20,
    zIndex: 10,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    zIndex: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 15,
    fontSize: 14,
    fontWeight: '500',
  },
  linkButton: {
    alignItems: 'center',
    padding: 10,
    zIndex: 10,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '500',
  },
});