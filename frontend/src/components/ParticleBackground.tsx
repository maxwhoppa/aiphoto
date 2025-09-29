import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebFriendlyParticles } from './WebFriendlyParticles';

interface ParticleBackgroundProps {
  children: React.ReactNode;
  intensity?: 'low' | 'medium' | 'high';
  enabled?: boolean;
}

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  children,
  intensity = 'medium',
  enabled = true,
}) => {
  return (
    <View style={styles.container}>
      {enabled && <WebFriendlyParticles intensity={intensity} particleCount={15} />}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
});