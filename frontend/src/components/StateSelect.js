import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

const StateSelect = ({ value, onChange, className = '', showDeliveryFee = false, onDeliveryFeeChange, disabled = false, ...props }) => {
  const [states, setStates] = useState([]);

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const { data } = await api.states.getAll();
        setStates(data);
      } catch (error) {
        console.error('Failed to fetch states', error);
      }
    };
    fetchStates();
  }, []);

  // When value changes or states load, notify parent of the delivery fee
  useEffect(() => {
    if (onDeliveryFeeChange && states.length > 0 && value) {
      const matched = states.find(s => s.name === value);
      onDeliveryFeeChange(matched ? matched.delivery_fee : 0);
    } else if (onDeliveryFeeChange && !value) {
      onDeliveryFeeChange(0);
    }
  }, [value, states, onDeliveryFeeChange]);

  const disabledCls = disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : '';

  if (states.length === 0) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter state"
        disabled={disabled}
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background ${disabledCls} ${className}`}
        {...props}
      />
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background ${disabledCls} ${className}`}
      data-testid={props['data-testid'] || 'state-select'}
    >
      <option value="">Select a state</option>
      {states.map((state) => (
        <option key={state.id} value={state.name}>
          {state.name}{showDeliveryFee ? ` (Delivery: $${state.delivery_fee.toFixed(2)})` : ''}
        </option>
      ))}
    </select>
  );
};

export default StateSelect;
