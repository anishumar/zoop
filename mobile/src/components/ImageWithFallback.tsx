import { ReactNode, useEffect, useState } from "react";
import {
  Image,
  ImageStyle,
  StyleProp,
  Text,
  TextStyle,
} from "react-native";

interface ImageWithFallbackProps {
  uri?: string | null;
  style: StyleProp<ImageStyle>;
  fallback?: ReactNode;
  fallbackText?: string;
  fallbackStyle?: StyleProp<TextStyle>;
  resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
}

export default function ImageWithFallback({
  uri,
  style,
  fallback,
  fallbackText,
  fallbackStyle,
  resizeMode,
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [uri]);

  if (!uri || hasError) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <Text style={fallbackStyle}>{fallbackText}</Text>;
  }

  return <Image source={{ uri }} style={style} resizeMode={resizeMode} onError={() => setHasError(true)} />;
}
