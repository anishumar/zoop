import { useEffect, useState } from "react";
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
  fallbackText: string;
  fallbackStyle: StyleProp<TextStyle>;
}

export default function ImageWithFallback({
  uri,
  style,
  fallbackText,
  fallbackStyle,
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [uri]);

  if (!uri || hasError) {
    return <Text style={fallbackStyle}>{fallbackText}</Text>;
  }

  return <Image source={{ uri }} style={style} onError={() => setHasError(true)} />;
}
