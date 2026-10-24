/**
 * Drawer (sidebar) menu — mirrors the phone sidebar of the web app.
 * `to` is either a tab name (handled specially) or a pushed Stack route.
 * Screens that don't have a dedicated implementation open the generic
 * "Page" route which renders a themed placeholder with the same title.
 */
export function buildMenu({ isLoggedIn, isStaff, role }) {
  const browse = {
    title: 'Browse',
    items: [
      { label: 'Home', icon: 'home', tab: 'Home' },
      { label: 'Shop', icon: 'grid', tab: 'Shop' },
      { label: 'Categories', icon: 'pricetags', route: 'Categories' },
      { label: 'Shops Map', icon: 'map', tab: 'Map' },
      { label: 'Deals & Offers', icon: 'flame', route: 'Deals' },
      { label: 'All Shops', icon: 'storefront', route: 'Shops' },
    ],
  };

  const account = isLoggedIn
    ? {
        title: 'Account',
        items: [
          { label: 'My Profile', icon: 'person', route: 'Page', params: { title: 'My Profile' } },
          { label: 'My Orders', icon: 'bag-check', route: 'Page', params: { title: 'My Orders' } },
          { label: 'Wishlist', icon: 'heart', route: 'Wishlist' },
          { label: 'Messages', icon: 'chatbubbles', route: 'Messages' },
          { label: 'Saved Locations', icon: 'location', route: 'Page', params: { title: 'Saved Locations' } },
          { label: 'Notifications', icon: 'notifications', route: 'Page', params: { title: 'Notifications' } },
          { label: 'Cart', icon: 'cart', tab: 'Cart' },
        ],
      }
    : {
        title: 'Account',
        items: [
          { label: 'Sign in / Register', icon: 'log-in', route: 'Auth' },
          { label: 'Cart', icon: 'cart', tab: 'Cart' },
          { label: 'Become a Seller', icon: 'rocket', tab: 'Sell' },
        ],
      };

  const sections = [browse, account];

  if (isStaff) {
    sections.push({
      title: 'Workspace',
      items: [
        { label: role === 'admin' ? 'Admin Dashboard' : role === 'agent' ? 'Agent Dashboard' : 'Shop Dashboard', icon: 'speedometer', tab: 'Dashboard' },
      ],
    });
  }

  sections.push({
    title: 'More',
    items: [
      { label: 'About Us', icon: 'information-circle', route: 'About' },
      { label: 'Contact', icon: 'call', route: 'Contact' },
      { label: 'Settings', icon: 'settings', route: 'Page', params: { title: 'Settings' } },
    ],
  });

  return sections;
}
