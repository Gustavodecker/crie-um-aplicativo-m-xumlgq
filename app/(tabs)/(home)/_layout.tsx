
import { Stack } from 'expo-router';
import { colors } from '@/styles/commonStyles';

export default function HomeLayout() {
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
          title: 'Meus Bebês',
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
