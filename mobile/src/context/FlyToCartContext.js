import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { img } from '../lib/media';

/**
 * Global "fly-to-cart" overlay.
 *
 * A product card lives inside a scrolling list while the cart button lives in the top bar, so the
 * flying-image animation has to be rendered ABOVE the whole app. The top-bar cart button registers
 * its on-screen position (`registerCartAnchor`); any card calls `flyToCart({ x, y, size, uri })`
 * with the product image's window-space rect, and a ghost image arcs from there into the cart.
 *
 * All coordinates are window-space (from `measureInWindow`), matching the full-screen overlay.
 */
const FlyToCartContext = createContext({ registerCartAnchor: () => {}, flyToCart: () => {} });

export const useFlyToCart = () => useContext(FlyToCartContext);

export function FlyToCartProvider({ children }) {
  // Cart button center in window coordinates. Sensible default (top-right) until the header registers.
  const anchor = useRef({ x: 0, y: 0 });
  const [flights, setFlights] = useState([]);

  const registerCartAnchor = useCallback((pos) => {
    if (pos && (pos.x || pos.y)) anchor.current = pos;
  }, []);

  const flyToCart = useCallback(({ x, y, size = 120, uri }) => {
    if (!uri) return; // nothing to animate — caller still adds to cart
    const to = anchor.current;
    if (!to || (!to.x && !to.y)) return; // cart button not measured yet
    const key = `${Date.now()}-${Math.random()}`;
    const val = new Animated.Value(0);
    // Distance from the ghost's CENTER to the cart anchor.
    const dx = to.x - (x + size / 2);
    const dy = to.y - (y + size / 2);
    const flight = { key, val, uri, x, y, size, dx, dy };
    setFlights((f) => [...f, flight]);
    Animated.timing(val, {
      toValue: 1,
      duration: 620,
      useNativeDriver: true,
    }).start(() => setFlights((f) => f.filter((it) => it.key !== key)));
  }, []);

  return (
    <FlyToCartContext.Provider value={{ registerCartAnchor, flyToCart }}>
      {children}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {flights.map((fl) => {
          const translateX = fl.val.interpolate({ inputRange: [0, 1], outputRange: [0, fl.dx] });
          // Slight upward arc before dropping into the cart.
          const translateY = fl.val.interpolate({
            inputRange: [0, 0.55, 1],
            outputRange: [0, fl.dy * 0.35 - 42, fl.dy],
          });
          const scale = fl.val.interpolate({ inputRange: [0, 1], outputRange: [1, 0.16] });
          const opacity = fl.val.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.95, 0] });
          return (
            <Animated.Image
              key={fl.key}
              source={{ uri: img(fl.uri) }}
              style={{
                position: 'absolute',
                left: fl.x,
                top: fl.y,
                width: fl.size,
                height: fl.size,
                borderRadius: 18,
                opacity,
                transform: [{ translateX }, { translateY }, { scale }],
              }}
            />
          );
        })}
      </View>
    </FlyToCartContext.Provider>
  );
}

export default FlyToCartProvider;
