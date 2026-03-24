import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppTheme, useAppTheme } from "../theme";

interface CreateMenuBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onAction: (action: "go_live" | "create_reel") => void;
}

export default function CreateMenuBottomSheet({ visible, onClose, onAction }: CreateMenuBottomSheetProps) {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const menuItems: { id: "go_live" | "create_reel"; icon: keyof typeof Ionicons.glyphMap; label: string; desc: string }[] = [
    { id: "go_live", icon: "radio-outline", label: "Go Live", desc: "Start a live broadcasting session." },
    { id: "create_reel", icon: "film-outline", label: "Create Reel", desc: "Record and upload short form videos." },
  ];

  function handleAction(id: "go_live" | "create_reel") {
    onClose();
    setTimeout(() => onAction(id), 300); // Wait for modal slide out animation
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.menuSheet}>
          <View style={styles.menuHandle} />
          <Text style={styles.title}>What would you like to create?</Text>
          <View style={styles.menuDivider} />
          
          {menuItems.map((item) => (
            <TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => handleAction(item.id)} activeOpacity={0.6}>
              <View style={styles.iconContainer}>
                <Ionicons name={item.icon} size={24} color={theme.accent} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.menuItemLabel}>{item.label}</Text>
                <Text style={styles.menuItemDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
          <View style={styles.menuDivider} />
          
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) => StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  menuSheet: {
    backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 40 : 24, paddingHorizontal: 24,
    borderWidth: 1, borderBottomWidth: 0, borderColor: theme.border,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 24 },
    }),
  },
  menuHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: theme.border, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "800", color: theme.text, marginBottom: 16, textAlign: "center" },
  menuDivider: { height: 1, backgroundColor: theme.border, marginVertical: 8 },
  
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16 },
  iconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.surfaceAlt, justifyContent: "center", alignItems: "center", marginRight: 14 },
  textContainer: { flex: 1 },
  menuItemLabel: { fontSize: 17, fontWeight: "700", color: theme.text, marginBottom: 2 },
  menuItemDesc: { fontSize: 13, color: theme.textMuted },
  
  cancelBtn: { marginTop: 8, paddingVertical: 14, alignItems: "center", borderRadius: 12, backgroundColor: theme.surfaceAlt },
  cancelText: { fontSize: 16, fontWeight: "700", color: theme.text },
});
