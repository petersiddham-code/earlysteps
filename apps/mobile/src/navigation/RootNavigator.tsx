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
import { AdminLandingScreen } from '../screens/AdminLanding/AdminLandingScreen.js';
import { AdminDashboardScreen } from '../screens/AdminDashboard/AdminDashboardScreen.js';
import { AdminContentScreen } from '../screens/AdminContent/AdminContentScreen.js';
import { AdminReviewLogScreen } from '../screens/AdminReviewLog/AdminReviewLogScreen.js';
import { AdminConsoleButton, LogoutButton } from '../components/index.js';
import { View } from 'react-native';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Issue #121: every screen reached only once a session exists (i.e. everything past the
 * Login/Signup gate — see SplashScreen) gets a floating Log out affordance in its header.
 * `headerTransparent` keeps the header from taking layout space, so it floats over each
 * screen's own content instead of pushing it down by an extra header's height on top of
 * the manual top padding those screens already carry for the status bar/notch.
 */
const authenticatedScreenOptions = {
  headerShown: true,
  headerTransparent: true,
  headerTitle: () => null,
  headerBackVisible: false,
  headerRight: () => <LogoutButton />,
} as const;

/**
 * Issue #125: ChildSwitcher (the main post-login hub) also gets the Admin Console entry
 * point next to Log out — AdminConsoleButton renders nothing for a non-admin session, so
 * this doesn't change what a parent account sees. Kept screen-specific rather than folded
 * into authenticatedScreenOptions, which every authenticated screen shares.
 */
const childSwitcherScreenOptions = {
  ...authenticatedScreenOptions,
  headerRight: () => (
    <View style={{ flexDirection: 'row' }}>
      <AdminConsoleButton />
      <LogoutButton />
    </View>
  ),
} as const;

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen
        name="ConsentCenter"
        component={ConsentCenterScreen}
        options={authenticatedScreenOptions}
      />
      <Stack.Screen
        name="ChildProfileSetup"
        component={ChildProfileSetupScreen}
        options={authenticatedScreenOptions}
      />
      <Stack.Screen
        name="ChildSwitcher"
        component={ChildSwitcherScreen}
        options={childSwitcherScreenOptions}
      />
      <Stack.Screen
        name="Questionnaire"
        component={QuestionnaireScreen}
        options={authenticatedScreenOptions}
      />
      <Stack.Screen
        name="FollowUpCheck"
        component={FollowUpCheckScreen}
        options={authenticatedScreenOptions}
      />
      <Stack.Screen
        name="Results"
        component={ResultsScreen}
        options={authenticatedScreenOptions}
      />
      <Stack.Screen
        name="AdminLanding"
        component={AdminLandingScreen}
        options={authenticatedScreenOptions}
      />
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={authenticatedScreenOptions}
      />
      <Stack.Screen
        name="AdminContent"
        component={AdminContentScreen}
        options={authenticatedScreenOptions}
      />
      <Stack.Screen
        name="AdminReviewLog"
        component={AdminReviewLogScreen}
        options={authenticatedScreenOptions}
      />
    </Stack.Navigator>
  );
}
