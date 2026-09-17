import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const { theme } = useTheme();

  const getButtonStyle = () => {
    const baseStyle = {
      ...styles.button,
      borderRadius: theme.borderRadius,
      borderWidth: theme.borderWidth,
      borderColor: theme.border,
      shadowColor: theme.shadow || '#000',
      shadowOffset: theme.shadowOffset,
      shadowOpacity: theme.shadowOpacity,
      shadowRadius: theme.shadowRadius,
      elevation: 2,
      ...(disabled && { opacity: 0.5 }),
    };

    switch (variant) {
      case 'primary':
        return { ...baseStyle, backgroundColor: theme.primary, borderColor: theme.primary };
      case 'secondary':
        return { ...baseStyle, backgroundColor: theme.surface };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: theme.borderWidth,
          borderColor: theme.primary,
          shadowOpacity: 0, // No shadow for outline button to keep it clean
          elevation: 0,
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyle = () => {
    const baseTextStyle = styles.text;

    switch (variant) {
      case 'primary':
        return { ...baseTextStyle, color: '#FFFFFF' };
      case 'secondary':
        return { ...baseTextStyle, color: theme.text };
      case 'outline':
        return { ...baseTextStyle, color: theme.primary };
      default:
        return baseTextStyle;
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : theme.primary} />
      ) : (
        <Text style={[getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});