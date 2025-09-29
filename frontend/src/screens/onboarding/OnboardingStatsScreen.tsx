import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { OnboardingButton } from '../../components/OnboardingButton';
import { BackButton } from '../../components/BackButton';

interface OnboardingStatsScreenProps {
  onNext: () => void;
  onBack: (() => void) | null;
}

export const OnboardingStatsScreen: React.FC<OnboardingStatsScreenProps> = ({
  onNext,
  onBack,
}) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {onBack && <BackButton onPress={onBack} />}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            The Dating Reality
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Here's what the data shows about online dating
          </Text>
        </View>

        <View style={styles.chartContainer}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Distribution of Likes/Matches
          </Text>
          
          <View style={[styles.chart, { backgroundColor: colors.surface }]}>
            {/* Top 1% */}
            <View style={styles.chartRow}>
              <View style={[styles.chartLabel, { width: screenWidth * 0.15 }]}>
                <Text style={[styles.labelText, { color: colors.text }]}>Top 1%</Text>
              </View>
              <View style={styles.chartBarContainer}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      backgroundColor: colors.error,
                      width: '25%', // 25% of all likes
                    }
                  ]}
                />
                <Text style={[styles.percentageText, { color: colors.text }]}>25%</Text>
              </View>
            </View>

            {/* Top 10% */}
            <View style={styles.chartRow}>
              <View style={[styles.chartLabel, { width: screenWidth * 0.15 }]}>
                <Text style={[styles.labelText, { color: colors.text }]}>Top 10%</Text>
              </View>
              <View style={styles.chartBarContainer}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      backgroundColor: colors.warning,
                      width: '45%', // 45% more (70% total)
                    }
                  ]}
                />
                <Text style={[styles.percentageText, { color: colors.text }]}>45%</Text>
              </View>
            </View>

            {/* Bottom 90% */}
            <View style={styles.chartRow}>
              <View style={[styles.chartLabel, { width: screenWidth * 0.15 }]}>
                <Text style={[styles.labelText, { color: colors.text }]}>Other 90%</Text>
              </View>
              <View style={styles.chartBarContainer}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      backgroundColor: colors.border,
                      width: '30%', // Remaining 30%
                    }
                  ]}
                />
                <Text style={[styles.percentageText, { color: colors.text }]}>30%</Text>
              </View>
            </View>
          </View>

          <View style={styles.insight}>
            <Text style={[styles.insightText, { color: colors.textSecondary }]}>
              💡 The top 10% of men receive 70% of all likes and matches
            </Text>
          </View>
        </View>

        <View style={styles.bottomText}>
          <Text style={[styles.description, { color: colors.text }]}>
            Want to join the top 10%? It all starts with better photos.
          </Text>
        </View>
      </ScrollView>

      <OnboardingButton title="Show Me How" onPress={onNext} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    minHeight: 700,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 28,
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
  chartContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 30,
  },
  chart: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  chartLabel: {
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chartBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
  },
  chartBar: {
    height: 30,
    borderRadius: 15,
  },
  percentageText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  insight: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  insightText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  bottomText: {
    alignItems: 'center',
    marginBottom: 40,
  },
  description: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
    paddingHorizontal: 20,
  },
});