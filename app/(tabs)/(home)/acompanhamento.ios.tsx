
import { Redirect } from 'expo-router';

// iOS version - redirects to main acompanhamento screen
export default function AcompanhamentoIOS() {
  return <Redirect href="/(tabs)/(home)/acompanhamento" />;
}
