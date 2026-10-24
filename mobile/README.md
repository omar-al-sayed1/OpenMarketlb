# OpenMarket — Mobile App (React Native / Expo)

A native mobile client for the OpenMarket marketplace, sharing the **same FastAPI
backend** as the web app and matching its emerald/teal + violet theme.

## Prerequisites
- Node.js 18+
- The **backend running** on your PC: `uvicorn server_modular:app --host 0.0.0.0 --port 8001`
- **MongoDB** running (as it already is for the web app)
- The **Expo Go** app on your phone (App Store / Play Store), on the **same Wi-Fi**

## Run it
```bash
cd mobile
npm install
npx expo install --fix      # aligns native package versions to the Expo SDK
npm start                   # opens Expo — scan the QR code with Expo Go
```
- Android emulator: press `a`  •  iOS simulator: press `i`

## How it finds the backend
`src/config.js` auto-detects the IP of the machine running Metro (your PC) and
targets `http://<that-ip>:8001/api`. That works on a physical phone and on
emulators with no edits — as long as the backend is started with `--host 0.0.0.0`.

For a production build set `API_OVERRIDE` in `src/config.js` to your deployed API.

## Architecture
```
App.js                     providers (Auth, Cart) + NavigationContainer
src/config.js              backend URL auto-detection
src/theme/theme.js         colors / gradients / spacing (mirrors the website)
src/lib/api.js             axios client + endpoints + AsyncStorage token/session
src/context/               AuthContext, CartContext
src/navigation/
  RootNavigator.js         Stack: Drawer + pushed screens (Search/Messages/…)
  BottomTabs.js            ⭐ modern floating tab bar (raised gradient "Shop")
  DrawerContent.js         the sidebar (all pages), mirrors the web phone menu
  menu.js                  sidebar sections (auth-aware)
src/components/
  AppHeader.js             the TWO top bars (hamburger+search+messages / categories)
  CategoryBar.js           second top bar
  ProductCard.js, ui.js    shared UI
src/screens/               Home, Shop, Cart, Map, BecomeSeller, Profile, Dashboard,
                           Messages, Search, ProductDetail, Auth, Page
```

## Navigation (as specified)
- **Bottom tabs (guest):** Home · Map · **Shop** · Cart · Become a Seller
- **Bottom tabs (user):** Home · Map · **Shop** · Cart · Profile
- **Bottom tabs (admin/shop/agent):** Profile is replaced by **Dashboard**
- **Top bar 1:** hamburger → sidebar · search pill → search · messages (logged-in only)
- **Top bar 2:** category navbar (from `/categories`)

## Notes
- Screens without a dedicated mobile build yet route to a themed `Page` placeholder
  (nothing dead-ends). Extend them incrementally against the same API.
- Stripe checkout / AI features aren't wired on mobile yet (same optional-package
  situation as the backend); the browsing + cart + auth core is fully functional.
