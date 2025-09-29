import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Particle {
  id: number;
  x: Animated.Value;
  y: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  duration: number;
  delay: number;
}

interface FlameParticlesProps {
  particleCount?: number;
  intensity?: 'low' | 'medium' | 'high';
}

export const FlameParticles: React.FC<FlameParticlesProps> = ({
  particleCount = 25,
  intensity = 'medium',
}) => {
  const { colors } = useTheme();
  const particles = useRef<Particle[]>([]);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Create particles
  useEffect(() => {
    particles.current = Array.from({ length: particleCount }, (_, index) => ({
      id: index,
      x: new Animated.Value(Math.random() * screenWidth),
      y: new Animated.Value(screenHeight + 50),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.8 + Math.random() * 0.5),
      duration: 4000 + Math.random() * 2000, // 4-6 seconds
      delay: Math.random() * 500, // Shorter delay to see them faster
    }));
  }, [particleCount, screenWidth, screenHeight]);

  // Animation function for a single particle
  const animateParticle = (particle: Particle) => {
    // Reset particle to bottom
    particle.x.setValue(Math.random() * screenWidth);
    particle.y.setValue(screenHeight + 50);
    particle.opacity.setValue(0);
    
    const wobbleAmount = intensity === 'high' ? 60 : intensity === 'medium' ? 40 : 20;
    const endY = -100 - Math.random() * 200;

    return Animated.sequence([
      // Fade in
      Animated.timing(particle.opacity, {
        toValue: 0.9 + Math.random() * 0.1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Main movement with wobble
      Animated.parallel([
        // Upward movement
        Animated.timing(particle.y, {
          toValue: endY,
          duration: particle.duration,
          useNativeDriver: true,
        }),
        // Horizontal wobble
        Animated.loop(
          Animated.sequence([
            Animated.timing(particle.x, {
              toValue: particle.x._value + wobbleAmount,
              duration: 800 + Math.random() * 400,
              useNativeDriver: true,
            }),
            Animated.timing(particle.x, {
              toValue: particle.x._value - wobbleAmount,
              duration: 800 + Math.random() * 400,
              useNativeDriver: true,
            }),
          ]),
          { iterations: -1 }
        ),
        // Scale pulsing
        Animated.loop(
          Animated.sequence([
            Animated.timing(particle.scale, {
              toValue: 0.3 + Math.random() * 0.4,
              duration: 600 + Math.random() * 400,
              useNativeDriver: true,
            }),
            Animated.timing(particle.scale, {
              toValue: 0.8 + Math.random() * 0.4,
              duration: 600 + Math.random() * 400,
              useNativeDriver: true,
            }),
          ]),
          { iterations: -1 }
        ),
        // Fade out towards the end
        Animated.sequence([
          Animated.delay(particle.duration * 0.7),
          Animated.timing(particle.opacity, {
            toValue: 0,
            duration: particle.duration * 0.3,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);
  };

  // Start animation loop
  useEffect(() => {
    const startAnimation = () => {
      const animations = particles.current.map((particle, index) => 
        Animated.loop(
          Animated.sequence([
            Animated.delay(particle.delay + index * 100),
            animateParticle(particle),
            Animated.delay(Math.random() * 1000), // Random delay before restart
          ]),
          { iterations: -1 }
        )
      );

      animationRef.current = Animated.parallel(animations);
      animationRef.current.start();
    };

    startAnimation();

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, []);

  // Get flame colors based on theme
  const getFlameColors = () => {
    const baseColors = ['#FF6B35', '#FF8E53', '#FF9500', '#FFB347', '#FFA500'];
    
    // Mix with theme primary color for consistency
    return baseColors.map(color => {
      // If using dark theme, make particles more vibrant
      if (colors.background === '#1A1A1A') {
        return color;
      }
      // For light themes, slightly muted
      return color + 'CC'; // Add some transparency
    });
  };

  const flameColors = getFlameColors();

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.current.map((particle, index) => {
        const color = flameColors[index % flameColors.length];
        
        return (
          <Animated.View
            key={particle.id}
            style={[
              styles.particle,
              {
                backgroundColor: color,
                transform: [
                  { translateX: particle.x },
                  { translateY: particle.y },
                  { scale: particle.scale },
                ],
                opacity: particle.opacity,
              },
            ]}
          />
        );
      })}
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
    zIndex: 1000, // Above content temporarily to test
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 12,
    borderRadius: 3,
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 10,
  },
});