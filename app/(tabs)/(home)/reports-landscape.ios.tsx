
import { Redirect } from 'expo-router';

// iOS version - redirects to main reports-landscape screen
export default function ReportsLandscapeIOS() {
  return <Redirect href="/(tabs)/(home)/reports-landscape" />;
}
