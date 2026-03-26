import { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
  ScrollView,
  useWindowDimensions,
} from "react-native";

const SCREEN_WIDTH = Dimensions.get("window").width;
import { useRouter, useFocusEffect, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { apiClient } from "../../src/api/client";
import { uploadReelVideo } from "../../src/api/uploads";
import { LiveSession, ApiResponse } from "../../src/types";
import { AppTheme, useAppTheme } from "../../src/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import ProfileMenuBottomSheet from "../../src/components/ProfileMenuBottomSheet";
import CreateMenuBottomSheet from "../../src/components/CreateMenuBottomSheet";
import ImageWithFallback from "../../src/components/ImageWithFallback";

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}


interface SessionListResponse {
  sessions: LiveSession[];
  total: number;
  page: number;
  totalPages: number;
}

type TabKey = "live" | "following";

export default function HomeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth > 600;
  const numColumns = isWide ? 2 : 1;
  const contentWidth = isWide ? Math.min(windowWidth, 1200) : windowWidth;
  const followingMaxWidth = 600;

  const [activeTab, setActiveTab] = useState<TabKey>("live");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [followingSessions, setFollowingSessions] = useState<LiveSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showGoLive, setShowGoLive] = useState(false);
  const [showReelForm, setShowReelForm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [reelTitle, setReelTitle] = useState("");
  const [reelDescription, setReelDescription] = useState("");
  const [reelVideo, setReelVideo] = useState<{ uri: string; mimeType: string; fileSize: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const { user } = useAuth();
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followingId, setFollowingId] = useState<string | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; avatarUrl?: string | null; bio?: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pagerRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const tabIndicatorX = scrollX.interpolate({
    inputRange: [0, windowWidth],
    outputRange: [0, windowWidth / 2],
    extrapolate: "clamp",
  });

  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiClient<ApiResponse<SessionListResponse>>("/sessions/live");
      setSessions(res.data.sessions);
    } catch (err: any) {
      console.error("Failed to fetch sessions:", err.message);
    }
  }, []);

  const fetchFollowingSessions = useCallback(async () => {
    try {
      const res = await apiClient<ApiResponse<SessionListResponse>>("/sessions/live/following");
      setFollowingSessions(res.data.sessions);
    } catch (err: any) {
      console.error("Failed to fetch following sessions:", err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchSessions();
      fetchFollowing();
      fetchFollowingSessions();
    }, [fetchSessions, fetchFollowingSessions])
  );

  const resetReelForm = useCallback(() => {
    setReelTitle("");
    setReelDescription("");
    setReelVideo(null);
    setShowReelForm(false);
  }, []);

  const handlePickReel = useCallback(async (source: "camera" | "gallery") => {
    const permission = source === "camera" 
      ? await ImagePicker.requestCameraPermissionsAsync() 
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", `Please allow access to your ${source === "camera" ? "camera" : "gallery"} to create a reel.`);
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["videos"],
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    };

    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setReelVideo({
        uri: asset.uri,
        mimeType: asset.mimeType || "video/mp4",
        fileSize: asset.fileSize || 0,
      });
      setShowReelForm(true);
    }
  }, []);

  const handlePostReel = useCallback(async () => {
    if (!reelTitle.trim() || !reelVideo) {
      Alert.alert("Error", "Title and video are required");
      return;
    }

    setUploading(true);
    try {
      const { videoUrl } = await uploadReelVideo(reelVideo);
      await apiClient("/sessions/reel", {
        method: "POST",
        body: {
          title: reelTitle.trim(),
          description: reelDescription.trim() || undefined,
          recordingUrl: videoUrl,
        },
      });

      Alert.alert("Success", "Your reel has been posted!");
      resetReelForm();
      handleRefresh();
    } catch (err: any) {
      Alert.alert("Upload Failed", err.message || "Something went wrong");
    } finally {
      setUploading(false);
    }
  }, [reelTitle, reelDescription, reelVideo, resetReelForm, handleRefresh]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchSessions(), fetchFollowing(), fetchFollowingSessions()]);
    setRefreshing(false);
  }

  async function fetchFollowing() {
    try {
      const res = await apiClient<ApiResponse<{ users: { id: string }[] }>>("/users/following");
      setFollowedIds(new Set((res.data.users || []).map((u) => u.id)));
    } catch {
      // silently fail — not critical
    }
  }

  async function handleFollow(hostId: string, e: any) {
    e.stopPropagation();
    if (!user || hostId === user.id) return;
    const isFollowing = followedIds.has(hostId);
    setFollowingId(hostId);
    try {
      await apiClient(`/users/${hostId}/${isFollowing ? "unfollow" : "follow"}`, { method: "POST" });
      setFollowedIds((prev) => {
        const next = new Set(prev);
        isFollowing ? next.delete(hostId) : next.add(hostId);
        return next;
      });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setFollowingId(null);
    }
  }

  function handleSearchChange(text: string) {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await apiClient<ApiResponse<{ users: { id: string; name: string; avatarUrl?: string | null; bio?: string | null }[] }>>(`/users/search?q=${encodeURIComponent(text.trim())}`);
        setSearchResults(res.data.users);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setSearching(false);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
  }

  function closeSearch() {
    setShowSearch(false);
    // Delay clearing results so they don't vanish during modal fade-out
    setTimeout(() => {
      clearSearch();
    }, 400);
  }

  function scrollToPage(index: number) {
    if (Platform.OS === "web") {
      Animated.spring(scrollX, {
        toValue: index * windowWidth,
        useNativeDriver: false,
      }).start();
    } else {
      pagerRef.current?.scrollTo({ x: index * windowWidth, animated: true });
    }
    setActiveTab(index === 0 ? "live" : "following");
  }

  function handlePageChange(e: any) {
    const page = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
    setActiveTab(page === 0 ? "live" : "following");
  }



  async function handleGoLive() {
    if (!sessionTitle.trim()) {
      Alert.alert("Error", "Please enter a session title");
      return;
    }
    setCreating(true);
    try {
      const res = await apiClient<ApiResponse<LiveSession>>("/sessions", {
        method: "POST",
        body: { title: sessionTitle.trim() },
      });
      setShowGoLive(false);
      setSessionTitle("");
      router.push(`/host/${res.data.id}`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setCreating(false);
    }
  }

  function renderSession({ item }: { item: LiveSession }) {
    const isOwn = item.hostId === user?.id;
    const isFollowed = followedIds.has(item.hostId);
    const isLoadingFollow = followingId === item.hostId;
    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => {
          if (isOwn) {
            router.push(`/host/${item.id}`);
          } else if (item.isLive) {
            router.push(`/viewer/${item.id}`);
          } else if (item.recordingUrl) {
            router.push(`/reels?startId=${item.id}&source=following`);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.sessionVideoPlaceholder}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={styles.thumbnailImage} />
          ) : (
            <Ionicons name="videocam" size={48} color={theme.textMuted} />
          )}

          {item.isLive ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : item.recordingUrl ? (
            <>
              <View style={[styles.liveBadge, { backgroundColor: "rgba(15, 23, 42, 0.75)" }]}>
                <Ionicons name="play-circle" size={14} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.liveText}>RECORDED</Text>
              </View>
              {item.thumbnailUrl && (
                <View style={styles.playOverlay}>
                  <Ionicons name="play" size={32} color="#fff" />
                </View>
              )}
            </>
          ) : null}
        </View>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.sessionMeta}>
            <Text style={styles.sessionHost}>{item.host?.name || "Unknown"}</Text>
            <View style={styles.sessionMetaRight}>
              {item.viewerCount > 0 && (
                <View style={styles.sessionViewers}>
                  <Ionicons name="eye-outline" size={14} color={theme.textMuted} />
                  <Text style={styles.sessionViewersText}>{item.viewerCount}</Text>
                </View>
              )}
              {!isOwn && (
                <TouchableOpacity
                  style={[styles.followButton, isFollowed && styles.followButtonActive]}
                  onPress={(e) => handleFollow(item.hostId, e)}
                  disabled={isLoadingFollow}
                  activeOpacity={0.75}
                >
                  {isLoadingFollow ? (
                    <ActivityIndicator size="small" color={isFollowed ? theme.textMuted : theme.textOnAccent} />
                  ) : (
                    <Text style={[styles.followButtonText, isFollowed && styles.followButtonTextActive]}>
                      {isFollowed ? "Following" : "Follow"}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  function renderFollowingSession({ item }: { item: LiveSession }) {
    const isLive = item.isLive;
    const timeText = isLive ? "LIVE" : formatTime(item.startedAt);
    
    return (
      <View style={styles.followingCard}>
        <TouchableOpacity 
          style={styles.followingHeader}
          onPress={() => router.push(`/user/${item.hostId}`)}
          activeOpacity={0.7}
        >
          <ImageWithFallback
            uri={item.host?.avatarUrl}
            style={styles.followingAvatar}
            fallback={
              <View style={styles.followingAvatarPlaceholder}>
                <Text style={styles.followingAvatarText}>
                  {(item.host?.name || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
            }
          />
          <View>
            <Text style={styles.followingHostName}>{item.host?.name || "Unknown"}</Text>
            <Text style={styles.followingSubtext}>{isLive ? "Live now" : timeText}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.followingThumbnailContainer}
          onPress={() => {
            if (item.hostId === user?.id) {
              router.push(`/host/${item.id}`);
            } else if (item.isLive) {
              router.push(`/viewer/${item.id}`);
            } else if (item.recordingUrl) {
              router.push(`/reels?startId=${item.id}&source=following`);
            }
          }}
          activeOpacity={0.9}
        >
          {item.thumbnailUrl ? (
            <Image 
              source={{ uri: item.thumbnailUrl }} 
              style={styles.followingThumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.followingThumbnailPlaceholder}>
              <Ionicons name="videocam" size={48} color={theme.textMuted} />
            </View>
          )}
          {isLive ? (
            <View style={styles.followingLiveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : item.recordingUrl ? (
            <View style={styles.followingPlayOverlay}>
               <Ionicons name="play" size={48} color="rgba(255,255,255,0.8)" />
            </View>
          ) : null}
        </TouchableOpacity>

        <View style={styles.followingFooter}>
          <Text style={styles.followingCaption}>
            <Text style={styles.followingCaptionText}>{item.title}</Text>
          </Text>
        </View>

      </View>
    );
  }


  return (
    <View style={[styles.container, Platform.OS === "web" && { height: "100%" }]}>
      <Stack.Screen
        options={{
          headerTitle: "",
          headerLeft: () => (
            <Text style={{ fontSize: 24, fontWeight: "800", marginLeft: 16, color: theme.text }}>
              Home
            </Text>
          ),
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setShowSearch(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="search-outline" size={22} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerPill, { marginRight: 16 }]}
                onPress={() => setShowCreateMenu(true)}
              >
                <Ionicons name="add" size={18} color={theme.textOnAccent} />
                <Text style={styles.headerPillText}>Create</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Search Modal */}
      <Modal visible={showSearch} animationType="fade" transparent onRequestClose={closeSearch}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <TouchableOpacity style={styles.searchOverlay} activeOpacity={1} onPress={closeSearch} />
          <View style={styles.searchSheet}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={18} color={theme.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={handleSearchChange}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {searching ? (
              <ActivityIndicator style={{ paddingVertical: 24 }} color={theme.accent} />
            ) : searchQuery.length > 0 && searchResults.length === 0 ? (
              <Text style={styles.searchEmpty}>No users found</Text>
            ) : (
              searchResults.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.searchResultRow}
                  onPress={() => { 
                    setShowSearch(false); 
                    // Small delay to allow modal exit to begin smoothly
                    setTimeout(() => {
                      router.push(`/user/${u.id}`);
                      // Wait for animation to finish before clearing
                      setTimeout(clearSearch, 400);
                    }, 50); 
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.searchResultAvatar}>
                    {u.avatarUrl ? (
                      <Image source={{ uri: u.avatarUrl }} style={styles.searchResultAvatarImg} />
                    ) : (
                      <Text style={styles.searchResultAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{u.name}</Text>
                    {u.bio ? <Text style={styles.searchResultBio} numberOfLines={1}>{u.bio}</Text> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.segmentedWrapper}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity style={styles.segmentTab} onPress={() => scrollToPage(0)} activeOpacity={0.8}>
            <Text style={[styles.segmentText, activeTab === "live" && styles.segmentTextActive]}>Live</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.segmentTab} onPress={() => scrollToPage(1)} activeOpacity={0.8}>
            <Text style={[styles.segmentText, activeTab === "following" && styles.segmentTextActive]}>Following</Text>
          </TouchableOpacity>
        </View>
        <Animated.View style={[styles.tabIndicator, { transform: [{ translateX: tabIndicatorX }] }]} />
        <View style={styles.tabDivider} />
      </View>

      {Platform.OS === "web" ? (
        <View style={{ flex: 1, alignItems: "center" }}>
          {activeTab === "live" ? (
            <FlatList
              key={`live-${numColumns}`}
              data={sessions}
              numColumns={numColumns}
              keyExtractor={(item) => item.id}
              renderItem={renderSession}
              contentContainerStyle={[styles.list, { width: contentWidth, paddingBottom: 100 }]}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="radio-outline" size={56} color={theme.textMuted} style={styles.emptyEmoji} />
                  <Text style={styles.emptyTitle}>No live sessions</Text>
                  <Text style={styles.emptySubtitle}>Be the first to go live!</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={followingSessions}
              keyExtractor={(item) => item.id}
              renderItem={renderFollowingSession}
              contentContainerStyle={[
                styles.listFollowing, 
                { width: Math.min(windowWidth, followingMaxWidth), paddingBottom: 100 }
              ]}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={56} color={theme.textMuted} style={styles.emptyEmoji} />
                  <Text style={styles.emptyTitle}>No live from people you follow</Text>
                  <Text style={styles.emptySubtitle}>Follow creators to see their streams here</Text>
                </View>
              }
            />
          )}
        </View>
      ) : (
        <Animated.ScrollView
          ref={pagerRef as any}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: (Platform.OS as any) !== "web" })}
          onMomentumScrollEnd={handlePageChange}
          style={{ flex: 1 }}
        >
          <View style={{ width: windowWidth, alignItems: "center" }}>
            <FlatList
              key={`live-${numColumns}`}
              data={sessions}
              numColumns={numColumns}
              keyExtractor={(item) => item.id}
              renderItem={renderSession}
              contentContainerStyle={[styles.list, { width: contentWidth }]}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="radio-outline" size={56} color={theme.textMuted} style={styles.emptyEmoji} />
                  <Text style={styles.emptyTitle}>No live sessions</Text>
                  <Text style={styles.emptySubtitle}>Be the first to go live!</Text>
                </View>
              }
            />
          </View>
          <View style={{ width: windowWidth, alignItems: "center" }}>
            <FlatList
              data={followingSessions}
              keyExtractor={(item) => item.id}
              renderItem={renderFollowingSession}
              contentContainerStyle={[styles.listFollowing, { width: Math.min(windowWidth, followingMaxWidth) }]}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={56} color={theme.textMuted} style={styles.emptyEmoji} />
                  <Text style={styles.emptyTitle}>No live from people you follow</Text>
                  <Text style={styles.emptySubtitle}>Follow creators to see their streams here</Text>
                </View>
              }
            />
          </View>
        </Animated.ScrollView>
      )}

      <Modal visible={showGoLive} transparent animationType="fade" onRequestClose={() => setShowGoLive(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={StyleSheet.absoluteFill} 
              activeOpacity={1} 
              onPress={() => setShowGoLive(false)}
            />
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Start Live Session</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Session title..."
                placeholderTextColor="#64748b"
                value={sessionTitle}
                onChangeText={setSessionTitle}
                autoFocus={Platform.OS === "web"}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancel} onPress={() => setShowGoLive(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirm, creating && { opacity: 0.6 }]}
                  onPress={handleGoLive}
                  disabled={creating}
                >
                  <Text style={styles.modalConfirmText}>{creating ? "Starting..." : "Go Live"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ProfileMenuBottomSheet visible={showMenu} onClose={() => setShowMenu(false)} />
      <CreateMenuBottomSheet 
        visible={showCreateMenu} 
        onClose={() => setShowCreateMenu(false)} 
        onAction={(action) => {
          if (action === "go_live") setShowGoLive(true);
          if (action === "create_reel") {
            Alert.alert("Create Reel", "Choose video source", [
              { text: "Camera", onPress: () => handlePickReel("camera") },
              { text: "Gallery", onPress: () => handlePickReel("gallery") },
              { text: "Cancel", style: "cancel" },
            ]);
          }
        }}
      />

      {/* Reel Metadata Modal */}
      <Modal visible={showReelForm} transparent animationType="slide" onRequestClose={resetReelForm}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={resetReelForm} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Post a Reel</Text>
                <TouchableOpacity onPress={resetReelForm}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Give your reel a title..."
                placeholderTextColor={theme.textMuted}
                value={reelTitle}
                onChangeText={setReelTitle}
              />

              <Text style={[styles.label, { marginTop: 16 }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 100, textAlignVertical: "top" }]}
                placeholder="What's this reel about?"
                placeholderTextColor={theme.textMuted}
                value={reelDescription}
                onChangeText={setReelDescription}
                multiline
              />

              <View style={styles.uploadProgressContainer}>
                {uploading ? (
                  <View style={{ alignItems: "center", gap: 8 }}>
                    <ActivityIndicator color={theme.accent} size="large" />
                    <Text style={{ color: theme.textMuted }}>Uploading your reel...</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.modalConfirm} onPress={handlePostReel}>
                    <Text style={styles.modalConfirmText}>Post Reel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  navAvatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: theme.accent,
    justifyContent: "center", alignItems: "center",
  },
  navAvatarText: { fontSize: 15, fontWeight: "800", color: theme.textOnAccent },
  segmentedWrapper: { paddingTop: 4 },
  segmentedControl: { flexDirection: "row" },
  segmentTab: { flex: 1, paddingVertical: 13, alignItems: "center", justifyContent: "center" },
  segmentTabActive: {},
  tabIndicator: {
    height: 2.5,
    width: SCREEN_WIDTH / 2,
    backgroundColor: theme.accent,
    borderRadius: 1.5,
  },
  tabDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginTop: -StyleSheet.hairlineWidth },
  segmentText: { fontSize: 15, fontWeight: "600", color: theme.textMuted },
  segmentTextActive: { color: theme.text, fontWeight: "700" },
  list: { padding: 16, paddingBottom: 100 },
  listFollowing: { paddingBottom: 100 },
  sessionCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
  },
  // Redesigned Following Card Styles (Instagram Aesthetic)
  followingCard: {
    backgroundColor: "transparent",
    marginBottom: 8,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    paddingBottom: 20,
  },

  followingHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  followingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
  },
  followingAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  followingAvatarText: {
    color: theme.textOnAccent,
    fontSize: 14,
    fontWeight: "800",
  },
  followingHostName: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.text,
  },
  followingSubtext: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 1,
  },
  followingThumbnailContainer: {
    aspectRatio: 4 / 5, // Instagram-style aspect ratio
    backgroundColor: theme.surfaceAlt,
    position: "relative",
    width: SCREEN_WIDTH,
  },
  followingThumbnail: {
    width: "100%",
    height: "100%",
  },
  followingThumbnailPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  followingLiveBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  followingPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  followingFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  followingCaption: {
    fontSize: 14,
    lineHeight: 18,
  },
  followingCaptionName: {
    fontWeight: "700",
    color: theme.text,
  },
  followingCaptionText: {
    color: theme.text,
  },
  followingTimeFooter: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 6,
    textTransform: "uppercase",
  },


  sessionVideoPlaceholder: {
    height: 180,
    backgroundColor: theme.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  thumbnailImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  liveBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff", marginRight: 6 },
  liveText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  placeholderEmoji: { marginBottom: 0 },
  sessionInfo: { padding: 14 },
  sessionTitle: { fontSize: 17, fontWeight: "700", color: theme.text },
  sessionMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  sessionMetaRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  sessionHost: { fontSize: 14, color: theme.textMuted, flex: 1 },
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: theme.accent,
  },
  followButtonActive: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.border,
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.textOnAccent,
  },
  followButtonTextActive: {
    color: theme.textMuted,
  },
  sessionViewers: { flexDirection: "row", alignItems: "center", gap: 4 },
  sessionViewersText: { fontSize: 13, color: theme.textMuted, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: 100 },
  emptyEmoji: { marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: theme.text },
  emptySubtitle: { fontSize: 15, color: theme.textMuted, marginTop: 4 },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  headerPillText: {
    color: theme.textOnAccent,
    fontWeight: "700",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 22, fontWeight: "700", color: theme.text, marginBottom: 20 },
  modalInput: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalButtons: { flexDirection: "row", marginTop: 20, gap: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", color: theme.textMuted, marginBottom: 8 },
  uploadProgressContainer: { marginTop: 24, minHeight: 60, justifyContent: "center" },
  modalCancel: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.surfaceAlt,
    alignItems: "center",
  },
  modalCancelText: { color: theme.textMuted, fontWeight: "600", fontSize: 16 },
  modalConfirm: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.accent,
    alignItems: "center",
  },
  modalConfirmText: { color: theme.textOnAccent, fontWeight: "700", fontSize: 16 },

  // Search
  headerIconBtn: { padding: 4 },
  searchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  searchSheet: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    marginHorizontal: 12,
    marginTop: 100,
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 }
      : { elevation: 8 }),
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: theme.text },
  searchEmpty: { textAlign: "center", color: theme.textMuted, paddingVertical: 24, fontSize: 14 },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  searchResultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.accent,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  searchResultAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  searchResultAvatarText: { fontSize: 16, fontWeight: "800", color: theme.textOnAccent },
  searchResultName: { fontSize: 15, fontWeight: "600", color: theme.text },
  searchResultBio: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
});
