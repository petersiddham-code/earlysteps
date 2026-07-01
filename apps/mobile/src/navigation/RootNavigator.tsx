import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types.js';
import { SplashScreen } from '../screens/Splash/SplashScreen.js';
import { ConsentCenterScreen } from '../screens/ConsentCenter/ConsentCenterScreen.js';
import { ChildProfileSetupScreen } from '../screens/ChildProfileSetup/ChildProfileSetupScreen.js';
import { QuestionnaireScreen } from '../screens/Questionnaire/QuestionnaireScreen.js';
import { ResultsScreen } from '../screens/Results/ResultsScreen.js';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="ConsentCenter" component={ConsentCenterScreen} />
      <Stack.Screen name="ChildProfileSetup" component={ChildProfileSetupScreen} />
      <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
    </Stack.Navigator>
  );
}
