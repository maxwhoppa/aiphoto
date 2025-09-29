import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ColorScheme } from '../theme/colors';
import { BackButton } from './BackButton';

interface ThemeSelectorProps {
  navigation?: any;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ navigation }) => {
  const { currentScheme, colors, availableSchemes, setColorScheme, updateColor } = useTheme();
  const [showColorEditor, setShowColorEditor] = useState(false);
  const [editingColor, setEditingColor] = useState<keyof ColorScheme | null>(null);
  const [colorValue, setColorValue] = useState('');

  const openColorEditor = (colorKey: keyof ColorScheme) => {
    setEditingColor(colorKey);
    setColorValue(colors[colorKey]);
    setShowColorEditor(true);
  };

  const saveColor = () => {
    if (editingColor && colorValue.match(/^#[0-9A-Fa-f]{6}$/)) {
      updateColor(editingColor, colorValue);
    }
    setShowColorEditor(false);
    setEditingColor(null);
  };

  const colorKeys: (keyof ColorScheme)[] = [
    'primary',
    'secondary',
    'background',
    'surface',
    'text',
    'textSecondary',
    'border',
    'success',
    'warning',
    'error',
    'accent',
  ];

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      {navigation && (
        <BackButton onPress={() => navigation.goBack()} />
      )}
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Theme Settings</Text>
      
      {/* Scheme Selector */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Color Scheme</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {availableSchemes.map((scheme) => (
            <TouchableOpacity
              key={scheme}
              style={[
                styles.schemeButton,
                { 
                  backgroundColor: currentScheme === scheme ? colors.primary : colors.surface,
                  borderColor: colors.border,
                }
              ]}
              onPress={() => setColorScheme(scheme)}
            >
              <Text
                style={[
                  styles.schemeText,
                  { 
                    color: currentScheme === scheme ? colors.background : colors.text,
                  }
                ]}
              >
                {scheme.charAt(0).toUpperCase() + scheme.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Color Editor */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Customize Colors</Text>
        <View style={styles.colorGrid}>
          {colorKeys.map((colorKey) => (
            <TouchableOpacity
              key={colorKey}
              style={styles.colorItem}
              onPress={() => openColorEditor(colorKey)}
            >
              <View
                style={[
                  styles.colorPreview,
                  { backgroundColor: colors[colorKey], borderColor: colors.border }
                ]}
              />
              <Text style={[styles.colorLabel, { color: colors.text }]}>
                {colorKey}
              </Text>
              <Text style={[styles.colorValue, { color: colors.textSecondary }]}>
                {colors[colorKey]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Color Editor Modal */}
      <Modal
        visible={showColorEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowColorEditor(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Edit {editingColor} Color
            </Text>
            
            <TextInput
              style={[
                styles.colorInput,
                { 
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                }
              ]}
              value={colorValue}
              onChangeText={setColorValue}
              placeholder="#000000"
              placeholderTextColor={colors.textSecondary}
              maxLength={7}
            />
            
            <View
              style={[
                styles.colorPreviewLarge,
                { 
                  backgroundColor: colorValue.match(/^#[0-9A-Fa-f]{6}$/) ? colorValue : colors.border,
                  borderColor: colors.border,
                }
              ]}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.border }]}
                onPress={() => setShowColorEditor(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={saveColor}
              >
                <Text style={[styles.modalButtonText, { color: colors.background }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },
  schemeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
  },
  schemeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  colorItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 20,
  },
  colorPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    marginBottom: 8,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  colorValue: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  colorInput: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  colorPreviewLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});