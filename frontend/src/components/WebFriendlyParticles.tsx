import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

interface Particle {
  id: number;
  x: number;
  y: number;
  opacity: number;
  size: number;
  speed: number;
  wobble: number;
  wobbleSpeed: number;
  color: string;
}

interface WebFriendlyParticlesProps {
  particleCount?: number;
  intensity?: 'low' | 'medium' | 'high';
}

export const WebFriendlyParticles: React.FC<WebFriendlyParticlesProps> = ({
  particleCount = 30,
  intensity = 'medium',
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  const flameColors = ['#FF6B35', '#FF8E53', '#FF9500', '#FFB347', '#FFA500'];

  // Initialize particles
  useEffect(() => {
    const initialParticles: Particle[] = Array.from({ length: particleCount }, (_, index) => ({
      id: index,
      x: screenWidth / 2, // Start from center
      y: screenHeight * 0.1 + Math.random() * (screenHeight * 0.8), // Random height between 10-90%
      opacity: 0.6 + Math.random() * 0.4,
      size: 2 + Math.random() * 3, // Smaller dots
      speed: 1 + Math.random() * 2, // Faster speed for quick movement
      color: flameColors[Math.floor(Math.random() * flameColors.length)],
    }));

    setParticles(initialParticles);
  }, [particleCount, screenWidth, screenHeight]);

  // Animation loop using requestAnimationFrame
  useEffect(() => {
    let animationFrame: number;

    const animate = () => {
      setParticles(prevParticles => 
        prevParticles.map(particle => {
          // Determine direction: left (-1) or right (1) based on particle ID
          const direction = particle.id % 2 === 0 ? -1 : 1;
          
          let newX = particle.x + (particle.speed * direction * 2); // Move horizontally outward (faster)
          let newY = particle.y - particle.speed; // Move upward
          let newOpacity = particle.opacity;

          // Reset particle when it goes off screen
          if (newX < -50 || newX > screenWidth + 50 || newY < -50) {
            newX = screenWidth / 2; // Back to center
            newY = screenHeight * 0.1 + Math.random() * (screenHeight * 0.8); // New random height 10-90%
            newOpacity = 0.6 + Math.random() * 0.4;
          }

          // Fade out as they get further from center
          const distanceFromCenter = Math.abs(newX - screenWidth / 2);
          const fadeDistance = screenWidth * 0.3; // Start fading at 30% from center
          if (distanceFromCenter > fadeDistance) {
            const fadeProgress = (distanceFromCenter - fadeDistance) / (screenWidth * 0.2);
            newOpacity = Math.max(0, particle.opacity * (1 - fadeProgress));
          }

          return {
            ...particle,
            x: newX,
            y: newY,
            opacity: newOpacity,
          };
        })
      );

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [screenWidth, screenHeight, intensity]);

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map(particle => (
        <View
          key={particle.id}
          style={[
            styles.particle,
            {
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              opacity: particle.opacity,
              borderRadius: particle.size / 2, // Make it circular
            },
          ]}
        />
      ))}
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
    zIndex: 1, // Above background, behind content
    overflow: 'hidden', // Prevent particles from escaping bounds
    pointerEvents: 'none', // Ensure no interference with interactions
  },
  particle: {
    position: 'absolute',
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.6,
    shadowRadius: 3,
  },
});