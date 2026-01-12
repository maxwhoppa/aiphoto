import React, { useState } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import * as StoreReview from 'expo-store-review';
import { useTheme } from '../context/ThemeContext';
import { Text } from './Text';
import { submitFeedback } from '../services/api';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

type FeedbackStep = 'initial' | 'collect-feedback';
type FeedbackSignal = 'positive' | 'neutral' | 'negative';

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const [step, setStep] = useState<FeedbackStep>('initial');
  const [selectedSignal, setSelectedSignal] = useState<FeedbackSignal | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignalSelect = async (signal: FeedbackSignal) => {
    setSelectedSignal(signal);

    if (signal === 'positive') {
      // Submit positive feedback and request App Store review
      try {
        await submitFeedback('positive');

        // Try to open the native review prompt
        if (await StoreReview.hasAction()) {
          await StoreReview.requestReview();
        }
      } catch (error) {
        console.error('Error submitting positive feedback:', error);
      }

      handleClose();
    } else {
      // Show text input for neutral/negative feedback
      setStep('collect-feedback');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedSignal || !feedbackText.trim()) return;

    setIsSubmitting(true);
    try {
      await submitFeedback(selectedSignal, feedbackText.trim());
      handleClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset state
    setStep('initial');
    setSelectedSignal(null);
    setFeedbackText('');
    setIsSubmitting(false);
    onClose();
  };

  const handleSkip = async () => {
    // Submit feedback without text
    if (selectedSignal) {
      try {
        await submitFeedback(selectedSignal);
      } catch (error) {
        console.error('Error submitting feedback:', error);
      }
    }
    handleClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
          {step === 'initial' ? (
            <>
              <Text variant="title" style={[styles.title, { color: colors.text }]}>
                Are you enjoying Dreamboat?
              </Text>
              <Text variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>
                Please leave your feedback
              </Text>

              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[styles.optionButton, { backgroundColor: colors.background }]}
                  onPress={() => handleSignalSelect('positive')}
                >
                  <Text style={styles.optionEmoji}>😍</Text>
                  <Text style={[styles.optionText, { color: colors.text }]}>Yes!</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionButton, { backgroundColor: colors.background }]}
                  onPress={() => handleSignalSelect('neutral')}
                >
                  <Text style={styles.optionEmoji}>😐</Text>
                  <Text style={[styles.optionText, { color: colors.text }]}>Meh</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionButton, { backgroundColor: colors.background }]}
                  onPress={() => handleSignalSelect('negative')}
                >
                  <Text style={styles.optionEmoji}>😞</Text>
                  <Text style={[styles.optionText, { color: colors.text }]}>No</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
              >
                <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>
                  Maybe later
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text variant="title" style={[styles.title, { color: colors.text }]}>
                We'd love to hear from you
              </Text>
              <Text variant="body" style={[styles.subtitle, { color: colors.textSecondary }]}>
                What could we do better?
              </Text>

              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="Tell us what you think..."
                placeholderTextColor={colors.textSecondary}
                value={feedbackText}
                onChangeText={setFeedbackText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  {
                    backgroundColor: feedbackText.trim() && !isSubmitting
                      ? colors.primary
                      : colors.border,
                  },
                ]}
                onPress={handleSubmitFeedback}
                disabled={!feedbackText.trim() || isSubmitting}
              >
                <Text
                  style={[
                    styles.submitButtonText,
                    {
                      color: feedbackText.trim() && !isSubmitting
                        ? colors.background
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleSkip}
              >
                <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>
                  Skip
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
    gap: 12,
  },
  optionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingTop: 24,
    borderRadius: 12,
  },
  optionEmoji: {
    fontSize: 32,
    marginBottom: 8,
    lineHeight: 40,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 12,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  textInput: {
    width: '100%',
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  submitButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
