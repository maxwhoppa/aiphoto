import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Text } from '../../components/Text';
import { updatePhoneNumber } from '../../services/api';

interface PhoneNumberScreenProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const PhoneNumberScreen: React.FC<PhoneNumberScreenProps> = ({
  onComplete,
  onSkip,
}) => {
  const { colors } = useTheme();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatPhoneNumber = (text: string) => {
    // Remove all non-digits
    const digits = text.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
  };

  const handleSubmit = async () => {
    if (!phoneNumber) {
      return;
    }

    setIsLoading(true);
    try {
      // Extract just the digits for storage
      const digitsOnly = phoneNumber.replace(/\D/g, '');
      await updatePhoneNumber(digitsOnly);
      onComplete();
    } catch (error) {
      console.error('Error updating phone number:', error);
      // Still allow them to continue even on error
      onComplete();
    } finally {
      setIsLoading(false);
    }
  };

  const isValidPhone = phoneNumber.replace(/\D/g, '').length >= 10;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text variant="title" style={[styles.title, { color: colors.text }]}>
                Add Your Phone Number
              </Text>
              <Text variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>
                We'll use this to notify you when your photos are ready and for important account updates.
              </Text>
            </View>

            <View style={styles.form}>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={phoneNumber}
                onChangeText={handlePhoneChange}
                placeholder="(555) 555-5555"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={14}
              />

              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: isValidPhone && !isLoading ? colors.primary : colors.border,
                  },
                ]}
                onPress={handleSubmit}
                disabled={!isValidPhone || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text
                    variant="button"
                    style={[
                      styles.buttonText,
                      {
                        color: isValidPhone ? colors.background : colors.textSecondary,
                      },
                    ]}
                  >
                    Continue
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={onSkip}
                disabled={isLoading}
              >
                <Text variant="body" style={[styles.skipText, { color: colors.textSecondary }]}>
                  Skip for now
                </Text>
              </TouchableOpacity>
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
    minHeight: 400,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
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
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 1,
  },
  button: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    alignItems: 'center',
    padding: 15,
  },
  skipText: {
    fontSize: 16,
  },
});
