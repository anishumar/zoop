// This screen is no longer used — products are managed in the Profile tab.
// Kept as a stub because Expo Router requires all (tabs) files to exist.
import { Redirect } from "expo-router";

export default function ProductsRedirect() {
  return <Redirect href="/(tabs)/profile" />;
}
