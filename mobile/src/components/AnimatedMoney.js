import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/**
 * Odometer-style money display. Rolls smoothly from the previous value to the
 * next whenever `value` changes (cart / loyalty / fee recompute). Authoritative
 * for every price, subtotal, saving, fee and total across the checkout flow.
 */
export default function AnimatedMoney({ value = 0, style, format, duration = 420, ...rest }) {
  const av = useRef(new Animated.Value(Number(value) || 0)).current;
  const [disp, setDisp] = useState(Number(value) || 0);
  const fmt = format || ((v) => `$${Number(v || 0).toFixed(2)}`);

  useEffect(() => {
    const id = av.addListener(({ value: v }) => setDisp(v));
    Animated.timing(av, { toValue: Number(value) || 0, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => av.removeListener(id);
  }, [value]); // eslint-disable-line

  return <Animated.Text style={style} numberOfLines={1} {...rest}>{fmt(disp)}</Animated.Text>;
}
