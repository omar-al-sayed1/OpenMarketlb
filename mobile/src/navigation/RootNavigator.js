import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';

import BottomTabs from './BottomTabs';
import DrawerContent from './DrawerContent';
import { useAuth } from '../context/AuthContext';
import { ToastHost } from '../components/shop/ShopKit';
import ErrorBoundary from '../components/ErrorBoundary';
import { colors } from '../theme/theme';

// Wrap a screen so a render crash shows a recoverable error instead of a blank screen.
// Cached so each screen keeps a stable component identity across re-renders.
const _guardCache = new Map();
const guarded = (Comp) => {
  if (!_guardCache.has(Comp)) {
    const G = (props) => <ErrorBoundary navigation={props.navigation}><Comp {...props} /></ErrorBoundary>;
    G.displayName = `Guarded(${Comp.displayName || Comp.name || 'Screen'})`;
    _guardCache.set(Comp, G);
  }
  return _guardCache.get(Comp);
};

import SearchScreen from '../screens/SearchScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ChatScreen from '../screens/ChatScreen';
import WishlistScreen from '../screens/WishlistScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import ShopsScreen from '../screens/ShopsScreen';
import ShopPublicScreen from '../screens/ShopPublicScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrderSuccessScreen from '../screens/OrderSuccessScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import AuthScreen from '../screens/AuthScreen';
import PageScreen from '../screens/PageScreen';
import ContactScreen from '../screens/ContactScreen';
import AboutScreen from '../screens/AboutScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import DealsScreen from '../screens/DealsScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function DrawerNav() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: { width: 300, backgroundColor: colors.surface },
        swipeEdgeWidth: 40,
      }}
    >
      <Drawer.Screen name="Tabs" component={BottomTabs} />
    </Drawer.Navigator>
  );
}

export default function RootNavigator() {
  const { booting } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Root" component={DrawerNav} />
      <Stack.Screen name="Search" component={guarded(SearchScreen)} options={{ animation: 'fade' }} />
      <Stack.Screen name="Messages" component={guarded(MessagesScreen)} />
      <Stack.Screen name="Chat" component={guarded(ChatScreen)} />
      <Stack.Screen name="Wishlist" component={guarded(WishlistScreen)} />
      <Stack.Screen name="ProductDetail" component={guarded(ProductDetailScreen)} />
      <Stack.Screen name="Shops" component={guarded(ShopsScreen)} />
      <Stack.Screen name="ShopPublic" component={guarded(ShopPublicScreen)} />
      <Stack.Screen name="Checkout" component={guarded(CheckoutScreen)} />
      <Stack.Screen name="OrderSuccess" component={guarded(OrderSuccessScreen)} />
      <Stack.Screen name="OrderTracking" component={guarded(OrderTrackingScreen)} />
      <Stack.Screen name="Auth" component={guarded(AuthScreen)} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Page" component={guarded(PageScreen)} />
      <Stack.Screen name="Categories" component={guarded(CategoriesScreen)} />
      <Stack.Screen name="Deals" component={guarded(DealsScreen)} />
      <Stack.Screen name="Contact" component={guarded(ContactScreen)} />
      <Stack.Screen name="About" component={guarded(AboutScreen)} />
    </Stack.Navigator>
    {/* Global toast host — customer screens (product detail, etc.) can toast too */}
    <ToastHost />
    </View>
  );
}
