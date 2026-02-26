
import { Redirect } from 'expo-router';

// Consultant Dashboard - redirects to main index which handles role-based routing
export default function ConsultantDashboard() {
  return <Redirect href="/(tabs)/(home)" />;
}
