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
    </Stack>
  );
}
