
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { useAuth } from '@/contexts/AuthContext';

export default function HomeLayout() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    console.log("[Logout] User tapped logout button");
    await signOut();
    console.log("[Logout] Sign out complete, redirecting to auth");
    router.replace("/auth");
  };

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerBackTitle: 'Voltar',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          title: 'Início',
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
              <IconSymbol
                ios_icon_name="rectangle.portrait.and.arrow.right"
                android_material_icon_name="logout"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="mother-dashboard"
        options={{
          headerShown: true,
          title: 'Início',
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
              <IconSymbol
                ios_icon_name="rectangle.portrait.and.arrow.right"
                android_material_icon_name="logout"
                size={22}
                color={colors.text}
              />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="mother-routine"
        options={{
          headerShown: true,
          title: 'Rotina Diária',
        }}
      />
      <Stack.Screen
        name="mother-orientations"
        options={{
          headerShown: true,
          title: 'Orientações',
        }}
      />
      <Stack.Screen
        name="mother-evolution"
        options={{
          headerShown: true,
          title: 'Evolução',
        }}
      />
      <Stack.Screen
        name="consultant-dashboard"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="acompanhamento"
        options={{
          headerShown: true,
          title: 'Acompanhamento',
        }}
      />
      <Stack.Screen
        name="reports-landscape"
        options={{
          headerShown: true,
          title: 'Relatórios',
        }}
      />
      <Stack.Screen
        name="mother-dashboard"
        options={{
          headerShown: true,
          title: 'Meu Bebê',
        }}
      />
      <Stack.Screen
        name="mother-routine"
        options={{
          headerShown: true,
          title: 'Rotina Diária',
        }}
      />
      <Stack.Screen
        name="mother-orientations"
        options={{
          headerShown: true,
          title: 'Orientações',
        }}
      />
      <Stack.Screen
        name="mother-evolution"
        options={{
          headerShown: true,
          title: 'Evolução',
        }}
      />
      <Stack.Screen
        name="consultant-dashboard"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="acompanhamento"
        options={{
          headerShown: true,
          title: 'Acompanhamento',
        }}
      />
      <Stack.Screen
        name="reports-landscape"
        options={{
          headerShown: true,
          title: 'Relatórios',
        }}
      />
    </Stack>
  );
}
