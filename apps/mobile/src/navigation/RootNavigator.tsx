import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types.js';
import { SplashScreen } from '../screens/Splash/SplashScreen.js';
import { LoginScreen } from '../screens/Login/LoginScreen.js';
import { SignupScreen } from '../screens/Signup/SignupScreen.js';
import { ConsentCenterScreen } from '../screens/ConsentCenter/ConsentCenterScreen.js';
import { ChildProfileSetupScreen } from '../screens/ChildProfileSetup/ChildProfileSetupScreen.js';
import { ChildSwitcherScreen } from '../screens/ChildSwitcher/ChildSwitcherScreen.js';
import { QuestionnaireScreen } from '../screens/Questionnaire/QuestionnaireScreen.js';
import { FollowUpCheckScreen } from '../screens/FollowUpCheck/FollowUpCheckScreen.js';
import { ResultsScreen } from '../screens/Results/ResultsScreen.js';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ConsentCenter" component={ConsentCenterScreen} />
      <Stack.Screen name="ChildProfileSetup" component={ChildProfileSetupScreen} />
      <Stack.Screen name="ChildSwitcher" component={ChildSwitcherScreen} />
      <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
      <Stack.Screen name="FollowUpCheck" component={FollowUpCheckScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
    </Stack.Navigator>
  );
}
