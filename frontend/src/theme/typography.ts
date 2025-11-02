export const typography = {
  // Font families
  fontFamily: {
    regular: 'Poppins-Regular',
    semiBold: 'Poppins-SemiBold',
    bold: 'Poppins-Bold',
  },

  // Common text styles
  styles: {
    // Titles - use for main headings
    title: {
      fontFamily: 'Poppins-Bold',
      fontWeight: 'bold' as const,
    },

    // Subtitles - use for secondary headings and descriptions
    subtitle: {
      fontFamily: 'Poppins-Regular',
      fontWeight: 'normal' as const,
    },

    // Body text - use for regular content
    body: {
      fontFamily: 'Poppins-Regular',
      fontWeight: 'normal' as const,
    },

    // Button text - use for buttons and semi-bold elements
    button: {
      fontFamily: 'Poppins-SemiBold',
      fontWeight: '600' as const,
    },

    // Labels - use for form labels and small text
    label: {
      fontFamily: 'Poppins-SemiBold',
      fontWeight: '600' as const,
    },

    // Caption - use for small descriptive text
    caption: {
      fontFamily: 'Poppins-Regular',
      fontWeight: 'normal' as const,
    },
  },
} as const;

// Helper function to get typography style
export const getTypographyStyle = (variant: keyof typeof typography.styles) => {
  return typography.styles[variant];
};