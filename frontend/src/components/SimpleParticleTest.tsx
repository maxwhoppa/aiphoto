import React from 'react';
import { View, StyleSheet } from 'react-native';

export const SimpleParticleTest: React.FC = () => {
  return (
    <View style={styles.container} pointerEvents="none">
      {/* Static test particles */}
      <View style={[styles.particle, { top: 100, left: 50 }]} />
      <View style={[styles.particle, { top: 200, left: 150 }]} />
      <View style={[styles.particle, { top: 300, left: 250 }]} />
      <View style={[styles.particle, { top: 400, left: 100 }]} />
      <View style={[styles.particle, { top: 500, left: 200 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  particle: {
    position: 'absolute',
    width: 10,
    height: 15,
    backgroundColor: '#FF6B35',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FF0000',
  },
});