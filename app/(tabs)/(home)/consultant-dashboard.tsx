
import { Redirect } from 'expo-router';

// Consultant Dashboard - redirects to main index
export default function ConsultantDashboard() {
  return <Redirect href="/(tabs)/(home)" />;
}
