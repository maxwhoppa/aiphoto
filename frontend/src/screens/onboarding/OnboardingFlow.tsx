import React, { useState } from 'react';
import { View } from 'react-native';
import { OnboardingIntroScreen } from './OnboardingIntroScreen';
import { OnboardingStatsScreen } from './OnboardingStatsScreen';
import { OnboardingPhotosScreen } from './OnboardingPhotosScreen';
import { OnboardingSolutionScreen } from './OnboardingSolutionScreen';

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderCurrentScreen = () => {
    switch (currentStep) {
      case 0:
        return <OnboardingIntroScreen onNext={nextStep} onBack={null} />;
      case 1:
        return <OnboardingStatsScreen onNext={nextStep} onBack={prevStep} />;
      case 2:
        return <OnboardingPhotosScreen onNext={nextStep} onBack={prevStep} />;
      case 3:
        return <OnboardingSolutionScreen onNext={nextStep} onBack={prevStep} />;
      default:
        return <OnboardingIntroScreen onNext={nextStep} onBack={null} />;
    }
  };

  return <View style={{ flex: 1 }}>{renderCurrentScreen()}</View>;
};