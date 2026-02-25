
import { Redirect } from 'expo-router';

// iOS version - redirects to main index
export default function HomeIOS() {
  return <Redirect href="/(tabs)/(home)" />;
}
